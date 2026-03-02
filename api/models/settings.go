package models

import "time"

type GlobalSettings struct {
	GCPOrgID          string    `json:"gcp_org_id"`
	GCPBillingAccount string    `json:"gcp_billing_account"`
	BootstrapSAKey    string    `json:"bootstrap_sa_key,omitempty"`
	HasBootstrapSAKey bool      `json:"has_bootstrap_sa_key"`
	UpdatedAt         time.Time `json:"updated_at"`
}
