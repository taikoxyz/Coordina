package gcp

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
	"time"
)

var (
	gcloudMu      sync.Mutex
	activeSession *gcloudSession
)

type gcloudSession struct {
	url   string
	stdin io.WriteCloser
	cmd   *exec.Cmd
}

// GCloudBegin spawns gcloud auth login --no-browser, extracts the auth URL.
// If a session is already active, returns the existing URL.
func GCloudBegin() (string, error) {
	gcloudMu.Lock()
	defer gcloudMu.Unlock()

	if activeSession != nil {
		return activeSession.url, nil
	}

	cmd := exec.Command("gcloud", "auth", "login", "--no-browser", "--force")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return "", fmt.Errorf("gcloud stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("gcloud stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", fmt.Errorf("gcloud stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("gcloud not found or failed to start: %w", err)
	}

	urlCh := make(chan string, 1)
	scanForURL := func(r io.Reader) {
		s := bufio.NewScanner(r)
		for s.Scan() {
			line := strings.TrimSpace(s.Text())
			if strings.HasPrefix(line, "gcloud auth login --remote-bootstrap=") {
				select {
				case urlCh <- line:
				default:
				}
			}
		}
	}
	go scanForURL(stdout)
	go scanForURL(stderr)

	select {
	case url := <-urlCh:
		activeSession = &gcloudSession{url: url, stdin: stdin, cmd: cmd}
		return url, nil
	case <-time.After(20 * time.Second):
		cmd.Process.Kill()
		return "", fmt.Errorf("timeout waiting for gcloud auth URL")
	}
}

// GCloudSubmit sends the verification code to the waiting subprocess.
func GCloudSubmit(code string) error {
	gcloudMu.Lock()
	sess := activeSession
	gcloudMu.Unlock()

	if sess == nil {
		return fmt.Errorf("no active login session — click Sign in first")
	}

	if _, err := fmt.Fprintln(sess.stdin, code); err != nil {
		return fmt.Errorf("writing code to gcloud: %w", err)
	}
	sess.stdin.Close()
	sess.cmd.Wait()

	gcloudMu.Lock()
	activeSession = nil
	gcloudMu.Unlock()

	if !GCloudIsAuthenticated() {
		return fmt.Errorf("authentication failed — check your code and try again")
	}
	return nil
}

// GCloudIsAuthenticated checks whether gcloud has an active account.
func GCloudIsAuthenticated() bool {
	out, err := exec.Command("gcloud", "auth", "list",
		"--filter=status:ACTIVE", "--format=value(account)").Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) != ""
}

// GCloudGetEmail returns the active gcloud account email.
func GCloudGetEmail() string {
	out, _ := exec.Command("gcloud", "auth", "list",
		"--filter=status:ACTIVE", "--format=value(account)").Output()
	return strings.TrimSpace(string(out))
}

// GCloudGetAccessToken prints and returns the current access token.
func GCloudGetAccessToken() (string, error) {
	out, err := exec.Command("gcloud", "auth", "print-access-token").Output()
	if err != nil {
		return "", fmt.Errorf("gcloud print-access-token: %w", err)
	}
	token := strings.TrimSpace(string(out))
	if token == "" {
		return "", fmt.Errorf("empty access token from gcloud")
	}
	return token, nil
}

// GCloudRevoke revokes all gcloud accounts.
func GCloudRevoke() {
	exec.Command("gcloud", "auth", "revoke", "--all", "--quiet").Run()
}
