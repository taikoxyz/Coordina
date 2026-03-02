package gcp

import "net/url"

const workspaceScopes = "https://www.googleapis.com/auth/admin.directory.user " +
	"https://www.googleapis.com/auth/admin.directory.group " +
	"https://www.googleapis.com/auth/drive " +
	"https://www.googleapis.com/auth/calendar " +
	"https://www.googleapis.com/auth/gmail.modify " +
	"https://www.googleapis.com/auth/userinfo.email " +
	"openid"

func WorkspaceAuthURL(clientID, redirectBase, state string) string {
	return "https://accounts.google.com/o/oauth2/v2/auth?" + url.Values{
		"client_id":     {clientID},
		"redirect_uri":  {redirectBase + "/api/auth/workspace/callback"},
		"response_type": {"code"},
		"scope":         {workspaceScopes},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
		"state":         {state},
	}.Encode()
}

func WorkspaceExchange(clientID, clientSecret, redirectBase, code string) (*OAuthTokens, error) {
	return exchangeCode(clientID, clientSecret, redirectBase+"/api/auth/workspace/callback", code)
}
