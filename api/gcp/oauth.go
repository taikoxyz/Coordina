package gcp

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"
)

type OAuthTokens struct {
	AccessToken  string
	RefreshToken string
	Expiry       time.Time
}

var (
	stateMu    sync.Mutex
	stateStore = map[string]time.Time{}
)

func GenerateState() string {
	b := make([]byte, 16)
	rand.Read(b)
	state := hex.EncodeToString(b)
	stateMu.Lock()
	stateStore[state] = time.Now().Add(10 * time.Minute)
	stateMu.Unlock()
	return state
}

func ValidateState(state string) bool {
	stateMu.Lock()
	defer stateMu.Unlock()
	exp, ok := stateStore[state]
	if !ok {
		return false
	}
	delete(stateStore, state)
	return time.Now().Before(exp)
}

const gcpScopes = "https://www.googleapis.com/auth/cloud-platform " +
	"https://www.googleapis.com/auth/cloudresourcemanager " +
	"https://www.googleapis.com/auth/iam " +
	"https://www.googleapis.com/auth/cloud-billing " +
	"https://www.googleapis.com/auth/userinfo.email " +
	"openid"

func GCPAuthURL(clientID, redirectBase, state string) string {
	return "https://accounts.google.com/o/oauth2/v2/auth?" + url.Values{
		"client_id":     {clientID},
		"redirect_uri":  {redirectBase + "/api/auth/gcp/callback"},
		"response_type": {"code"},
		"scope":         {gcpScopes},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
		"state":         {state},
	}.Encode()
}

func GCPExchange(clientID, clientSecret, redirectBase, code string) (*OAuthTokens, error) {
	return exchangeCode(clientID, clientSecret, redirectBase+"/api/auth/gcp/callback", code)
}

func GetUserEmail(accessToken string) (string, error) {
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var u struct {
		Email string `json:"email"`
	}
	json.NewDecoder(resp.Body).Decode(&u)
	return u.Email, nil
}

func WriteADC(clientID, clientSecret, refreshToken string) error {
	adc := map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"refresh_token": refreshToken,
		"type":          "authorized_user",
	}
	data, _ := json.MarshalIndent(adc, "", "  ")
	home := os.Getenv("HOME")
	if home == "" {
		home = "/root"
	}
	dir := home + "/.config/gcloud"
	os.MkdirAll(dir, 0700)
	return os.WriteFile(dir+"/application_default_credentials.json", data, 0600)
}

func exchangeCode(clientID, clientSecret, redirectURI, code string) (*OAuthTokens, error) {
	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
		"redirect_uri":  {redirectURI},
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return parseTokenResponse(resp)
}

func parseTokenResponse(resp *http.Response) (*OAuthTokens, error) {
	body, _ := io.ReadAll(resp.Body)
	var t struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}
	json.Unmarshal(body, &t)
	if t.Error != "" {
		return nil, fmt.Errorf("OAuth error: %s: %s", t.Error, t.ErrorDesc)
	}
	if t.AccessToken == "" {
		return nil, fmt.Errorf("no access token in response")
	}
	return &OAuthTokens{
		AccessToken:  t.AccessToken,
		RefreshToken: t.RefreshToken,
		Expiry:       time.Now().Add(time.Duration(t.ExpiresIn) * time.Second),
	}, nil
}
