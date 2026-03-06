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
  teamMd: string
  bootstrapMd: string
}): string {
  const { teamSlug, namespace, teamMd, bootstrapMd } = input
  return generateConfigMap({
    name: `${teamSlug}-shared-config`,
    namespace,
    labels: { 'coordina.team': teamSlug },
    data: { 'TEAM.md': teamMd, 'BOOTSTRAP.md': bootstrapMd },
  })
}

export function generateAgentConfigMap(input: {
  teamSlug: string
  agentSlug: string
  namespace: string
  identityMd: string
  memoryMd: string
  soulMd: string
  skillsMd: string
  agentsMd: string
  openclawJson: string
}): string {
  const { teamSlug, agentSlug, namespace, identityMd, memoryMd, soulMd, skillsMd, agentsMd, openclawJson } = input
  return generateConfigMap({
    name: `${teamSlug}-${agentSlug}-config`,
    namespace,
    labels: { 'coordina.team': teamSlug, 'coordina.agent': agentSlug },
    data: { 'IDENTITY.md': identityMd, 'MEMORY.md': memoryMd, 'SOUL.md': soulMd, 'SKILLS.md': skillsMd, 'AGENTS.md': agentsMd, 'openclaw.json': openclawJson },
  })
}

export interface AgentManifestInput {
  teamSlug: string
  agentSlug: string
  image?: string
  namespace?: string
  credentialSecretName?: string
  cpu?: number
  podAnnotations?: Record<string, string>
}

export function generateAgentPv(input: { teamSlug: string; agentSlug: string; projectId: string; zone: string; diskGi?: number }): string {
  const { teamSlug, agentSlug, projectId, zone, diskGi = 10 } = input
  const name = `${teamSlug}-agent-${agentSlug}`
  const manifest = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: { name, labels: { 'coordina.team': teamSlug, 'coordina.agent': agentSlug } },
    spec: {
      capacity: { storage: `${diskGi}Gi` },
      accessModes: ['ReadWriteOnce'],
      persistentVolumeReclaimPolicy: 'Retain',
      storageClassName: '',
      csi: {
        driver: 'pd.csi.storage.gke.io',
        volumeHandle: `projects/${projectId}/zones/${zone}/disks/${name}`,
        fsType: 'ext4',
      },
      nodeAffinity: {
        required: {
          nodeSelectorTerms: [{ matchExpressions: [{ key: 'topology.kubernetes.io/zone', operator: 'In', values: [zone] }] }],
        },
      },
    },
  }
  return yaml.dump(manifest)
}

export function generateAgentPvc(input: { teamSlug: string; agentSlug: string; namespace: string; diskGi?: number }): string {
  const { teamSlug, agentSlug, namespace, diskGi = 10 } = input
  const name = `${teamSlug}-agent-${agentSlug}`
  const manifest = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { name, namespace, labels: { 'coordina.team': teamSlug, 'coordina.agent': agentSlug } },
    spec: {
      accessModes: ['ReadWriteOnce'],
      storageClassName: '',
      volumeName: name,
      resources: { requests: { storage: `${diskGi}Gi` } },
    },
  }
  return yaml.dump(manifest)
}

export function generateAgentStatefulSet(input: AgentManifestInput): string {
  const {
    teamSlug,
    agentSlug,
    image = 'alpine/openclaw:latest',
    namespace = 'default',
    credentialSecretName,
    cpu,
    podAnnotations,
  } = input
  const resourceName = `agent-${agentSlug}`
  const stateDir = '/agent-data/openclaw/state'
  const workspaceDir = '/agent-data/openclaw/workspace'

  const volumes: unknown[] = [
    { name: 'agent-data', persistentVolumeClaim: { claimName: `${teamSlug}-agent-${agentSlug}` } },
    { name: 'shared-config', configMap: { name: `${teamSlug}-shared-config` } },
    { name: 'agent-config', configMap: { name: `${teamSlug}-${agentSlug}-config` } },
  ]

  const containerVolumeMounts: unknown[] = [
    { name: 'agent-data', mountPath: '/agent-data' },
    { name: 'shared-config', mountPath: '/config/shared', readOnly: true },
    { name: 'agent-config', mountPath: '/config/agent', readOnly: true },
  ]

  const initSeedCmd = [
    `mkdir -p ${stateDir} ${workspaceDir}`,
    `test -f ${workspaceDir}/BOOTSTRAP.md || cp /config/shared/BOOTSTRAP.md ${workspaceDir}/BOOTSTRAP.md`,
    `cp /config/shared/TEAM.md ${workspaceDir}/TEAM.md`,
    `cp /config/agent/IDENTITY.md ${workspaceDir}/IDENTITY.md`,
    `test -f ${workspaceDir}/MEMORY.md || cp /config/agent/MEMORY.md ${workspaceDir}/MEMORY.md`,
    `test -f ${workspaceDir}/SOUL.md || cp /config/agent/SOUL.md ${workspaceDir}/SOUL.md`,
    `test -f ${workspaceDir}/SKILLS.md || cp /config/agent/SKILLS.md ${workspaceDir}/SKILLS.md`,
    `cp /config/agent/AGENTS.md ${workspaceDir}/AGENTS.md`,
    `cp /config/agent/openclaw.json ${stateDir}/openclaw.json`,
    'chown -R 1000:1000 /agent-data/openclaw',
    'chmod -R u+rwX,g+rwX /agent-data/openclaw',
  ].join(' && ')

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
        metadata: {
          labels: { app: resourceName, 'coordina.team': teamSlug },
          ...(podAnnotations ? { annotations: podAnnotations } : {}),
        },
        spec: {
          securityContext: {
            fsGroup: 1000,
            fsGroupChangePolicy: 'OnRootMismatch',
          },
          volumes,
          initContainers: [{
            name: 'bootstrap-init',
            image: 'busybox:1.36',
            command: ['sh', '-c', initSeedCmd],
            volumeMounts: [
              { name: 'agent-data', mountPath: '/agent-data' },
              { name: 'shared-config', mountPath: '/config/shared', readOnly: true },
              { name: 'agent-config', mountPath: '/config/agent', readOnly: true },
            ],
          }],
          containers: [{
            name: 'openclaw',
            image,
            ports: [{ containerPort: 18789, name: 'gateway' }],
            env: [
              { name: 'OPENCLAW_WORKSPACE_DIR', value: workspaceDir },
              { name: 'OPENCLAW_STATE_DIR', value: stateDir },
            ],
            ...(credentialSecretName ? { envFrom: [{ secretRef: { name: credentialSecretName } }] } : {}),
            volumeMounts: containerVolumeMounts,
            resources: { requests: { cpu: `${cpu ?? 1}` }, limits: { cpu: `${cpu ?? 1}` } },
            readinessProbe: {
              exec: { command: ['node', '-e', "const s=require('net').createConnection(18789,'127.0.0.1',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1))"] },
              initialDelaySeconds: 15,
              periodSeconds: 10,
              failureThreshold: 3,
            },
            livenessProbe: {
              exec: { command: ['node', '-e', "const s=require('net').createConnection(18789,'127.0.0.1',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1))"] },
              initialDelaySeconds: 30,
              periodSeconds: 20,
              failureThreshold: 3,
            },
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
    metadata: {
      name: resourceName,
      namespace,
      annotations: {
        // Required by GCE Ingress for ClusterIP backends.
        'cloud.google.com/neg': '{"ingress": true}',
      },
    },
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
