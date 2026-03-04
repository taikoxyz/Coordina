# GKE Authentication Options — Comparison & Recommendation

> Status: March 2026
> Context: How the Coordina macOS app authenticates to a user's GKE cluster
>          to deploy and manage OpenClaw agent teams.

---

## The Question

When Coordina needs to deploy a team to GKE (apply Helm charts, create pods, read Secrets), and when it needs to reach each agent's OpenClaw gateway — how should it authenticate? Two primary options and one emerging option were evaluated.

---

## Option A: Google OAuth

### How it works

The user signs in via a standard Google OAuth browser flow. Coordina receives a short-lived OAuth access token (1 hour) and a refresh token. When calling the GKE API (to apply Kubernetes resources), Coordina uses the access token. The GKE API verifies it against the user's Google identity and checks IAM permissions.

Modern GKE uses `gke-gcloud-auth-plugin` (introduced in GKE v1.26) as the credential plugin standard — all major kubectl-compatible tools (Lens, k9s, Helm) use this under the hood.

### IAM roles required

| Minimum | Admin access |
|---------|-------------|
| `roles/container.developer` | `roles/container.admin` |
| `container.clusters.getCredentials` permission | (includes developer permissions) |

Namespace-level restrictions are applied separately via Kubernetes RBAC after authentication.

### Token lifecycle

- Access tokens: expire in 1 hour
- Refresh tokens: subject to Google Cloud session length policies; auto-refreshed by the auth plugin
- Known issue: iCloud Keychain sync on macOS can cause token staleness — mitigated by explicit refresh before use

### Security

| Property | Assessment |
|----------|-----------|
| Credential lifetime | Short-lived (1 hour); no long-lived secrets on disk |
| Audit trail | Individual Google identity in Cloud Audit Logs |
| MFA support | Yes — respects user's Google Account MFA settings |
| Revocation | Revoke via Google Admin Console (immediate effect) |
| Offline operation | Requires internet for token refresh |
| Org policy restrictions | May be restricted by Google Workspace domain policies |

### User experience

1. User clicks "Connect GKE Environment" in Coordina
2. Browser opens for Google sign-in
3. User authenticates (with MFA if configured)
4. Coordina stores refresh token in OS keychain
5. All subsequent GKE API calls are transparent — no interaction needed

---

## Option B: Service Account JSON Key

### How it works

An admin creates a GCP service account, assigns it IAM roles, generates a JSON key file containing a private RSA key, and uploads it to Coordina. Coordina reads the private key to self-sign JWTs, exchanges them for short-lived OAuth access tokens, and uses those to call the GKE API.

### IAM roles required

Same as OAuth: `roles/container.developer` at minimum, `roles/container.admin` for full management.

### Token lifecycle

- The JSON key itself never expires — it must be manually rotated
- Access tokens derived from the key: 1 hour
- GCP recommends rotation every 90 days maximum; it's easy to let this slip

### Security

| Property | Assessment |
|----------|-----------|
| Credential lifetime | Key never expires — permanent credential risk if leaked |
| Audit trail | Service account identity in logs, not individual user |
| MFA support | N/A — no user identity |
| Revocation | Delete key in GCP console; takes effect immediately |
| Offline operation | Works offline after initial key load |
| Org policy restrictions | `constraints/iam.disableServiceAccountKeyCreation` can block this at org level |
| GCP stance (2026) | Strongly discouraged; not formally deprecated but Google auto-disables leaked keys |

> GCP documentation (2026): *"Avoid user-managed service account keys whenever possible."*

### User experience

1. Admin creates service account in GCP console (manual step outside Coordina)
2. Admin generates JSON key (manual step)
3. Admin shares key file with team members (security risk point)
4. User uploads JSON file in Coordina's environment setup wizard
5. Coordina stores the key in OS keychain / encrypted app storage
6. No repeated interaction needed — key works until manually rotated

---

## Option C: Workload Identity Federation (Keyless)

### How it works

WIF allows non-Google workloads to authenticate to GCP by presenting credentials from an external identity provider (IdP). The GCP-side WIF pool is configured to trust that IdP; the workload exchanges its local credentials for short-lived GCP tokens.

### Relevance for a macOS desktop app

WIF is well-suited for CI/CD runners (GitHub Actions, GitLab, Jenkins) and server workloads. For a desktop app:
- Requires configuring an OIDC pool on GCP
- Requires the macOS app to act as or integrate with a trusted OIDC provider
- No ready-made macOS OIDC identity provider (would require certificate-based device identity or a custom IdP)
- High setup complexity with limited payoff vs. Google OAuth

**Verdict**: Not recommended for the default Coordina flow. Viable for large enterprises with managed device fleets and an internal OIDC provider.

---

## Comparison Summary

| Factor | Google OAuth | Service Account JSON | Workload Identity |
|--------|-------------|---------------------|-------------------|
| **Security posture** | Excellent | Poor–Fair | Excellent |
| **Credential lifetime** | 1 hour | Never expires | 1 hour |
| **Key rotation burden** | None | Every 90 days | None |
| **GCP recommended** | Yes (primary) | Discouraged | Yes (CI/CD) |
| **User experience** | One-click login | Multi-step manual | Complex setup |
| **Individual audit trail** | Yes | No (SA identity) | Depends |
| **MFA enforcement** | Yes | No | Depends |
| **Offline operation** | No | Yes | No |
| **Desktop app fit** | Excellent | Fair | Poor |
| **Org policy risks** | Domain/session policies | Key creation may be blocked | Pool config required |

---

## Recommendation

### Primary: Google OAuth

Google OAuth is the correct default for Coordina. It is what every major kubectl-compatible tool uses, it is Google's recommended path, and it provides the best security posture with the simplest user experience.

**Implementation notes**:
- Use `gke-gcloud-auth-plugin` binary for kubeconfig credential management (standard since GKE v1.26)
- Explicitly validate and refresh tokens before use (don't rely on iCloud Keychain sync)
- Store refresh tokens in macOS Keychain with explicit protection class

### Secondary: Service Account JSON

Offer as an option for users who:
- Have automated workflows that cannot use interactive OAuth
- Work in environments where Google Workspace OAuth policies are restrictive
- Prefer not to link a personal Google account to the cluster

Show a clear warning in the UI about the credential risks and link to GCP's rotation guidance.

**Never store the JSON key file as-is on disk.** Extract and store the private key in the OS keychain.

---

## Gateway Access: Tying GKE Auth to OpenClaw Gateway

This is the elegant part. Rather than managing a separate auth layer for the OpenClaw gateway, Coordina can use **Google Cloud Identity-Aware Proxy (IAP)** on the GKE Ingress.

### How IAP gates gateway access

```
Coordina macOS App
  │
  ├─ Authenticates via Google OAuth (same account as GKE auth)
  │  → Holds a Google ID token
  │
  ├─ HTTP request to: https://<team-slug>.<env-domain>/
  │  Header: Authorization: Bearer <google-id-token>
  │
  ▼
Google Cloud Load Balancer (GKE Ingress)
  │
  ├─ IAP verifies ID token
  ├─ IAP checks: user has IAP-secured Web App User role
  │
  ▼  (only authenticated, authorized requests pass through)
OpenClaw Gateway Pod (:18789)
```

**Net effect**: A user cannot reach any OpenClaw gateway on the cluster unless they are:
1. Authenticated with a valid Google account
2. Granted the `IAP-secured Web App User` IAM role for that resource

**This means**: GKE cluster authentication and gateway access are the same credential — the user's Google account. No gateway tokens need to be managed separately by Coordina.

### IAP configuration (generated by Coordina in Helm values)

```yaml
# BackendConfig — applied to the lead agent's Service
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: team-iap-config
spec:
  iap:
    enabled: true
    oauthclientCredentials:
      secretName: iap-oauth-credentials  # client_id + client_secret
```

```yaml
# Service — annotated to use BackendConfig
apiVersion: v1
kind: Service
metadata:
  name: lead-agent-svc
  annotations:
    beta.cloud.google.com/backend-config: '{"default": "team-iap-config"}'
spec:
  selector:
    app: agent-alice
  ports:
    - port: 80
      targetPort: 18789
  type: ClusterIP
```

### Auth flow summary

| Step | What happens |
|------|-------------|
| 1 | User logs into Coordina with Google OAuth |
| 2 | Coordina stores Google ID token in OS keychain |
| 3 | All gateway requests include the ID token as a Bearer header |
| 4 | IAP verifies token and IAM role before forwarding to gateway |
| 5 | OpenClaw gateway receives only pre-authenticated requests |
| 6 | No separate gateway token management by Coordina |

### Deployment environment setup wizard — additional step

When adding a GKE environment, Coordina must:
1. Create or import an OAuth client (or prompt the admin to create one in GCP console)
2. Store `client_id` and `client_secret` as a K8s Secret (`iap-oauth-credentials`) in the cluster
3. Enable IAP on the GCP project

This is a one-time per-environment setup step that the wizard handles.

---

## Sources

- [GKE API Server Authentication](https://cloud.google.com/kubernetes-engine/docs/how-to/api-server-authentication)
- [Best Practices for Managing Service Account Keys](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
- [Enabling IAP for GKE](https://cloud.google.com/iap/docs/enabling-kubernetes-howto)
- [Identity-Aware Proxy Overview](https://cloud.google.com/iap/docs/concepts-overview)
- [GKE Networking Recipes — IAP](https://github.com/GoogleCloudPlatform/gke-networking-recipes/tree/main/ingress/single-cluster/ingress-iap)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [kubectl Auth Changes in GKE v1.26](https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke)
- [OpenClaw K8s Operator](https://github.com/openclaw-rocks/k8s-operator)
- [OpenClaw Gateway Security](https://docs.openclaw.ai/gateway/security)
