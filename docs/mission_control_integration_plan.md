# Mission Control Integration Plan

Deploy Mission Control as a pod inside the same GKE cluster as your Coordina-managed agents, connecting to each agent via Kubernetes internal DNS — bypassing Google IAP entirely.

---

## Overview

**Goal:** Run Mission Control (MC) as a GKE pod alongside your Coordina-deployed OpenClaw agents. MC gains a Kanban task board, token/cost tracking, real-time logs, heartbeat monitoring, and inter-agent messaging on top of your existing team.

**Why inside the cluster:** Coordina exposes agents to the internet behind Google IAP. Mission Control expects direct WebSocket access to OpenClaw gateways at port `18789` — no IAP-aware client auth. By deploying MC inside the same GKE namespace, it reaches each agent via Kubernetes internal DNS (`{agentSlug}.{namespace}.svc.cluster.local:18789`) without traversing the Ingress or IAP at all.

```
Internet
  └── IAP Ingress → agents (for human use via Coordina)
                                  ↑
Cluster-internal                  │  ClusterIP Services
  Mission Control Pod ────────────┘  (direct, no IAP)
```

---

## Prerequisites

- GKE cluster with at least one Coordina team deployed and agents in `Running` state
- Access to GCR or Artifact Registry in your GCP project
- `kubectl` configured pointing at the target cluster (`gcloud container clusters get-credentials ...`)
- `docker` with access to push to your registry
- Mission Control source: `git clone https://github.com/builderz-labs/mission-control`
- The namespace your agents run in (check with `kubectl get pods -A | grep <team-slug>`)

---

## Step 1 — Build and Push the Mission Control Image

```bash
cd /path/to/mission-control

# Replace PROJECT_ID with your GCP project
docker build -t gcr.io/PROJECT_ID/mission-control:latest .
docker push gcr.io/PROJECT_ID/mission-control:latest
```

If using Artifact Registry instead of GCR:
```bash
docker build -t REGION-docker.pkg.dev/PROJECT_ID/REPO/mission-control:latest .
docker push REGION-docker.pkg.dev/PROJECT_ID/REPO/mission-control:latest
```

---

## Step 2 — Create the Kubernetes Secret

MC reads all configuration from environment variables. Create a Secret in the **same namespace** as your agents:

```bash
kubectl create secret generic mission-control-env \
  --namespace=AGENT_NAMESPACE \
  --from-literal=MC_ADMIN_PASSWORD='<strong-password>' \
  --from-literal=MC_SESSION_SECRET='<random-32-chars>' \
  --from-literal=API_KEY='<api-key-for-registration-calls>' \
  --from-literal=OPENCLAW_GATEWAY_HOST='LEAD_AGENT_SLUG.AGENT_NAMESPACE.svc.cluster.local' \
  --from-literal=OPENCLAW_GATEWAY_PORT='18789' \
  --from-literal=OPENCLAW_GATEWAY_TOKEN='' \
  --from-literal=NEXT_PUBLIC_GATEWAY_HOST='mc.YOUR_DOMAIN' \
  --from-literal=NEXT_PUBLIC_GATEWAY_PORT='443' \
  --from-literal=NEXT_PUBLIC_GATEWAY_PROTOCOL='wss' \
  --from-literal=MC_CLAUDE_HOME=''
```

- `LEAD_AGENT_SLUG` — slug of the team's lead agent (check Coordina → Team → Agents, the agent marked as Lead)
- `AGENT_NAMESPACE` — the Kubernetes namespace Coordina deployed agents into
- `mc.YOUR_DOMAIN` — the subdomain you'll expose MC on (e.g. `mc.mycompany.com`)

---

## Step 3 — Create a PersistentVolumeClaim for MC Data

MC stores its SQLite database at `/app/.data/`. Without a PVC, data is lost on pod restarts.

```yaml
# k8s/mission-control/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mission-control-data
  namespace: AGENT_NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard-rwo
```

```bash
kubectl apply -f k8s/mission-control/pvc.yaml
```

---

## Step 4 — Write the Deployment Manifest

```yaml
# k8s/mission-control/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mission-control
  namespace: AGENT_NAMESPACE
  labels:
    app: mission-control
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mission-control
  template:
    metadata:
      labels:
        app: mission-control
    spec:
      containers:
        - name: mission-control
          image: gcr.io/PROJECT_ID/mission-control:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: mission-control-env
          volumeMounts:
            - name: data
              mountPath: /app/.data
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: mission-control-data
```

```bash
kubectl apply -f k8s/mission-control/deployment.yaml
```

---

## Step 5 — Create a ClusterIP Service

```yaml
# k8s/mission-control/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mission-control
  namespace: AGENT_NAMESPACE
spec:
  selector:
    app: mission-control
  ports:
    - name: http
      port: 3000
      targetPort: 3000
```

```bash
kubectl apply -f k8s/mission-control/service.yaml
```

---

## Step 6 — Expose MC via IAP-gated Ingress

Reuse the same pattern Coordina uses for agent Ingresses. This gives your team secure HTTPS access to the MC dashboard from outside the cluster.

```yaml
# k8s/mission-control/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mission-control
  namespace: AGENT_NAMESPACE
  annotations:
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.allow-http: "false"
    networking.gke.io/managed-certificates: "mission-control-cert"
    networking.gke.io/v1beta1.FrontendConfig: "mission-control-frontend"
spec:
  rules:
    - host: mc.YOUR_DOMAIN
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mission-control
                port:
                  number: 3000
---
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: mission-control-cert
  namespace: AGENT_NAMESPACE
spec:
  domains:
    - mc.YOUR_DOMAIN
---
# Optional: add BackendConfig for IAP (same as Coordina agent BackendConfig)
# If you skip IAP here, MC's own session auth is the only gate.
```

Point `mc.YOUR_DOMAIN` at your cluster's static IP (same IP used by Coordina's agent Ingress).

```bash
kubectl apply -f k8s/mission-control/ingress.yaml
```

---

## Step 7 — Register All Agents with Mission Control

Once the MC pod is `Running`, register each agent. The primary gateway (lead agent) was already set via the Secret. Add each non-lead agent as a separate gateway:

```bash
MC_URL="https://mc.YOUR_DOMAIN"
API_KEY="<your-api-key>"
NAMESPACE="AGENT_NAMESPACE"

# Register additional gateways for non-lead agents
for AGENT_SLUG in bob carol dave; do
  curl -s -X POST "$MC_URL/api/gateways" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$AGENT_SLUG\",
      \"host\": \"$AGENT_SLUG.$NAMESPACE.svc.cluster.local\",
      \"port\": 18789
    }"
done

# Register agent records (links agents to gateways)
for AGENT_SLUG in alice bob carol dave; do
  curl -s -X POST "$MC_URL/api/agents" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$AGENT_SLUG\",
      \"status\": \"active\"
    }"
done
```

Find your agent slugs in Coordina's UI (Team → Agents list) or in the local SQLite:
```bash
sqlite3 ~/Library/Application\ Support/coordina/coordina.db \
  "SELECT slug, name, is_lead FROM agents WHERE team_slug = 'YOUR_TEAM_SLUG';"
```

A helper script at `scripts/register-agents-with-mc.sh` can automate this once you have agent slugs — no Coordina code changes required.

---

## Step 8 — Set Up Heartbeats (Optional but Recommended)

OpenClaw agents don't natively ping Mission Control. A lightweight CronJob polls each agent and relays status:

```yaml
# k8s/mission-control/heartbeat-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: agent-heartbeat-relay
  namespace: AGENT_NAMESPACE
spec:
  schedule: "*/1 * * * *"   # every minute
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: heartbeat
              image: curlimages/curl:latest
              command:
                - /bin/sh
                - -c
                - |
                  for AGENT_ID in AGENT_ID_1 AGENT_ID_2 AGENT_ID_3; do
                    curl -s -X POST "http://mission-control:3000/api/agents/$AGENT_ID/heartbeat" \
                      -H "x-api-key: $API_KEY"
                  done
              env:
                - name: API_KEY
                  valueFrom:
                    secretKeyRef:
                      name: mission-control-env
                      key: API_KEY
```

Replace `AGENT_ID_*` with the numeric IDs returned when you registered agents in Step 7.

---

## Verification Checklist

- [ ] `kubectl get pods -n AGENT_NAMESPACE` — `mission-control-*` pod is `Running`
- [ ] `https://mc.YOUR_DOMAIN` loads the MC login page
- [ ] Login with `admin` / `MC_ADMIN_PASSWORD` succeeds
- [ ] **Agents panel** shows all team agents with `active` status
- [ ] **Gateways panel** shows one gateway per non-lead agent
- [ ] **Kanban board** loads (initially empty — tasks created manually or via API)
- [ ] **Token usage panel** populates after an agent session runs
- [ ] **Logs panel** shows live events from a running agent WebSocket session

---

## Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| MC connects to agents without IAP auth | Agents reachable cluster-internally without IAP | Acceptable — internal pod-to-pod, no internet exposure |
| No automatic agent discovery | Manual gateway/agent registration required | Use `register-agents-with-mc.sh` script after each Coordina deploy |
| Heartbeats not native to OpenClaw | MC shows agents as "missing" without CronJob | Deploy heartbeat CronJob (Step 8) |
| Single MC instance per cluster | All teams share one MC | Register gateways per team; MC multi-gateway supports this |
| SQLite storage (not HA) | Single pod, single replica | Sufficient for operator use; add Litestream replication for HA if needed |

---

## Multi-Team Support

For each additional Coordina team deployed to the same cluster, repeat Steps 7–8:
- Register the new team's lead agent as an additional gateway (`/api/gateways`)
- Register each agent in that team (`/api/agents`)
- Update the heartbeat CronJob to include the new agent IDs

All teams share one Mission Control instance.
