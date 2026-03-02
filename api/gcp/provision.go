package gcp

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type SAInfo struct {
	Email     string
	ProjectID string
}

type GCPProject struct {
	ProjectID      string `json:"projectId"`
	LifecycleState string `json:"lifecycleState"`
}

func ListProjects(token string) ([]GCPProject, error) {
	req, _ := http.NewRequest("GET", "https://cloudresourcemanager.googleapis.com/v1/projects", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var r struct {
		Projects []GCPProject `json:"projects"`
	}
	json.NewDecoder(resp.Body).Decode(&r)
	var active []GCPProject
	for _, p := range r.Projects {
		if p.LifecycleState == "ACTIVE" {
			active = append(active, p)
		}
	}
	return active, nil
}

func GetOrg(token string) (string, error) {
	req, _ := http.NewRequest("POST", "https://cloudresourcemanager.googleapis.com/v1/organizations:search", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var r struct {
		Organizations []struct {
			Name string `json:"name"`
		} `json:"organizations"`
	}
	json.NewDecoder(resp.Body).Decode(&r)
	if len(r.Organizations) > 0 {
		return strings.TrimPrefix(r.Organizations[0].Name, "organizations/"), nil
	}
	return "", nil
}

func GetBillingAccount(token string) (string, error) {
	req, _ := http.NewRequest("GET", "https://cloudbilling.googleapis.com/v1/billingAccounts", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var r struct {
		BillingAccounts []struct {
			Name string `json:"name"`
			Open bool   `json:"open"`
		} `json:"billingAccounts"`
	}
	json.NewDecoder(resp.Body).Decode(&r)
	for _, b := range r.BillingAccounts {
		if b.Open {
			return strings.TrimPrefix(b.Name, "billingAccounts/"), nil
		}
	}
	if len(r.BillingAccounts) > 0 {
		return strings.TrimPrefix(r.BillingAccounts[0].Name, "billingAccounts/"), nil
	}
	return "", nil
}

func CreateServiceAccount(token, projectID string) (*SAInfo, error) {
	body, _ := json.Marshal(map[string]any{
		"accountId": "coordina-service-account",
		"serviceAccount": map[string]string{
			"displayName": "Coordina Service Account",
		},
	})
	apiURL := fmt.Sprintf("https://iam.googleapis.com/v1/projects/%s/serviceAccounts", projectID)
	req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == 409 {
		return getServiceAccount(token, projectID, "coordina-service-account")
	}
	if resp.StatusCode != 200 {
		var e struct {
			Error struct{ Message string `json:"message"` } `json:"error"`
		}
		json.Unmarshal(b, &e)
		return nil, fmt.Errorf("create SA: %s", e.Error.Message)
	}
	var sa struct {
		Email string `json:"email"`
	}
	json.Unmarshal(b, &sa)
	return &SAInfo{Email: sa.Email, ProjectID: projectID}, nil
}

func getServiceAccount(token, projectID, accountID string) (*SAInfo, error) {
	email := fmt.Sprintf("%s@%s.iam.gserviceaccount.com", accountID, projectID)
	apiURL := fmt.Sprintf("https://iam.googleapis.com/v1/projects/%s/serviceAccounts/%s", projectID, email)
	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var sa struct {
		Email string `json:"email"`
	}
	json.NewDecoder(resp.Body).Decode(&sa)
	if sa.Email == "" {
		sa.Email = email
	}
	return &SAInfo{Email: sa.Email, ProjectID: projectID}, nil
}

func GrantOrgRoles(token, orgID, saEmail string) error {
	if orgID == "" {
		return nil
	}
	getURL := fmt.Sprintf("https://cloudresourcemanager.googleapis.com/v1/organizations/%s:getIamPolicy", orgID)
	req, _ := http.NewRequest("POST", getURL, strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var policy map[string]any
	json.NewDecoder(resp.Body).Decode(&policy)

	member := "serviceAccount:" + saEmail
	rolesToAdd := []string{"roles/resourcemanager.projectCreator", "roles/serviceusage.serviceUsageAdmin"}
	bindings := toBindings(policy)
	for _, role := range rolesToAdd {
		bindings = addMemberToRole(bindings, role, member)
	}
	policy["bindings"] = bindings

	return setIAMPolicy(token, fmt.Sprintf("https://cloudresourcemanager.googleapis.com/v1/organizations/%s:setIamPolicy", orgID), policy)
}

func GrantBillingRole(token, billingID, saEmail string) error {
	if billingID == "" {
		return nil
	}
	billingID = strings.TrimPrefix(billingID, "billingAccounts/")
	getURL := fmt.Sprintf("https://cloudbilling.googleapis.com/v1/billingAccounts/%s:getIamPolicy", billingID)
	req, _ := http.NewRequest("GET", getURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var policy map[string]any
	json.NewDecoder(resp.Body).Decode(&policy)

	policy["bindings"] = addMemberToRole(toBindings(policy), "roles/billing.user", "serviceAccount:"+saEmail)
	return setIAMPolicy(token, fmt.Sprintf("https://cloudbilling.googleapis.com/v1/billingAccounts/%s:setIamPolicy", billingID), policy)
}

func CreateSAKey(token, projectID, saEmail string) (string, error) {
	apiURL := fmt.Sprintf("https://iam.googleapis.com/v1/projects/%s/serviceAccounts/%s/keys", projectID, saEmail)
	body, _ := json.Marshal(map[string]string{"keyAlgorithm": "KEY_ALG_RSA_2048"})
	req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		var e struct {
			Error struct{ Message string `json:"message"` } `json:"error"`
		}
		json.Unmarshal(b, &e)
		return "", fmt.Errorf("create SA key: %s", e.Error.Message)
	}
	var r struct {
		PrivateKeyData string `json:"privateKeyData"`
	}
	json.Unmarshal(b, &r)
	decoded, err := base64.StdEncoding.DecodeString(r.PrivateKeyData)
	if err != nil {
		return "", fmt.Errorf("decode SA key: %w", err)
	}
	return string(decoded), nil
}

func toBindings(policy map[string]any) []any {
	b, _ := policy["bindings"].([]any)
	return b
}

func addMemberToRole(bindings []any, role, member string) []any {
	for _, b := range bindings {
		binding, ok := b.(map[string]any)
		if !ok || binding["role"] != role {
			continue
		}
		members, _ := binding["members"].([]any)
		for _, m := range members {
			if m == member {
				return bindings
			}
		}
		binding["members"] = append(members, member)
		return bindings
	}
	return append(bindings, map[string]any{"role": role, "members": []string{member}})
}

func setIAMPolicy(token, apiURL string, policy map[string]any) error {
	body, _ := json.Marshal(map[string]any{"policy": policy})
	req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		var e struct {
			Error struct{ Message string `json:"message"` } `json:"error"`
		}
		json.Unmarshal(b, &e)
		return fmt.Errorf("setIamPolicy: %s", e.Error.Message)
	}
	return nil
}
