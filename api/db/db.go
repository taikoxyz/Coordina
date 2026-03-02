package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/coordina/coordina/api/models"
)

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	if _, err := s.db.Exec(schema); err != nil {
		return err
	}
	return s.migrateV2()
}

func (s *Store) migrateV2() error {
	cols := []struct{ name, def string }{
		{"gcp_refresh_token", "TEXT NOT NULL DEFAULT ''"},
		{"gcp_token_expiry", "TEXT NOT NULL DEFAULT ''"},
		{"gcp_authed_email", "TEXT NOT NULL DEFAULT ''"},
		{"gcp_sa_email", "TEXT NOT NULL DEFAULT ''"},
		{"workspace_refresh_token", "TEXT NOT NULL DEFAULT ''"},
		{"workspace_token_expiry", "TEXT NOT NULL DEFAULT ''"},
		{"workspace_authed_email", "TEXT NOT NULL DEFAULT ''"},
	}
	for _, c := range cols {
		_, _ = s.db.Exec("ALTER TABLE global_settings ADD COLUMN " + c.name + " " + c.def)
	}
	return nil
}

const schema = `
CREATE TABLE IF NOT EXISTS teams (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	domain TEXT NOT NULL,
	gcp_project_id TEXT NOT NULL DEFAULT '',
	gcp_project_status TEXT NOT NULL DEFAULT 'pending',
	default_cpu TEXT NOT NULL DEFAULT '500m',
	default_memory TEXT NOT NULL DEFAULT '512Mi',
	default_disk TEXT NOT NULL DEFAULT '5Gi',
	prefix_allowlist TEXT NOT NULL DEFAULT '["Agent"]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	prefix TEXT NOT NULL DEFAULT 'Agent',
	display_name TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT '',
	is_team_lead INTEGER NOT NULL DEFAULT 0,
	model_provider TEXT NOT NULL DEFAULT 'anthropic',
	model_id TEXT NOT NULL DEFAULT 'claude-opus-4-6',
	tools_enabled TEXT NOT NULL DEFAULT '[]',
	cpu TEXT,
	memory TEXT,
	disk TEXT,
	container_port INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(team_id, name)
);

CREATE TABLE IF NOT EXISTS chat_messages (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
	member_id TEXT NOT NULL,
	role TEXT NOT NULL,
	content TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'sent',
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS global_settings (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	gcp_org_id TEXT NOT NULL DEFAULT '',
	gcp_billing_account TEXT NOT NULL DEFAULT '',
	bootstrap_sa_key TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL
);
`

type scanner interface {
	Scan(dest ...any) error
}

func ts(t time.Time) string { return t.UTC().Format(time.RFC3339Nano) }

func parseTS(s string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		t, _ = time.Parse(time.RFC3339, s)
	}
	return t
}

// --- Teams ---

func (s *Store) ListTeams() ([]*models.Team, error) {
	rows, err := s.db.Query(`SELECT id, name, display_name, domain, gcp_project_id, gcp_project_status, default_cpu, default_memory, default_disk, prefix_allowlist, created_at, updated_at FROM teams ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var teams []*models.Team
	for rows.Next() {
		t, err := scanTeam(rows)
		if err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	if teams == nil {
		teams = []*models.Team{}
	}
	return teams, rows.Err()
}

func (s *Store) GetTeam(id string) (*models.Team, error) {
	row := s.db.QueryRow(`SELECT id, name, display_name, domain, gcp_project_id, gcp_project_status, default_cpu, default_memory, default_disk, prefix_allowlist, created_at, updated_at FROM teams WHERE id = ?`, id)
	return scanTeam(row)
}

func (s *Store) CreateTeam(t *models.Team) error {
	allowlist, _ := json.Marshal(t.PrefixAllowlist)
	_, err := s.db.Exec(
		`INSERT INTO teams (id, name, display_name, domain, gcp_project_id, gcp_project_status, default_cpu, default_memory, default_disk, prefix_allowlist, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.Name, t.DisplayName, t.Domain, t.GCPProjectID, t.GCPProjectStatus,
		t.DefaultCPU, t.DefaultMemory, t.DefaultDisk, string(allowlist), ts(t.CreatedAt), ts(t.UpdatedAt),
	)
	return err
}

func (s *Store) UpdateTeam(t *models.Team) error {
	allowlist, _ := json.Marshal(t.PrefixAllowlist)
	_, err := s.db.Exec(
		`UPDATE teams SET display_name=?, default_cpu=?, default_memory=?, default_disk=?, prefix_allowlist=?, updated_at=? WHERE id=?`,
		t.DisplayName, t.DefaultCPU, t.DefaultMemory, t.DefaultDisk, string(allowlist), ts(t.UpdatedAt), t.ID,
	)
	return err
}

func (s *Store) UpdateTeamGCPStatus(id, gcpProjectID, status string) error {
	_, err := s.db.Exec(
		`UPDATE teams SET gcp_project_id=?, gcp_project_status=?, updated_at=? WHERE id=?`,
		gcpProjectID, status, ts(time.Now()), id,
	)
	return err
}

func (s *Store) DeleteTeam(id string) error {
	_, err := s.db.Exec(`DELETE FROM teams WHERE id=?`, id)
	return err
}

func scanTeam(row scanner) (*models.Team, error) {
	var t models.Team
	var allowlistJSON, createdAt, updatedAt string
	err := row.Scan(
		&t.ID, &t.Name, &t.DisplayName, &t.Domain,
		&t.GCPProjectID, &t.GCPProjectStatus,
		&t.DefaultCPU, &t.DefaultMemory, &t.DefaultDisk,
		&allowlistJSON, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(allowlistJSON), &t.PrefixAllowlist)
	t.CreatedAt = parseTS(createdAt)
	t.UpdatedAt = parseTS(updatedAt)
	return &t, nil
}

// --- Members ---

func (s *Store) ListMembers(teamID string) ([]*models.Member, error) {
	rows, err := s.db.Query(
		`SELECT id, team_id, name, prefix, display_name, role, is_team_lead, model_provider, model_id, tools_enabled, cpu, memory, disk, container_port, created_at, updated_at FROM members WHERE team_id=? ORDER BY created_at`,
		teamID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var members []*models.Member
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	if members == nil {
		members = []*models.Member{}
	}
	return members, rows.Err()
}

func (s *Store) GetMember(id string) (*models.Member, error) {
	row := s.db.QueryRow(
		`SELECT id, team_id, name, prefix, display_name, role, is_team_lead, model_provider, model_id, tools_enabled, cpu, memory, disk, container_port, created_at, updated_at FROM members WHERE id=?`,
		id,
	)
	return scanMember(row)
}

func (s *Store) CountTeamLeads(teamID string) (int, error) {
	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM members WHERE team_id=? AND is_team_lead=1`, teamID).Scan(&count)
	return count, err
}

func (s *Store) CountMembers(teamID string) (int, error) {
	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM members WHERE team_id=?`, teamID).Scan(&count)
	return count, err
}

func (s *Store) CreateMember(m *models.Member) error {
	tools, _ := json.Marshal(m.ToolsEnabled)
	isLead := 0
	if m.IsTeamLead {
		isLead = 1
	}
	_, err := s.db.Exec(
		`INSERT INTO members (id, team_id, name, prefix, display_name, role, is_team_lead, model_provider, model_id, tools_enabled, cpu, memory, disk, container_port, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, m.TeamID, m.Name, m.Prefix, m.DisplayName, m.Role, isLead,
		m.ModelProvider, m.ModelID, string(tools), m.CPU, m.Memory, m.Disk,
		m.ContainerPort, ts(m.CreatedAt), ts(m.UpdatedAt),
	)
	return err
}

func (s *Store) UpdateMember(m *models.Member) error {
	tools, _ := json.Marshal(m.ToolsEnabled)
	isLead := 0
	if m.IsTeamLead {
		isLead = 1
	}
	_, err := s.db.Exec(
		`UPDATE members SET prefix=?, display_name=?, role=?, is_team_lead=?, model_provider=?, model_id=?, tools_enabled=?, cpu=?, memory=?, disk=?, updated_at=? WHERE id=?`,
		m.Prefix, m.DisplayName, m.Role, isLead, m.ModelProvider, m.ModelID,
		string(tools), m.CPU, m.Memory, m.Disk, ts(m.UpdatedAt), m.ID,
	)
	return err
}

func (s *Store) DeleteMember(id string) error {
	_, err := s.db.Exec(`DELETE FROM members WHERE id=?`, id)
	return err
}

func scanMember(row scanner) (*models.Member, error) {
	var m models.Member
	var toolsJSON, createdAt, updatedAt string
	var isLead int
	err := row.Scan(
		&m.ID, &m.TeamID, &m.Name, &m.Prefix, &m.DisplayName, &m.Role, &isLead,
		&m.ModelProvider, &m.ModelID, &toolsJSON, &m.CPU, &m.Memory, &m.Disk,
		&m.ContainerPort, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}
	m.IsTeamLead = isLead == 1
	json.Unmarshal([]byte(toolsJSON), &m.ToolsEnabled)
	m.CreatedAt = parseTS(createdAt)
	m.UpdatedAt = parseTS(updatedAt)
	return &m, nil
}

// --- Chat ---

func (s *Store) SaveMessage(msg *models.ChatMessage) error {
	_, err := s.db.Exec(
		`INSERT INTO chat_messages (id, team_id, member_id, role, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		msg.ID, msg.TeamID, msg.MemberID, msg.Role, msg.Content, msg.Status, ts(msg.CreatedAt),
	)
	return err
}

func (s *Store) GetChatHistory(teamID, memberID string, limit int) ([]*models.ChatMessage, error) {
	rows, err := s.db.Query(
		`SELECT id, team_id, member_id, role, content, status, created_at FROM chat_messages WHERE team_id=? AND member_id=? ORDER BY created_at DESC LIMIT ?`,
		teamID, memberID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var msgs []*models.ChatMessage
	for rows.Next() {
		var msg models.ChatMessage
		var createdAt string
		if err := rows.Scan(&msg.ID, &msg.TeamID, &msg.MemberID, &msg.Role, &msg.Content, &msg.Status, &createdAt); err != nil {
			return nil, err
		}
		msg.CreatedAt = parseTS(createdAt)
		msgs = append(msgs, &msg)
	}
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	if msgs == nil {
		msgs = []*models.ChatMessage{}
	}
	return msgs, rows.Err()
}

// --- Global Settings ---

func (s *Store) GetGlobalSettings() (*models.GlobalSettings, error) {
	var g models.GlobalSettings
	var updatedAt string
	err := s.db.QueryRow(
		`SELECT gcp_org_id, gcp_billing_account, bootstrap_sa_key, updated_at FROM global_settings WHERE id=1`,
	).Scan(&g.GCPOrgID, &g.GCPBillingAccount, &g.BootstrapSAKey, &updatedAt)
	if err == sql.ErrNoRows {
		return &models.GlobalSettings{}, nil
	}
	if err != nil {
		return nil, err
	}
	g.HasBootstrapSAKey = g.BootstrapSAKey != ""
	g.BootstrapSAKey = ""
	g.UpdatedAt = parseTS(updatedAt)
	return &g, nil
}

func (s *Store) GetGlobalSettingsRaw() (*models.GlobalSettings, error) {
	var g models.GlobalSettings
	var updatedAt string
	err := s.db.QueryRow(
		`SELECT gcp_org_id, gcp_billing_account, bootstrap_sa_key, updated_at,
		 gcp_refresh_token, gcp_authed_email, gcp_sa_email,
		 workspace_refresh_token, workspace_authed_email
		 FROM global_settings WHERE id=1`,
	).Scan(&g.GCPOrgID, &g.GCPBillingAccount, &g.BootstrapSAKey, &updatedAt,
		&g.GCPRefreshToken, &g.GCPAuthedEmail, &g.GCPSAEmail,
		&g.WorkspaceRefreshToken, &g.WorkspaceAuthedEmail)
	if err == sql.ErrNoRows {
		return &models.GlobalSettings{}, nil
	}
	if err != nil {
		return nil, err
	}
	g.UpdatedAt = parseTS(updatedAt)
	return &g, nil
}

func (s *Store) SaveAuthTokens(kind, refreshToken string, expiry time.Time, email string) error {
	now := ts(time.Now())
	switch kind {
	case "gcp":
		_, err := s.db.Exec(
			`INSERT INTO global_settings (id, gcp_org_id, gcp_billing_account, bootstrap_sa_key, updated_at,
			 gcp_refresh_token, gcp_token_expiry, gcp_authed_email)
			 VALUES (1,'','','',?,?,?,?)
			 ON CONFLICT(id) DO UPDATE SET
			 gcp_refresh_token=excluded.gcp_refresh_token,
			 gcp_token_expiry=excluded.gcp_token_expiry,
			 gcp_authed_email=excluded.gcp_authed_email,
			 updated_at=excluded.updated_at`,
			now, refreshToken, ts(expiry), email,
		)
		return err
	case "workspace":
		_, err := s.db.Exec(
			`INSERT INTO global_settings (id, gcp_org_id, gcp_billing_account, bootstrap_sa_key, updated_at,
			 workspace_refresh_token, workspace_token_expiry, workspace_authed_email)
			 VALUES (1,'','','',?,?,?,?)
			 ON CONFLICT(id) DO UPDATE SET
			 workspace_refresh_token=excluded.workspace_refresh_token,
			 workspace_token_expiry=excluded.workspace_token_expiry,
			 workspace_authed_email=excluded.workspace_authed_email,
			 updated_at=excluded.updated_at`,
			now, refreshToken, ts(expiry), email,
		)
		return err
	}
	return fmt.Errorf("unknown auth kind: %s", kind)
}

func (s *Store) ClearAuthTokens(kind string) error {
	now := ts(time.Now())
	switch kind {
	case "gcp":
		_, err := s.db.Exec(
			`UPDATE global_settings SET gcp_refresh_token='', gcp_token_expiry='', gcp_authed_email='',
			 gcp_sa_email='', bootstrap_sa_key='', updated_at=? WHERE id=1`,
			now,
		)
		return err
	case "workspace":
		_, err := s.db.Exec(
			`UPDATE global_settings SET workspace_refresh_token='', workspace_token_expiry='',
			 workspace_authed_email='', updated_at=? WHERE id=1`,
			now,
		)
		return err
	}
	return fmt.Errorf("unknown auth kind: %s", kind)
}

func (s *Store) SaveSAInfo(saEmail, saKey, orgID, billingID string) error {
	now := ts(time.Now())
	_, err := s.db.Exec(
		`UPDATE global_settings SET gcp_sa_email=?, bootstrap_sa_key=?,
		 gcp_org_id=CASE WHEN gcp_org_id='' THEN ? ELSE gcp_org_id END,
		 gcp_billing_account=CASE WHEN gcp_billing_account='' THEN ? ELSE gcp_billing_account END,
		 updated_at=? WHERE id=1`,
		saEmail, saKey, orgID, billingID, now,
	)
	return err
}

func (s *Store) HasBootstrapSAKey() (bool, error) {
	var key string
	err := s.db.QueryRow(`SELECT bootstrap_sa_key FROM global_settings WHERE id=1`).Scan(&key)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return key != "", err
}

func (s *Store) UpsertGlobalSettings(g *models.GlobalSettings) error {
	_, err := s.db.Exec(
		`INSERT INTO global_settings (id, gcp_org_id, gcp_billing_account, bootstrap_sa_key, updated_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET gcp_org_id=excluded.gcp_org_id, gcp_billing_account=excluded.gcp_billing_account, bootstrap_sa_key=excluded.bootstrap_sa_key, updated_at=excluded.updated_at`,
		g.GCPOrgID, g.GCPBillingAccount, g.BootstrapSAKey, ts(g.UpdatedAt),
	)
	return err
}
