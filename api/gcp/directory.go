package gcp

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

func GeneratePassword() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// WorkspaceToken returns an access token with Google Admin SDK scopes.
// The OAuth refresh token (from the workspace auth flow) is tried first because
// it was authorized with admin.directory.user/group scopes. ADC is only used as
// a fallback since gcloud ADC typically only has cloud-platform scopes.
func WorkspaceToken(refreshToken, clientID, clientSecret string) (string, error) {
	if refreshToken != "" && clientID != "" && clientSecret != "" {
		resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
			"grant_type":    {"refresh_token"},
			"refresh_token": {refreshToken},
			"client_id":     {clientID},
			"client_secret": {clientSecret},
		})
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		var r struct {
			AccessToken string `json:"access_token"`
			Error       string `json:"error"`
		}
		json.NewDecoder(resp.Body).Decode(&r)
		if r.Error == "" && r.AccessToken != "" {
			return r.AccessToken, nil
		}
	}
	if tok, err := GCloudADCGetAccessToken(); err == nil && tok != "" {
		return tok, nil
	}
	return "", fmt.Errorf("no workspace credentials with admin directory scopes — connect Google Workspace via OAuth")
}

func CreateGoogleUser(token, email, givenName, familyName, password string) error {
	body, _ := json.Marshal(map[string]any{
		"primaryEmail":              email,
		"name":                      map[string]string{"givenName": givenName, "familyName": familyName},
		"password":                  password,
		"changePasswordAtNextLogin": false,
	})
	req, _ := http.NewRequest("POST", "https://admin.googleapis.com/admin/directory/v1/users", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 409 {
		return nil
	}
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		b, _ := io.ReadAll(resp.Body)
		var e struct {
			Error struct{ Message string `json:"message"` } `json:"error"`
		}
		json.Unmarshal(b, &e)
		return fmt.Errorf("create user %s: %s", email, e.Error.Message)
	}
	return nil
}

func CreateEmailGroup(token, groupEmail, name string) error {
	body, _ := json.Marshal(map[string]string{"email": groupEmail, "name": name})
	req, _ := http.NewRequest("POST", "https://admin.googleapis.com/admin/directory/v1/groups", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 409 {
		return nil
	}
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		b, _ := io.ReadAll(resp.Body)
		var e struct {
			Error struct{ Message string `json:"message"` } `json:"error"`
		}
		json.Unmarshal(b, &e)
		return fmt.Errorf("create group %s: %s", groupEmail, e.Error.Message)
	}
	return nil
}

func AddGroupMember(token, groupEmail, memberEmail string) error {
	body, _ := json.Marshal(map[string]string{"email": memberEmail, "role": "MEMBER"})
	apiURL := fmt.Sprintf("https://admin.googleapis.com/admin/directory/v1/groups/%s/members", url.PathEscape(groupEmail))
	req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 409 {
		return nil
	}
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		b, _ := io.ReadAll(resp.Body)
		var e struct {
			Error struct{ Message string `json:"message"` } `json:"error"`
		}
		json.Unmarshal(b, &e)
		return fmt.Errorf("add member %s to group: %s", memberEmail, e.Error.Message)
	}
	return nil
}
