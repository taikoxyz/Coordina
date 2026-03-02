package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/coordina/coordina/api/gcp"
	"github.com/coordina/coordina/api/models"
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
	g, err := h.store.GetGlobalSettingsRaw()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if g.BootstrapSAKey == "" {
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "message": "No bootstrap SA key configured."})
		return
	}

	saKey, err := gcp.ParseSAKey(g.BootstrapSAKey)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "message": "Invalid SA key JSON: " + err.Error()})
		return
	}

	token, err := gcp.GetAccessToken(saKey)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":       false,
			"message":  err.Error(),
			"sa_email": saKey.ClientEmail,
		})
		return
	}

	if g.GCPOrgID == "" || g.GCPBillingAccount == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":       false,
			"message":  "SA key authenticated successfully, but GCP Organization ID and Billing Account ID must be saved first to test permissions.",
			"sa_email": saKey.ClientEmail,
		})
		return
	}

	checks, err := gcp.TestPermissions(token, g.GCPOrgID, g.GCPBillingAccount)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":       false,
			"message":  "Permission check failed: " + err.Error(),
			"sa_email": saKey.ClientEmail,
		})
		return
	}

	missing := 0
	for _, c := range checks {
		if !c.Has {
			missing++
		}
	}
	ok := missing == 0
	var msg string
	switch {
	case ok:
		msg = "All permissions verified."
	case missing == 1:
		msg = "1 permission is missing."
	default:
		msg = fmt.Sprintf("%d permissions are missing.", missing)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       ok,
		"message":  msg,
		"sa_email": saKey.ClientEmail,
		"checks":   checks,
	})
}
