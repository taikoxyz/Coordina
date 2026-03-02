package models

import "time"

type ChatMessage struct {
	ID        string    `json:"id"`
	TeamID    string    `json:"team_id"`
	MemberID  string    `json:"member_id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}
