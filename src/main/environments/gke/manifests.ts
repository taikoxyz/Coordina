import yaml from 'js-yaml'

export function generateNamespace(name: string): string {
  return yaml.dump({ apiVersion: 'v1', kind: 'Namespace', metadata: { name } })
}

export interface ConfigMapInput {
  name: string
  namespace: string
  labels?: Record<string, string>
  data: Record<string, string>
}

function indentBlock(content: string, spaces: number): string {
  const indent = ' '.repeat(spaces)
  const normalized = content.replace(/\n$/, '')
  return normalized.split('\n').map(line => (line ? indent + line : '')).join('\n')
}

export function generateConfigMap(input: ConfigMapInput): string {
  const { name, namespace, labels, data } = input
  const metadata: Record<string, unknown> = { name, namespace }
  if (labels && Object.keys(labels).length > 0) {
    metadata.labels = labels
  }
  const dataEntries = Object.entries(data)
    .map(([key, value]) => `  ${key}: |\n${indentBlock(value, 4)}`)
    .join('\n')
  const labelsBlock = metadata.labels
    ? `  labels:\n${Object.entries(metadata.labels as Record<string, string>).map(([k, v]) => `    ${k}: ${v}`).join('\n')}\n`
    : ''
  return `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${name}\n  namespace: ${namespace}\n${labelsBlock}data:\n${dataEntries}\n`
}

export function generateTeamConfigMap(input: {
  teamSlug: string
  namespace: string
  teamJson: string
  agentsMd: string
  bootstrapInstructionsMd: string
}): string {
  const { teamSlug, namespace, teamJson, agentsMd, bootstrapInstructionsMd } = input
  return generateConfigMap({
    name: `${teamSlug}-shared-config`,
    namespace,
    labels: { 'coordina.team': teamSlug },
    data: { 'team.json': teamJson, 'AGENTS.md': agentsMd, 'BOOTSTRAP-INSTRUCTIONS.md': bootstrapInstructionsMd },
  })
}

export function generateAgentConfigMap(input: {
  teamSlug: string
  agentSlug: string
  namespace: string
  agentJson: string
  identityMd: string
  soulMd: string
  skillsMd: string
  openclawJson: string
}): string {
  const { teamSlug, agentSlug, namespace, agentJson, identityMd, soulMd, skillsMd, openclawJson } = input
  return generateConfigMap({
    name: `${teamSlug}-${agentSlug}-config`,
    namespace,
    labels: { 'coordina.team': teamSlug, 'coordina.agent': agentSlug },
    data: {
      'agent.json': agentJson,
      'IDENTITY.md': identityMd,
      'SOUL.md': soulMd,
      'SKILLS.md': skillsMd,
      'openclaw.json': openclawJson,
    },
  })
}

export interface AgentManifestInput {
  teamSlug: string
  agentSlug: string
  image?: string
  namespace?: string
  projectId?: string
  zone?: string
}

export function generateAgentPv(input: { teamSlug: string; agentSlug: string; projectId: string; zone: string; storageGi?: number }): string {
  const { teamSlug, agentSlug, projectId, zone, storageGi = 10 } = input
  const name = `team-${teamSlug}-${agentSlug}`
  const manifest = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: { name },
    spec: {
      capacity: { storage: `${storageGi}Gi` },
      accessModes: ['ReadWriteOnce'],
      persistentVolumeReclaimPolicy: 'Retain',
      csi: {
        driver: 'pd.csi.storage.gke.io',
        volumeHandle: `projects/${projectId}/zones/${zone}/disks/${name}`,
        fsType: 'ext4',
      },
      nodeAffinity: {
        required: {
          nodeSelectorTerms: [{
            matchExpressions: [{
              key: 'topology.kubernetes.io/zone',
              operator: 'In',
              values: [zone],
            }],
          }],
        },
      },
    },
  }
  return yaml.dump(manifest)
}

export function generateAgentPvc(input: { teamSlug: string; agentSlug: string; namespace?: string; storageGi?: number }): string {
  const { teamSlug, agentSlug, namespace = 'default', storageGi = 10 } = input
  const name = `team-${teamSlug}-${agentSlug}`
  const manifest = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { name, namespace },
    spec: {
      accessModes: ['ReadWriteOnce'],
      storageClassName: '',
      volumeName: name,
      resources: { requests: { storage: `${storageGi}Gi` } },
    },
  }
  return yaml.dump(manifest)
}

export function generateAgentStatefulSet(input: AgentManifestInput): string {
  const { teamSlug, agentSlug, image = 'alpine/openclaw:latest', namespace = 'default' } = input
  const resourceName = `agent-${agentSlug}`
  const pvcName = `team-${teamSlug}-${agentSlug}`

  const manifest = {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: {
      name: resourceName,
      namespace,
      labels: { 'coordina.team': teamSlug, 'coordina.agent': agentSlug },
    },
    spec: {
      selector: { matchLabels: { app: resourceName } },
      serviceName: resourceName,
      replicas: 1,
      template: {
        metadata: { labels: { app: resourceName, 'coordina.team': teamSlug } },
        spec: {
          volumes: [
            { name: 'workspace', persistentVolumeClaim: { claimName: pvcName } },
            { name: 'shared-config', configMap: { name: `${teamSlug}-shared-config` } },
            { name: 'agent-config', configMap: { name: `${teamSlug}-${agentSlug}-config` } },
          ],
          initContainers: [{
            name: 'bootstrap-init',
            image: 'busybox:1.36',
            command: ['sh', '-c', 'test -f /workspace/BOOTSTRAP.md || cp /config/shared/BOOTSTRAP-INSTRUCTIONS.md /workspace/BOOTSTRAP.md'],
            volumeMounts: [
              { name: 'workspace', mountPath: '/workspace' },
              { name: 'shared-config', mountPath: '/config/shared', readOnly: true },
            ],
          }],
          containers: [{
            name: 'openclaw',
            image,
            ports: [{ containerPort: 18789, name: 'gateway' }],
            volumeMounts: [
              { name: 'workspace', mountPath: '/workspace' },
              { name: 'shared-config', mountPath: '/config/shared', readOnly: true },
              { name: 'agent-config', mountPath: '/config/agent', readOnly: true },
            ],
          }],
        },
      },
    },
  }

  return yaml.dump(manifest)
}

export function generateAgentService(input: { teamSlug: string; agentSlug: string; namespace?: string }): string {
  const { agentSlug, namespace = 'default' } = input
  const resourceName = `agent-${agentSlug}`
  const manifest = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: resourceName, namespace },
    spec: {
      selector: { app: resourceName },
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
    path: `/agents/${slug}`,
    pathType: 'Prefix',
    backend: { service: { name: `agent-${slug}`, port: { number: 18789 } } },
  }))

  const manifest = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: `${teamSlug}-ingress`,
      namespace,
      annotations: { 'kubernetes.io/ingress.class': 'gce' },
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
