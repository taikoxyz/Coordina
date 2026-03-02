import { registerEnvironment } from '../base'
import { deployTeam, undeployTeam, getTeamStatus } from './deploy'
import type { GkeDeployConfig } from './deploy'

registerEnvironment({
  id: 'gke',
  displayName: 'Google Kubernetes Engine (GKE)',
  configSchema: {
    type: 'object',
    required: ['projectId', 'clusterName', 'clusterZone'],
    properties: {
      projectId: { type: 'string', title: 'GCP Project ID' },
      clusterName: { type: 'string', title: 'Cluster Name' },
      clusterZone: { type: 'string', title: 'Cluster Zone', description: 'e.g. us-central1-a' },
      domain: { type: 'string', title: 'Base Domain', description: 'e.g. example.com' },
    },
  },
  validate(config: unknown) {
    const c = config as { projectId?: string; clusterName?: string; clusterZone?: string }
    const errors: string[] = []
    if (!c.projectId) errors.push('GCP Project ID is required')
    if (!c.clusterName) errors.push('Cluster Name is required')
    if (!c.clusterZone) errors.push('Cluster Zone is required')
    return errors.length ? { valid: false, errors } : { valid: true }
  },
  async deploy(teamSlug: string, config: unknown) {
    const c = config as GkeDeployConfig & { agents: { slug: string }[] }
    return deployTeam(teamSlug, c.agents ?? [], c)
  },
  async undeploy(teamSlug: string, config: unknown) {
    return undeployTeam(teamSlug, config as GkeDeployConfig)
  },
  async getStatus(teamSlug: string, config: unknown) {
    const c = config as GkeDeployConfig & { agentSlugs: string[] }
    return getTeamStatus(teamSlug, c.agentSlugs ?? [], c)
  },
})
