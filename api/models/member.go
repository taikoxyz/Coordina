package models

import "time"

type Member struct {
	ID            string    `json:"id"`
	TeamID        string    `json:"team_id"`
	Name          string    `json:"name"`
	Prefix        string    `json:"prefix"`
	DisplayName   string    `json:"display_name"`
	Role          string    `json:"role"`
	IsTeamLead    bool      `json:"is_team_lead"`
	ModelProvider string    `json:"model_provider"`
	ModelID       string    `json:"model_id"`
	ToolsEnabled  []string  `json:"tools_enabled"`
	CPU           *string   `json:"cpu"`
	Memory        *string   `json:"memory"`
	Disk          *string   `json:"disk"`
	ContainerPort int       `json:"container_port"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
