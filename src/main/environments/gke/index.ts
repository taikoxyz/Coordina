// GKE environment registration for the DeploymentEnvironment registry
// FEATURE: GKE deployment environment registration using async K8s API
import { registerEnvironment } from '../base'
import { deployTeam, undeployTeam, getTeamStatus } from './deploy'
import { getTeam } from '../../store/teams'
import type { GkeDeployConfig } from './deploy'
import type { SpecFile, DeployOptions } from '../../../shared/types'

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
  deploy(files: SpecFile[], teamSlug: string, config: unknown, options: DeployOptions) {
    return deployTeam(files, teamSlug, config as GkeDeployConfig, options)
  },
  undeploy(teamSlug: string, config: unknown) {
    return undeployTeam(teamSlug, config as GkeDeployConfig)
  },
  async getStatus(teamSlug: string, config: unknown) {
    const spec = await getTeam(teamSlug)
    const agentSlugs = spec?.agents.map(a => a.slug) ?? []
    return getTeamStatus(teamSlug, agentSlugs, config as GkeDeployConfig)
  },
})
