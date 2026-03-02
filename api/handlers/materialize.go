package handlers

import (
	"fmt"
	"net/http"
	"os/exec"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/coordina/coordina/api/gcp"
	"github.com/coordina/coordina/api/models"
)

type stepInfo struct {
	N     int    `json:"n"`
	Label string `json:"label"`
	Done  bool   `json:"done"`
	Error string `json:"error"`
}

type materializeStatusResp struct {
	Status  string                 `json:"status"`
	Step    int                    `json:"step"`
	Steps   []stepInfo             `json:"steps"`
	Error   string                 `json:"error"`
	Members []memberProvisionState `json:"members"`
}

type memberProvisionState struct {
	ID          string `json:"id"`
	K8sDeployed bool   `json:"k8s_deployed"`
}

func agentEmail(teamName, memberName, domain string) string {
	return "agent_" + teamName + "_" + memberName + "@" + domain
}

func (h *Handler) StartMaterialize(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	team, err := h.store.GetTeam(teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}
	if team.MaterializeStatus == "in_progress" {
		writeError(w, http.StatusBadRequest, "materialization already in progress")
		return
	}
	members, err := h.store.ListMembers(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(members) == 0 {
		writeError(w, http.StatusBadRequest, "team has no members")
		return
	}
	settings, err := h.store.GetGlobalSettingsRaw()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	gcpConnected := settings.GCPRefreshToken != "" || gcp.GCloudIsAuthenticated()
	if !gcpConnected {
		writeError(w, http.StatusBadRequest, "GCP not connected")
		return
	}
	h.store.ResetMaterialize(teamID)
	go h.runMaterialize(teamID)
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "in_progress"})
}

func (h *Handler) GetMaterializeStatus(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	team, err := h.store.GetTeam(teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}
	members, err := h.store.ListMembers(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	clusterName := "coordina-" + team.Name
	steps := []stepInfo{
		{N: 1, Label: "Deploy k8s pods on " + clusterName, Done: team.MaterializeStep >= 1},
	}
	if team.MaterializeStatus == "error" && team.MaterializeError != "" {
		steps[0].Error = team.MaterializeError
	}
	memberStates := make([]memberProvisionState, len(members))
	for i, m := range members {
		memberStates[i] = memberProvisionState{
			ID:          m.ID,
			K8sDeployed: m.K8sDeployed,
		}
	}
	writeJSON(w, http.StatusOK, materializeStatusResp{
		Status:  team.MaterializeStatus,
		Step:    team.MaterializeStep,
		Steps:   steps,
		Error:   team.MaterializeError,
		Members: memberStates,
	})
}

func (h *Handler) runMaterialize(teamID string) {
	team, err := h.store.GetTeam(teamID)
	if err != nil {
		h.store.SetMaterializeError(teamID, 0, err.Error())
		return
	}
	members, _ := h.store.ListMembers(teamID)

	emails := make(map[string]string, len(members))
	for _, m := range members {
		emails[m.ID] = agentEmail(team.Name, m.Name, team.Domain)
	}

	groupEmail := "agents_" + team.Name + "@" + team.Domain
	zone := "us-central1-a"
	clusterName := "coordina-" + team.Name
	ns := "coordina-" + team.Name
	teamMD := buildTEAMMD(team, members, groupEmail, emails)

	if err := runCmd("gcloud", "container", "clusters", "create", clusterName,
		"--project="+team.GCPProjectID, "--zone="+zone,
		"--num-nodes=1", "--machine-type=e2-standard-2", "--quiet"); err != nil {
		h.store.SetMaterializeError(teamID, 0, "create cluster: "+err.Error())
		return
	}
	if err := runCmd("gcloud", "container", "clusters", "get-credentials", clusterName,
		"--project="+team.GCPProjectID, "--zone="+zone); err != nil {
		h.store.SetMaterializeError(teamID, 0, "get credentials: "+err.Error())
		return
	}
	if err := kubectlApply(namespaceYAML(ns)); err != nil {
		h.store.SetMaterializeError(teamID, 0, "create namespace: "+err.Error())
		return
	}
	if err := kubectlApply(configMapYAML(ns, teamMD)); err != nil {
		h.store.SetMaterializeError(teamID, 0, "create configmap: "+err.Error())
		return
	}
	for _, m := range members {
		if err := kubectlApply(deploymentYAML(m, team, ns)); err != nil {
			h.store.SetMaterializeError(teamID, 0, "deploy "+m.Name+": "+err.Error())
			return
		}
		h.store.SetMemberK8sDeployed(m.ID)
	}
	h.store.SetMaterializeStep(teamID, 1)
	h.store.SetMaterializeStatus(teamID, "done")
}

func runCmd(name string, args ...string) error {
	out, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%w: %s", err, string(out))
	}
	return nil
}

func kubectlApply(yaml string) error {
	cmd := exec.Command("kubectl", "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(yaml)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%w: %s", err, string(out))
	}
	return nil
}

func buildTEAMMD(team *models.Team, members []*models.Member, groupEmail string, emails map[string]string) string {
	var sb strings.Builder
	sb.WriteString("# Team: " + team.DisplayName + "\n\n")
	sb.WriteString("**Group Email**: " + groupEmail + "\n")
	sb.WriteString("**Domain**: " + team.Domain + "\n\n")
	sb.WriteString("## Members\n\n")
	sb.WriteString("| Name | Slug | Role | Email |\n")
	sb.WriteString("|------|------|------|-------|\n")
	for _, m := range members {
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", m.DisplayName, m.Name, m.Role, emails[m.ID]))
	}
	return sb.String()
}

func namespaceYAML(ns string) string {
	return fmt.Sprintf("apiVersion: v1\nkind: Namespace\nmetadata:\n  name: %s\n", ns)
}

func configMapYAML(ns, teamMD string) string {
	lines := strings.Split(teamMD, "\n")
	var indented []string
	for _, l := range lines {
		indented = append(indented, "    "+l)
	}
	return fmt.Sprintf("apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: team-config\n  namespace: %s\ndata:\n  TEAM.md: |\n%s\n",
		ns, strings.Join(indented, "\n"))
}

func deploymentYAML(m *models.Member, team *models.Team, ns string) string {
	return fmt.Sprintf(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-%s
  namespace: %s
spec:
  replicas: 1
  selector:
    matchLabels:
      app: agent-%s
  template:
    metadata:
      labels:
        app: agent-%s
    spec:
      containers:
      - name: agent
        image: gcr.io/%s/coordina-agent:latest
        env:
        - name: MEMBER_ID
          value: "%s"
        - name: MEMBER_ROLE
          value: "%s"
        volumeMounts:
        - name: team-config
          mountPath: /mnt/team/TEAM.md
          subPath: TEAM.md
          readOnly: true
      volumes:
      - name: team-config
        configMap:
          name: team-config
`, m.Name, ns, m.Name, m.Name, team.GCPProjectID, m.ID, m.Role)
}
