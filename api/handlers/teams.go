package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/coordina/coordina/api/models"
)

var teamNameRe = regexp.MustCompile(`^[a-z][a-z0-9-]{1,18}[a-z0-9]$`)

func (h *Handler) ListTeams(w http.ResponseWriter, r *http.Request) {
	teams, err := h.store.ListTeams()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, teams)
}

func (h *Handler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name            string   `json:"name"`
		DisplayName     string   `json:"display_name"`
		Domain          string   `json:"domain"`
		DefaultCPU      string   `json:"default_cpu"`
		DefaultMemory   string   `json:"default_memory"`
		DefaultDisk     string   `json:"default_disk"`
		PrefixAllowlist []string `json:"prefix_allowlist"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !teamNameRe.MatchString(req.Name) {
		writeError(w, http.StatusBadRequest, "name must be 3-20 chars, lowercase letters/digits/hyphens, start and end with letter/digit")
		return
	}
	if req.Domain == "" {
		writeError(w, http.StatusBadRequest, "domain is required")
		return
	}
	if req.DisplayName == "" {
		req.DisplayName = req.Name
	}
	if req.DefaultCPU == "" {
		req.DefaultCPU = "1"
	}
	if req.DefaultMemory == "" {
		req.DefaultMemory = "2Gi"
	}
	if req.DefaultDisk == "" {
		req.DefaultDisk = "100Gi"
	}
	if len(req.PrefixAllowlist) == 0 {
		req.PrefixAllowlist = []string{"Agent"}
	}

	now := time.Now().UTC()
	team := &models.Team{
		ID:               uuid.New().String(),
		Name:             req.Name,
		DisplayName:      req.DisplayName,
		Domain:           req.Domain,
		GCPProjectID:     "",
		GCPProjectStatus: "pending",
		DefaultCPU:       req.DefaultCPU,
		DefaultMemory:    req.DefaultMemory,
		DefaultDisk:      req.DefaultDisk,
		PrefixAllowlist:  req.PrefixAllowlist,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := h.store.CreateTeam(team); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			writeError(w, http.StatusConflict, "team name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	go h.provisionGCP(team.ID, team.Name)

	writeJSON(w, http.StatusCreated, team)
}

func (h *Handler) provisionGCP(teamID, teamName string) {
	h.store.UpdateTeamGCPStatus(teamID, "", "provisioning")
	time.Sleep(2 * time.Second)
	gcpProjectID := "coordina-" + teamName
	h.store.UpdateTeamGCPStatus(teamID, gcpProjectID, "ready")
}

func (h *Handler) GetTeam(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	team, err := h.store.GetTeam(teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}
	writeJSON(w, http.StatusOK, team)
}

func (h *Handler) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	team, err := h.store.GetTeam(teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}

	var req struct {
		DisplayName     *string  `json:"display_name"`
		DefaultCPU      *string  `json:"default_cpu"`
		DefaultMemory   *string  `json:"default_memory"`
		DefaultDisk     *string  `json:"default_disk"`
		PrefixAllowlist []string `json:"prefix_allowlist"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.DisplayName != nil {
		team.DisplayName = *req.DisplayName
	}
	if req.DefaultCPU != nil {
		team.DefaultCPU = *req.DefaultCPU
	}
	if req.DefaultMemory != nil {
		team.DefaultMemory = *req.DefaultMemory
	}
	if req.DefaultDisk != nil {
		team.DefaultDisk = *req.DefaultDisk
	}
	if req.PrefixAllowlist != nil {
		team.PrefixAllowlist = req.PrefixAllowlist
	}
	team.UpdatedAt = time.Now().UTC()

	if err := h.store.UpdateTeam(team); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, team)
}

func (h *Handler) DeleteTeam(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	if _, err := h.store.GetTeam(teamID); err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}
	if err := h.store.DeleteTeam(teamID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetGCPStatus(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	team, err := h.store.GetTeam(teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"gcp_project_id":     team.GCPProjectID,
		"gcp_project_status": team.GCPProjectStatus,
	})
}

func (h *Handler) ReprovisionGCP(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	team, err := h.store.GetTeam(teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}
	go h.provisionGCP(team.ID, team.Name)
	writeJSON(w, http.StatusOK, map[string]string{"status": "provisioning"})
}

func (h *Handler) GetTeamHealth(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	members, err := h.store.ListMembers(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	type healthResult struct {
		MemberID string `json:"member_id"`
		Status   string `json:"status"`
	}

	results := make([]healthResult, 0, len(members))
	for _, m := range members {
		status := h.checkMemberHealth(m)
		results = append(results, healthResult{MemberID: m.ID, Status: status})
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *Handler) ExportDockerCompose(w http.ResponseWriter, r *http.Request) {
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

	var sb strings.Builder
	sb.WriteString("services:\n")
	volumeNames := []string{"team_shared", "platform_data"}

	for _, m := range members {
		tools := strings.Join(m.ToolsEnabled, ",")
		volumeName := m.ID + "_data"
		sb.WriteString(fmt.Sprintf("  %s:\n", m.ID))
		sb.WriteString("    image: coordina-agent:latest\n")
		sb.WriteString("    environment:\n")
		sb.WriteString(fmt.Sprintf("      MEMBER_ID: \"%s\"\n", m.ID))
		sb.WriteString(fmt.Sprintf("      MEMBER_PREFIX: \"%s\"\n", m.Prefix))
		sb.WriteString(fmt.Sprintf("      MEMBER_ROLE: \"%s\"\n", m.Role))
		sb.WriteString(fmt.Sprintf("      MEMBER_MODEL_PROVIDER: \"%s\"\n", m.ModelProvider))
		sb.WriteString(fmt.Sprintf("      MEMBER_MODEL_ID: \"%s\"\n", m.ModelID))
		sb.WriteString(fmt.Sprintf("      MEMBER_TOOLS: \"%s\"\n", tools))
		sb.WriteString("      ANTHROPIC_API_KEY: \"${ANTHROPIC_API_KEY}\"\n")
		sb.WriteString("      TEAM_VOLUME: \"/mnt/team\"\n")
		sb.WriteString("      SIDECAR_PORT: \"18788\"\n")
		sb.WriteString("      PLATFORM_API_URL: \"http://platform-api:8080\"\n")
		sb.WriteString("    volumes:\n")
		sb.WriteString(fmt.Sprintf("      - %s:/home/zeroclaw/.local/share/zeroclaw\n", volumeName))
		sb.WriteString("      - team_shared:/mnt/team\n")
		if m.ContainerPort > 0 {
			sb.WriteString("    ports:\n")
			sb.WriteString(fmt.Sprintf("      - \"%d:18788\"\n", m.ContainerPort))
		}
		sb.WriteString("    restart: unless-stopped\n\n")
		volumeNames = append(volumeNames, volumeName)
	}

	sb.WriteString("  platform-api:\n")
	sb.WriteString("    image: coordina-platform-api:latest\n")
	sb.WriteString("    ports:\n")
	sb.WriteString("      - \"8080:8080\"\n")
	sb.WriteString("    environment:\n")
	sb.WriteString("      DATABASE_PATH: \"/data/coordina.db\"\n")
	sb.WriteString("    volumes:\n")
	sb.WriteString("      - platform_data:/data\n")
	sb.WriteString("      - team_shared:/mnt/team\n")
	sb.WriteString("    restart: unless-stopped\n\n")

	sb.WriteString("  ui:\n")
	sb.WriteString("    image: coordina-ui:latest\n")
	sb.WriteString("    ports:\n")
	sb.WriteString("      - \"3000:3000\"\n")
	sb.WriteString("    restart: unless-stopped\n\n")

	sb.WriteString("volumes:\n")
	for _, v := range volumeNames {
		sb.WriteString(fmt.Sprintf("  %s:\n", v))
	}

	_ = team
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="docker-compose.yml"`)
	w.Write([]byte(sb.String()))
}
