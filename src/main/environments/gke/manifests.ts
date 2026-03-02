import yaml from 'js-yaml'

export interface AgentManifestInput {
  teamSlug: string
  agentSlug: string
  image?: string
  storageGi?: number
  namespace?: string
}

export function generateAgentStatefulSet(input: AgentManifestInput): string {
  const { teamSlug, agentSlug, image = 'openclaw/openclaw:latest', storageGi = 10, namespace = 'default' } = input
  const pvcName = `workspace-${teamSlug}-${agentSlug}`

  const manifest = {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: {
      name: agentSlug,
      namespace,
      labels: { 'coordina.team': teamSlug, 'coordina.agent': agentSlug },
    },
    spec: {
      selector: { matchLabels: { app: agentSlug } },
      serviceName: agentSlug,
      replicas: 1,
      template: {
        metadata: { labels: { app: agentSlug, 'coordina.team': teamSlug } },
        spec: {
          containers: [{
            name: 'openclaw',
            image,
            ports: [{ containerPort: 18789, name: 'gateway' }],
            volumeMounts: [{ name: pvcName, mountPath: '/workspace' }],
          }],
        },
      },
      volumeClaimTemplates: [{
        metadata: { name: pvcName },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: `${storageGi}Gi` } },
        },
      }],
    },
  }

  return yaml.dump(manifest)
}

export function generateAgentService(input: { teamSlug: string; agentSlug: string; namespace?: string }): string {
  const { agentSlug, namespace = 'default' } = input
  const manifest = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: agentSlug, namespace },
    spec: {
      selector: { app: agentSlug },
      ports: [{ port: 18789, targetPort: 18789, name: 'gateway' }],
      type: 'ClusterIP',
    },
  }
  return yaml.dump(manifest)
}

export interface IapBackendConfigInput {
  teamSlug: string
  namespace?: string
  oauthSecretName?: string
}

export function generateIapBackendConfig(input: IapBackendConfigInput): string {
  const { teamSlug, namespace = 'default', oauthSecretName = 'iap-oauth-secret' } = input
  const manifest = {
    apiVersion: 'cloud.google.com/v1',
    kind: 'BackendConfig',
    metadata: { name: `${teamSlug}-backend-config`, namespace },
    spec: {
      iap: {
        enabled: true,
        oauthclientCredentials: { secretName: oauthSecretName },
      },
    },
  }
  return yaml.dump(manifest)
}

export function generateIngress(input: {
  teamSlug: string
  agents: string[]
  domain: string
  namespace?: string
}): string {
  const { teamSlug, agents, domain, namespace = 'default' } = input
  const paths = agents.map(slug => ({
    path: `/agents/${slug}(/|$)(.*)`,
    pathType: 'ImplementationSpecific',
    backend: { service: { name: slug, port: { number: 18789 } } },
  }))

  const manifest = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: `${teamSlug}-ingress`,
      namespace,
      annotations: {
        'kubernetes.io/ingress.class': 'gce',
        'networking.gke.io/managed-certificates': `${teamSlug}-cert`,
        'beta.cloud.google.com/backend-config': JSON.stringify({ default: `${teamSlug}-backend-config` }),
      },
    },
    spec: {
      rules: [{
        host: `${teamSlug}.${domain}`,
        http: { paths },
      }],
    },
  }
  return yaml.dump(manifest)
}
