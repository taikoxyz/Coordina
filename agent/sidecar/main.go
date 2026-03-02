package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type statusFile struct {
	MemberID   string    `json:"member_id"`
	Status     string    `json:"status"`
	ActiveTask *string   `json:"active_task"`
	LastSeen   time.Time `json:"last_seen"`
	UptimeSecs int64     `json:"uptime_seconds"`
}

type fileEntry struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
	IsMemory bool      `json:"is_memory"`
}

var (
	memberID      string
	teamVolume    string
	memberDataDir string
	port          string
	startTime     = time.Now()
)

var memoryKeywords = []string{"MEMORY", "SOUL", "IDENTITY", "WORKING_STATE", "KNOWLEDGE"}

func main() {
	flag.StringVar(&memberID, "member-id", os.Getenv("MEMBER_ID"), "Member ID")
	flag.StringVar(&teamVolume, "team-volume", os.Getenv("TEAM_VOLUME"), "Team volume path")
	flag.StringVar(&memberDataDir, "data-dir", os.Getenv("MEMBER_DATA_DIR"), "Member private data directory")
	flag.StringVar(&port, "port", "18788", "HTTP port")
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
	task := detectActiveTask()
	now := time.Now().UTC()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":         "online",
		"member_id":      memberID,
		"uptime_seconds": int64(time.Since(startTime).Seconds()),
		"active_task":    task,
		"last_seen":      now,
	})
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	task := detectActiveTask()
	status := "idle"
	if task != nil {
		status = "active"
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(statusFile{
		MemberID:   memberID,
		Status:     status,
		ActiveTask: task,
		LastSeen:   time.Now().UTC(),
		UptimeSecs: int64(time.Since(startTime).Seconds()),
	})
}

func handleChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}
	reply := fmt.Sprintf("Hello! I am %s. I received your message: %q — (Phase 0 mock response)", memberID, req.Content)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"content": reply})
}

func handleFiles(w http.ResponseWriter, r *http.Request) {
	filter := r.URL.Query().Get("filter")
	format := r.URL.Query().Get("format")

	files := listFiles()
	if filter == "memory" {
		var mem []fileEntry
		for _, f := range files {
			if f.IsMemory {
				mem = append(mem, f)
			}
		}
		files = mem
	}

	if format == "markdown" {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(filesToMarkdown(files)))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if files == nil {
		files = []fileEntry{}
	}
	json.NewEncoder(w).Encode(map[string]any{"files": files})
}

func listFiles() []fileEntry {
	var files []fileEntry
	var dirs []string
	if teamVolume != "" {
		dirs = append(dirs, filepath.Join(teamVolume, "members", memberID))
	}
	if memberDataDir != "" {
		dirs = append(dirs, memberDataDir)
	}
	for _, dir := range dirs {
		filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			info, err := d.Info()
			if err != nil {
				return nil
			}
			rel, _ := filepath.Rel(dir, path)
			files = append(files, fileEntry{
				Name:     d.Name(),
				Path:     rel,
				Size:     info.Size(),
				Modified: info.ModTime().UTC(),
				IsMemory: isMemoryFile(d.Name()),
			})
			return nil
		})
	}
	return files
}

func isMemoryFile(name string) bool {
	upper := strings.ToUpper(strings.TrimSuffix(name, filepath.Ext(name)))
	for _, kw := range memoryKeywords {
		if strings.Contains(upper, kw) {
			return true
		}
	}
	return false
}

func filesToMarkdown(files []fileEntry) string {
	if len(files) == 0 {
		return fmt.Sprintf("# Files: %s\n\n_(no files)_\n", memberID)
	}
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# Files: %s\n\n", memberID))
	for _, f := range files {
		mark := ""
		if f.IsMemory {
			mark = " ⭐"
		}
		sb.WriteString(fmt.Sprintf("- `%s`%s (%d bytes)\n", f.Path, mark, f.Size))
	}
	return sb.String()
}

func detectActiveTask() *string {
	if teamVolume == "" {
		return nil
	}
	candidates := []string{
		filepath.Join(teamVolume, "members", memberID, "TASK_QUEUE.md"),
		filepath.Join(teamVolume, "TASK_QUEUE.md"),
	}
	for _, p := range candidates {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		if task := parseActiveTask(string(data)); task != nil {
			return task
		}
	}
	return nil
}

func parseActiveTask(content string) *string {
	scanner := bufio.NewScanner(strings.NewReader(content))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "- [ ]") {
			task := strings.TrimSpace(strings.TrimPrefix(line, "- [ ]"))
			if task != "" {
				return &task
			}
		}
	}
	return nil
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
	task := detectActiveTask()
	status := "idle"
	if task != nil {
		status = "active"
	}
	f := statusFile{
		MemberID:   memberID,
		Status:     status,
		ActiveTask: task,
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
