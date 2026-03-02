package models

import "time"

type Team struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	DisplayName         string    `json:"display_name"`
	Domain              string    `json:"domain"`
	GCPProjectID        string    `json:"gcp_project_id"`
	GCPProjectStatus    string    `json:"gcp_project_status"`
	DefaultCPU          string    `json:"default_cpu"`
	DefaultMemory       string    `json:"default_memory"`
	DefaultDisk         string    `json:"default_disk"`
	PrefixAllowlist     []string  `json:"prefix_allowlist"`
	MaterializeStatus   string    `json:"materialize_status"`
	MaterializeStep     int       `json:"materialize_step"`
	MaterializeError    string    `json:"materialize_error"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}
