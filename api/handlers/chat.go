package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/coordina/clawteam/api/models"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type wsMsg struct {
	Type    string              `json:"type"`
	Content string              `json:"content,omitempty"`
	Message *models.ChatMessage `json:"message,omitempty"`
}

func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	memberID := chi.URLParam(r, "memberID")

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	now := time.Now().UTC()
	userMsg := &models.ChatMessage{
		ID:        uuid.New().String(),
		TeamID:    teamID,
		MemberID:  memberID,
		Role:      "user",
		Content:   req.Content,
		Status:    "sent",
		CreatedAt: now,
	}
	h.store.SaveMessage(userMsg)

	reply := h.getAgentReply(memberID, req.Content)
	status := "sent"
	if strings.HasPrefix(reply, "⏳") {
		status = "queued"
	}

	agentMsg := &models.ChatMessage{
		ID:        uuid.New().String(),
		TeamID:    teamID,
		MemberID:  memberID,
		Role:      "agent",
		Content:   reply,
		Status:    status,
		CreatedAt: time.Now().UTC(),
	}
	h.store.SaveMessage(agentMsg)

	writeJSON(w, http.StatusOK, map[string]any{
		"messages": []*models.ChatMessage{userMsg, agentMsg},
	})
}

func (h *Handler) GetChatHistory(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	memberID := chi.URLParam(r, "memberID")

	msgs, err := h.store.GetChatHistory(teamID, memberID, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, msgs)
}

func (h *Handler) StreamChat(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamID")
	memberID := chi.URLParam(r, "memberID")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	msgs, _ := h.store.GetChatHistory(teamID, memberID, 20)
	for _, msg := range msgs {
		conn.WriteJSON(wsMsg{Type: "message", Message: msg})
	}

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var req struct {
			Content string `json:"content"`
		}
		if json.Unmarshal(data, &req) != nil || req.Content == "" {
			continue
		}

		userMsg := &models.ChatMessage{
			ID:        uuid.New().String(),
			TeamID:    teamID,
			MemberID:  memberID,
			Role:      "user",
			Content:   req.Content,
			Status:    "sent",
			CreatedAt: time.Now().UTC(),
		}
		h.store.SaveMessage(userMsg)
		conn.WriteJSON(wsMsg{Type: "message", Message: userMsg})

		reply := h.getAgentReply(memberID, req.Content)
		words := strings.Fields(reply)

		var sb strings.Builder
		for i, word := range words {
			if i > 0 {
				sb.WriteString(" ")
				conn.WriteJSON(wsMsg{Type: "token", Content: " "})
			}
			sb.WriteString(word)
			conn.WriteJSON(wsMsg{Type: "token", Content: word})
			time.Sleep(80 * time.Millisecond)
		}

		agentMsg := &models.ChatMessage{
			ID:        uuid.New().String(),
			TeamID:    teamID,
			MemberID:  memberID,
			Role:      "agent",
			Content:   sb.String(),
			Status:    "sent",
			CreatedAt: time.Now().UTC(),
		}
		h.store.SaveMessage(agentMsg)
		conn.WriteJSON(wsMsg{Type: "message", Message: agentMsg})
		conn.WriteJSON(wsMsg{Type: "done"})
	}
}

func (h *Handler) GetMemberHealth(w http.ResponseWriter, r *http.Request) {
	memberID := chi.URLParam(r, "memberID")
	member, err := h.store.GetMember(memberID)
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	status := h.checkMemberHealth(member)
	writeJSON(w, http.StatusOK, map[string]string{
		"member_id": memberID,
		"status":    status,
	})
}

func (h *Handler) checkMemberHealth(m *models.Member) string {
	if m.ContainerPort == 0 {
		return "offline"
	}
	url := fmt.Sprintf("http://localhost:%d/health", m.ContainerPort)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "offline"
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode == http.StatusOK {
		return "online"
	}
	return "error"
}

func (h *Handler) getAgentReply(memberID, content string) string {
	member, err := h.store.GetMember(memberID)
	if err != nil || member.ContainerPort == 0 {
		return fmt.Sprintf("⏳ Queued — container for %s is not running yet.", memberID)
	}

	url := fmt.Sprintf("http://localhost:%d/chat", member.ContainerPort)
	body, _ := json.Marshal(map[string]string{"content": content})
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Sprintf("⏳ Queued — %s is currently offline.", member.DisplayName)
	}
	defer resp.Body.Close()

	var result struct {
		Content string `json:"content"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Content == "" {
		return fmt.Sprintf("Hello! I am %s. (Empty response from agent)", member.DisplayName)
	}
	return result.Content
}
