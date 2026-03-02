package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) GetMemberFiles(w http.ResponseWriter, r *http.Request) {
	memberID := chi.URLParam(r, "memberID")
	member, err := h.store.GetMember(memberID)
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}

	if member.ContainerPort == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"files": []any{}, "offline": true})
		return
	}

	params := url.Values{}
	if f := r.URL.Query().Get("filter"); f != "" {
		params.Set("filter", f)
	}
	if f := r.URL.Query().Get("format"); f != "" {
		params.Set("format", f)
	}
	sidecarURL := fmt.Sprintf("http://localhost:%d/files", member.ContainerPort)
	if len(params) > 0 {
		sidecarURL += "?" + params.Encode()
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(sidecarURL)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"files": []any{}, "offline": true})
		return
	}
	defer resp.Body.Close()

	if r.URL.Query().Get("format") == "markdown" {
		w.Header().Set("Content-Type", "text/plain")
		io.Copy(w, resp.Body)
		return
	}

	body, _ := io.ReadAll(resp.Body)
	var result any
	if json.Unmarshal(body, &result) != nil {
		writeJSON(w, http.StatusOK, map[string]any{"files": []any{}, "offline": true})
		return
	}
	writeJSON(w, http.StatusOK, result)
}
