package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/coordina/clawteam/api/models"
)

func (h *Handler) SaveGlobalSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GCPOrgID          string `json:"gcp_org_id"`
		GCPBillingAccount string `json:"gcp_billing_account"`
		BootstrapSAKey    string `json:"bootstrap_sa_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	g := &models.GlobalSettings{
		GCPOrgID:          req.GCPOrgID,
		GCPBillingAccount: req.GCPBillingAccount,
		BootstrapSAKey:    req.BootstrapSAKey,
		UpdatedAt:         time.Now().UTC(),
	}

	if err := h.store.UpsertGlobalSettings(g); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"updated_at": g.UpdatedAt,
	})
}

func (h *Handler) GetGlobalSettings(w http.ResponseWriter, r *http.Request) {
	g, err := h.store.GetGlobalSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, g)
}

func (h *Handler) TestGlobalSettings(w http.ResponseWriter, r *http.Request) {
	hasKey, err := h.store.HasBootstrapSAKey()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if hasKey {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": "Bootstrap SA key is configured. (Phase 0 stub — real GCP verification in Phase 3)",
		})
	} else {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      false,
			"message": "No bootstrap SA key configured.",
		})
	}
}
