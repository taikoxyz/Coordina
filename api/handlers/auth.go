package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/coordina/coordina/api/gcp"
)

var (
	provMu     sync.Mutex
	provStatus string
)

func oauthCreds() (clientID, clientSecret, redirectBase string) {
	clientID = os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
	clientSecret = os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
	redirectBase = os.Getenv("GOOGLE_REDIRECT_BASE")
	if redirectBase == "" {
		redirectBase = "http://localhost:3000"
	}
	return
}

func (h *Handler) GCPAuthBegin(w http.ResponseWriter, r *http.Request) {
	clientID, _, redirectBase := oauthCreds()
	if clientID == "" {
		writeError(w, http.StatusServiceUnavailable, "GOOGLE_OAUTH_CLIENT_ID not configured")
		return
	}
	state := gcp.GenerateState()
	writeJSON(w, http.StatusOK, map[string]string{"url": gcp.GCPAuthURL(clientID, redirectBase, state)})
}

func (h *Handler) GCPAuthCallback(w http.ResponseWriter, r *http.Request) {
	clientID, clientSecret, redirectBase := oauthCreds()
	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	if !gcp.ValidateState(state) {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	tokens, err := gcp.GCPExchange(clientID, clientSecret, redirectBase, code)
	if err != nil {
		http.Redirect(w, r, redirectBase+"/?auth=gcp_error", http.StatusFound)
		return
	}
	email, _ := gcp.GetUserEmail(tokens.AccessToken)
	if err := h.store.SaveAuthTokens("gcp", tokens.RefreshToken, tokens.Expiry, email); err != nil {
		http.Redirect(w, r, redirectBase+"/?auth=gcp_error", http.StatusFound)
		return
	}
	gcp.WriteADC(clientID, clientSecret, tokens.RefreshToken)
	go h.runProvision(tokens.AccessToken)
	http.Redirect(w, r, redirectBase+"/?auth=gcp_ok", http.StatusFound)
}

func (h *Handler) runProvision(accessToken string) {
	provMu.Lock()
	provStatus = "running"
	provMu.Unlock()

	settings, _ := h.store.GetGlobalSettingsRaw()
	orgID := settings.GCPOrgID
	if orgID == "" {
		orgID, _ = gcp.GetOrg(accessToken)
	}
	billingID := settings.GCPBillingAccount
	if billingID == "" {
		billingID, _ = gcp.GetBillingAccount(accessToken)
	}

	projects, err := gcp.ListProjects(accessToken)
	if err != nil || len(projects) == 0 {
		provMu.Lock()
		provStatus = "error: no accessible GCP projects found"
		provMu.Unlock()
		return
	}

	sa, err := gcp.CreateServiceAccount(accessToken, projects[0].ProjectID)
	if err != nil {
		provMu.Lock()
		provStatus = "error: " + err.Error()
		provMu.Unlock()
		return
	}

	gcp.GrantOrgRoles(accessToken, orgID, sa.Email)
	gcp.GrantBillingRole(accessToken, billingID, sa.Email)

	keyJSON, err := gcp.CreateSAKey(accessToken, sa.ProjectID, sa.Email)
	if err != nil {
		provMu.Lock()
		provStatus = "error: " + err.Error()
		provMu.Unlock()
		return
	}

	h.store.SaveSAInfo(sa.Email, keyJSON, orgID, billingID)
	provMu.Lock()
	provStatus = "done"
	provMu.Unlock()
}

func (h *Handler) GCPAuthStatus(w http.ResponseWriter, r *http.Request) {
	settings, err := h.store.GetGlobalSettingsRaw()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	provMu.Lock()
	ps := provStatus
	provMu.Unlock()
	clientID, _, _ := oauthCreds()
	email := settings.GCPAuthedEmail
	if email == "" {
		email = gcp.GCloudGetEmail()
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"connected":           settings.GCPRefreshToken != "" || gcp.GCloudIsAuthenticated(),
		"email":               email,
		"sa_email":            settings.GCPSAEmail,
		"sa_created":          settings.GCPSAEmail != "" || settings.BootstrapSAKey != "",
		"provisioning_status": ps,
		"org_id":              settings.GCPOrgID,
		"billing_account":     settings.GCPBillingAccount,
		"oauth_configured":    clientID != "",
	})
}

func (h *Handler) GCPAuthRevoke(w http.ResponseWriter, r *http.Request) {
	if err := h.store.ClearAuthTokens("gcp"); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	gcp.GCloudRevoke()
	provMu.Lock()
	provStatus = ""
	provMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

func (h *Handler) GCloudAuthBegin(w http.ResponseWriter, r *http.Request) {
	url, err := gcp.GCloudBegin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

func (h *Handler) GCloudAuthSubmit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}
	if err := gcp.GCloudSubmit(body.Code); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	email := gcp.GCloudGetEmail()
	if err := h.store.SaveAuthTokens("gcp", "", time.Time{}, email); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	token, err := gcp.GCloudGetAccessToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	go h.runProvision(token)
	writeJSON(w, http.StatusOK, map[string]string{"email": email})
}

func (h *Handler) GCloudAuthRevoke(w http.ResponseWriter, r *http.Request) {
	gcp.GCloudRevoke()
	if err := h.store.ClearAuthTokens("gcp"); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

func (h *Handler) WorkspaceAuthBegin(w http.ResponseWriter, r *http.Request) {
	clientID, _, redirectBase := oauthCreds()
	if clientID == "" {
		writeError(w, http.StatusServiceUnavailable, "GOOGLE_OAUTH_CLIENT_ID not configured")
		return
	}
	state := gcp.GenerateState()
	writeJSON(w, http.StatusOK, map[string]string{"url": gcp.WorkspaceAuthURL(clientID, redirectBase, state)})
}

func (h *Handler) WorkspaceAuthCallback(w http.ResponseWriter, r *http.Request) {
	clientID, clientSecret, redirectBase := oauthCreds()
	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	if !gcp.ValidateState(state) {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	tokens, err := gcp.WorkspaceExchange(clientID, clientSecret, redirectBase, code)
	if err != nil {
		http.Redirect(w, r, redirectBase+"/?auth=workspace_error", http.StatusFound)
		return
	}
	email, _ := gcp.GetUserEmail(tokens.AccessToken)
	if err := h.store.SaveAuthTokens("workspace", tokens.RefreshToken, tokens.Expiry, email); err != nil {
		http.Redirect(w, r, redirectBase+"/?auth=workspace_error", http.StatusFound)
		return
	}
	http.Redirect(w, r, redirectBase+"/?auth=workspace_ok", http.StatusFound)
}

func (h *Handler) WorkspaceAuthStatus(w http.ResponseWriter, r *http.Request) {
	settings, err := h.store.GetGlobalSettingsRaw()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	email := settings.WorkspaceAuthedEmail
	connected := settings.WorkspaceRefreshToken != "" || gcp.GCloudADCIsAuthenticated()
	if connected && email == "" {
		if token, err := gcp.GCloudADCGetAccessToken(); err == nil {
			if fetchedEmail, err := gcp.GetUserEmail(token); err == nil && fetchedEmail != "" {
				h.store.SaveAuthTokens("workspace", "", time.Time{}, fetchedEmail)
				email = fetchedEmail
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"connected": connected,
		"email":     email,
	})
}

func (h *Handler) WorkspaceAuthRevoke(w http.ResponseWriter, r *http.Request) {
	gcp.GCloudADCRevoke()
	if err := h.store.ClearAuthTokens("workspace"); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

func (h *Handler) GCloudADCBegin(w http.ResponseWriter, r *http.Request) {
	cmd, err := gcp.GCloudADCBegin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": cmd})
}

func (h *Handler) GCloudADCSubmit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}
	if err := gcp.GCloudADCSubmit(body.Code); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	token, err := gcp.GCloudADCGetAccessToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	email, _ := gcp.GetUserEmail(token)
	h.store.SaveAuthTokens("workspace", "", time.Time{}, email)
	writeJSON(w, http.StatusOK, map[string]string{"email": email})
}

func (h *Handler) GCloudADCRevoke(w http.ResponseWriter, r *http.Request) {
	gcp.GCloudADCRevoke()
	if err := h.store.ClearAuthTokens("workspace"); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}
