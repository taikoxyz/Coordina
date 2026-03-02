package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/coordina/coordina/api/models"
)

var memberNameRe = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	if _, err := h.store.GetTeam(teamID); err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}
	members, err := h.store.ListMembers(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *Handler) CreateMember(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	team, err := h.store.GetTeam(teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}

	var req struct {
		Name          string   `json:"name"`
		Prefix        string   `json:"prefix"`
		DisplayName   string   `json:"display_name"`
		Role          string   `json:"role"`
		IsTeamLead    bool     `json:"is_team_lead"`
		ModelProvider string   `json:"model_provider"`
		ModelID       string   `json:"model_id"`
		ToolsEnabled  []string `json:"tools_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if !memberNameRe.MatchString(req.Name) {
		writeError(w, http.StatusBadRequest, "name must be lowercase letters, digits, or underscores, starting with a letter")
		return
	}
	if req.DisplayName == "" {
		req.DisplayName = req.Name
	}
	if req.Prefix == "" {
		req.Prefix = "Agent"
	}
	if req.ModelProvider == "" {
		req.ModelProvider = "anthropic"
	}
	if req.ModelID == "" {
		req.ModelID = "claude-opus-4-6"
	}
	if req.ToolsEnabled == nil {
		req.ToolsEnabled = []string{}
	}

	// Validate prefix is in allowlist
	if len(team.PrefixAllowlist) > 0 {
		allowed := false
		for _, p := range team.PrefixAllowlist {
			if p == req.Prefix {
				allowed = true
				break
			}
		}
		if !allowed {
			writeError(w, http.StatusBadRequest, "prefix not in team allowlist")
			return
		}
	}

	// Assign container port
	count, err := h.store.CountMembers(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	containerPort := 18800 + count

	now := time.Now().UTC()
	member := &models.Member{
		ID:            team.Name + "_" + req.Name,
		TeamID:        teamID,
		Name:          req.Name,
		Prefix:        req.Prefix,
		DisplayName:   req.DisplayName,
		Role:          req.Role,
		IsTeamLead:    req.IsTeamLead,
		ModelProvider: req.ModelProvider,
		ModelID:       req.ModelID,
		ToolsEnabled:  req.ToolsEnabled,
		ContainerPort: containerPort,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := h.store.CreateMember(member); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			writeError(w, http.StatusConflict, "member name already exists in this team")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, member)
}

func (h *Handler) GetMember(w http.ResponseWriter, r *http.Request) {
	memberID := chi.URLParam(r, "memberID")
	member, err := h.store.GetMember(memberID)
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (h *Handler) UpdateMember(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	memberID := chi.URLParam(r, "memberID")

	member, err := h.store.GetMember(memberID)
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}

	team, err := h.store.GetTeam(teamID)
	if err != nil {
		writeError(w, http.StatusNotFound, "team not found")
		return
	}

	var req struct {
		Prefix        *string  `json:"prefix"`
		DisplayName   *string  `json:"display_name"`
		Role          *string  `json:"role"`
		IsTeamLead    *bool    `json:"is_team_lead"`
		ModelProvider *string  `json:"model_provider"`
		ModelID       *string  `json:"model_id"`
		ToolsEnabled  []string `json:"tools_enabled"`
		CPU           *string  `json:"cpu"`
		Memory        *string  `json:"memory"`
		Disk          *string  `json:"disk"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Prefix != nil {
		allowed := false
		for _, p := range team.PrefixAllowlist {
			if p == *req.Prefix {
				allowed = true
				break
			}
		}
		if !allowed {
			writeError(w, http.StatusBadRequest, "prefix not in team allowlist")
			return
		}
		member.Prefix = *req.Prefix
	}
	if req.DisplayName != nil {
		member.DisplayName = *req.DisplayName
	}
	if req.Role != nil {
		member.Role = *req.Role
	}
	if req.IsTeamLead != nil {
		if !*req.IsTeamLead && member.IsTeamLead {
			leads, err := h.store.CountTeamLeads(teamID)
			if err != nil || leads <= 1 {
				writeError(w, http.StatusBadRequest, "cannot remove the last team lead")
				return
			}
		}
		member.IsTeamLead = *req.IsTeamLead
	}
	if req.ModelProvider != nil {
		member.ModelProvider = *req.ModelProvider
	}
	if req.ModelID != nil {
		member.ModelID = *req.ModelID
	}
	if req.ToolsEnabled != nil {
		member.ToolsEnabled = req.ToolsEnabled
	}
	member.CPU = req.CPU
	member.Memory = req.Memory
	member.Disk = req.Disk
	member.UpdatedAt = time.Now().UTC()

	if err := h.store.UpdateMember(member); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (h *Handler) DeleteMember(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	memberID := chi.URLParam(r, "memberID")

	member, err := h.store.GetMember(memberID)
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}

	if member.IsTeamLead {
		leads, err := h.store.CountTeamLeads(teamID)
		if err != nil || leads <= 1 {
			writeError(w, http.StatusBadRequest, "cannot delete the last team lead; designate another team lead first")
			return
		}
	}

	if err := h.store.DeleteMember(memberID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
