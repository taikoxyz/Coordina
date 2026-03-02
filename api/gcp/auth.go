package gcp

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type SAKey struct {
	Type         string `json:"type"`
	ProjectID    string `json:"project_id"`
	PrivateKeyID string `json:"private_key_id"`
	PrivateKey   string `json:"private_key"`
	ClientEmail  string `json:"client_email"`
	TokenURI     string `json:"token_uri"`
}

type PermCheck struct {
	Name  string `json:"name"`
	Level string `json:"level"`
	Has   bool   `json:"has"`
}

func ParseSAKey(raw string) (*SAKey, error) {
	var k SAKey
	if err := json.Unmarshal([]byte(raw), &k); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	if k.Type != "service_account" {
		return nil, fmt.Errorf("expected type \"service_account\", got %q", k.Type)
	}
	if k.ClientEmail == "" {
		return nil, fmt.Errorf("missing client_email in key JSON")
	}
	if k.PrivateKey == "" {
		return nil, fmt.Errorf("missing private_key in key JSON")
	}
	if k.TokenURI == "" {
		k.TokenURI = "https://oauth2.googleapis.com/token"
	}
	return &k, nil
}

func GetAccessToken(k *SAKey) (string, error) {
	now := time.Now().Unix()
	hdr := b64j(map[string]string{"alg": "RS256", "typ": "JWT", "kid": k.PrivateKeyID})
	pay := b64j(map[string]any{
		"iss":   k.ClientEmail,
		"scope": "https://www.googleapis.com/auth/cloud-platform",
		"aud":   k.TokenURI,
		"iat":   now,
		"exp":   now + 3600,
	})
	sig, err := signRS256(k.PrivateKey, hdr+"."+pay)
	if err != nil {
		return "", fmt.Errorf("sign JWT: %w", err)
	}
	resp, err := http.PostForm(k.TokenURI, url.Values{
		"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"assertion":  {hdr + "." + pay + "." + sig},
	})
	if err != nil {
		return "", fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		var e struct {
			ErrorDescription string `json:"error_description"`
			Error            string `json:"error"`
		}
		json.Unmarshal(body, &e)
		desc := e.ErrorDescription
		if desc == "" {
			desc = e.Error
		}
		if desc == "" {
			desc = string(body)
		}
		return "", fmt.Errorf("GCP authentication failed: %s", desc)
	}
	var t struct {
		AccessToken string `json:"access_token"`
	}
	json.Unmarshal(body, &t)
	return t.AccessToken, nil
}

func TestPermissions(token, orgID, billingID string) ([]PermCheck, error) {
	var checks []PermCheck

	orgPerms := []string{"resourcemanager.projects.create", "serviceusage.services.enable"}
	orgURL := fmt.Sprintf("https://cloudresourcemanager.googleapis.com/v1/organizations/%s:testIamPermissions", orgID)
	have, err := testIAM(token, orgURL, orgPerms)
	if err != nil {
		return nil, fmt.Errorf("organization permission check: %w", err)
	}
	haveSet := toSet(have)
	for _, p := range orgPerms {
		checks = append(checks, PermCheck{Name: p, Level: "organization", Has: haveSet[p]})
	}

	billingID = strings.TrimPrefix(billingID, "billingAccounts/")
	billingPerms := []string{"billing.resourceAssociations.create"}
	billingURL := fmt.Sprintf("https://cloudbilling.googleapis.com/v1/billingAccounts/%s:testIamPermissions", billingID)
	have, err = testIAM(token, billingURL, billingPerms)
	if err != nil {
		return nil, fmt.Errorf("billing account permission check: %w", err)
	}
	haveSet = toSet(have)
	for _, p := range billingPerms {
		checks = append(checks, PermCheck{Name: p, Level: "billing account", Has: haveSet[p]})
	}

	return checks, nil
}

func testIAM(token, apiURL string, permissions []string) ([]string, error) {
	body, _ := json.Marshal(map[string]any{"permissions": permissions})
	req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		var e struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		json.Unmarshal(b, &e)
		msg := e.Error.Message
		if msg == "" {
			msg = string(b)
		}
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, msg)
	}
	var r struct {
		Permissions []string `json:"permissions"`
	}
	json.Unmarshal(b, &r)
	return r.Permissions, nil
}

func toSet(ss []string) map[string]bool {
	m := map[string]bool{}
	for _, s := range ss {
		m[s] = true
	}
	return m
}

func b64j(v any) string {
	b, _ := json.Marshal(v)
	return base64.RawURLEncoding.EncodeToString(b)
}

func signRS256(pemKey, data string) (string, error) {
	block, _ := pem.Decode([]byte(pemKey))
	if block == nil {
		return "", fmt.Errorf("failed to decode PEM block from private_key")
	}
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("parse private key: %w", err)
	}
	rsaKey, ok := k.(*rsa.PrivateKey)
	if !ok {
		return "", fmt.Errorf("private key is not RSA")
	}
	h := sha256.New()
	h.Write([]byte(data))
	sig, err := rsa.SignPKCS1v15(rand.Reader, rsaKey, crypto.SHA256, h.Sum(nil))
	if err != nil {
		return "", fmt.Errorf("sign: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(sig), nil
}
