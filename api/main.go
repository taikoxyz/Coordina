package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimid "github.com/go-chi/chi/v5/middleware"

	"github.com/coordina/coordina/api/db"
	"github.com/coordina/coordina/api/handlers"
)

func main() {
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./coordina.db"
	}

	store, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer store.Close()

	r := chi.NewRouter()
	r.Use(chimid.Logger)
	r.Use(chimid.Recoverer)
	r.Use(handlers.CORS)

	h := handlers.New(store)

	r.Route("/api", func(r chi.Router) {
		r.Get("/teams", h.ListTeams)
		r.Post("/teams", h.CreateTeam)

		r.Route("/teams/{teamID}", func(r chi.Router) {
			r.Get("/", h.GetTeam)
			r.Put("/", h.UpdateTeam)
			r.Delete("/", h.DeleteTeam)

			r.Get("/members", h.ListMembers)
			r.Post("/members", h.CreateMember)

			r.Route("/members/{memberID}", func(r chi.Router) {
				r.Get("/", h.GetMember)
				r.Put("/", h.UpdateMember)
				r.Delete("/", h.DeleteMember)

				r.Post("/chat", h.SendMessage)
				r.Get("/chat/history", h.GetChatHistory)
				r.Get("/stream", h.StreamChat)

				r.Get("/health", h.GetMemberHealth)
				r.Get("/files", h.GetMemberFiles)
				r.Post("/duplicate", h.DuplicateMember)
			})

			r.Get("/health", h.GetTeamHealth)
			r.Get("/gcp/status", h.GetGCPStatus)
			r.Post("/gcp/reprovision", h.ReprovisionGCP)
			r.Get("/export/docker-compose", h.ExportDockerCompose)
		})

		r.Route("/settings", func(r chi.Router) {
			r.Put("/gcp", h.SaveGlobalSettings)
			r.Get("/gcp", h.GetGlobalSettings)
			r.Get("/gcp/test", h.TestGlobalSettings)
		})

		r.Route("/auth", func(r chi.Router) {
			r.Get("/gcp/begin", h.GCPAuthBegin)
			r.Get("/gcp/callback", h.GCPAuthCallback)
			r.Get("/gcp/status", h.GCPAuthStatus)
			r.Post("/gcp/revoke", h.GCPAuthRevoke)
			r.Get("/gcloud/begin", h.GCloudAuthBegin)
			r.Post("/gcloud/submit", h.GCloudAuthSubmit)
			r.Post("/gcloud/revoke", h.GCloudAuthRevoke)
			r.Get("/workspace/begin", h.WorkspaceAuthBegin)
			r.Get("/workspace/callback", h.WorkspaceAuthCallback)
			r.Get("/workspace/status", h.WorkspaceAuthStatus)
			r.Post("/workspace/revoke", h.WorkspaceAuthRevoke)
			r.Get("/workspace/gcloud/begin", h.GCloudADCBegin)
			r.Post("/workspace/gcloud/submit", h.GCloudADCSubmit)
			r.Post("/workspace/gcloud/revoke", h.GCloudADCRevoke)
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Coordina Platform API listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
