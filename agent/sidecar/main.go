package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type statusFile struct {
	MemberID   string    `json:"member_id"`
	Status     string    `json:"status"`
	ActiveTask *string   `json:"active_task"`
	LastSeen   time.Time `json:"last_seen"`
	UptimeSecs int64     `json:"uptime_seconds"`
}

var (
	memberID    string
	teamVolume  string
	port        string
	platformAPI string
	startTime   = time.Now()
)

func main() {
	flag.StringVar(&memberID, "member-id", os.Getenv("MEMBER_ID"), "Member ID")
	flag.StringVar(&teamVolume, "team-volume", os.Getenv("TEAM_VOLUME"), "Team volume path")
	flag.StringVar(&port, "port", "18788", "HTTP port")
	flag.StringVar(&platformAPI, "platform-api", "http://platform-api:8080", "Platform API URL")
	flag.Parse()

	if memberID == "" {
		log.Fatal("--member-id is required")
	}

	go writeStatusLoop()
	go pollMailbox()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /status", handleStatus)
	mux.HandleFunc("POST /chat", handleChat)
	mux.HandleFunc("GET /files", handleFiles)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Sidecar listening on %s for member %s", addr, memberID)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":         "online",
		"member_id":      memberID,
		"uptime_seconds": int64(time.Since(startTime).Seconds()),
	})
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statusFile{
		MemberID:   memberID,
		Status:     "idle",
		ActiveTask: nil,
		LastSeen:   time.Now().UTC(),
		UptimeSecs: int64(time.Since(startTime).Seconds()),
	})
}

func handleChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}
	reply := fmt.Sprintf("Hello! I am %s. I received your message: %q — (Phase 0 mock response)", memberID, req.Content)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"content": reply})
}

func handleFiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"files": []any{},
		"note":  "File browser available in Phase 1",
	})
}

func writeStatusLoop() {
	writeStatus()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		writeStatus()
	}
}

func writeStatus() {
	if teamVolume == "" {
		return
	}
	dir := filepath.Join(teamVolume, "members", memberID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return
	}
	f := statusFile{
		MemberID:   memberID,
		Status:     "idle",
		LastSeen:   time.Now().UTC(),
		UptimeSecs: int64(time.Since(startTime).Seconds()),
	}
	data, _ := json.Marshal(f)
	os.WriteFile(filepath.Join(dir, "status.json"), data, 0644)
}

func pollMailbox() {
	if teamVolume == "" {
		return
	}
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		mailboxDir := filepath.Join(teamVolume, "members", memberID, "mailbox")
		entries, err := os.ReadDir(mailboxDir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
				continue
			}
			path := filepath.Join(mailboxDir, e.Name())
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}
			log.Printf("Received mailbox message: %s", string(data))
			os.Remove(path)
		}
	}
}
