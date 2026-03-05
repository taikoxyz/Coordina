export type GatewayMode = 'ingress' | 'port-forward'

export function resolveGatewayMode(config: unknown): GatewayMode {
  const cfg = (config ?? {}) as { gatewayMode?: unknown; domain?: unknown }
  if (cfg.gatewayMode === 'ingress' || cfg.gatewayMode === 'port-forward') {
    return cfg.gatewayMode
  }
  return typeof cfg.domain === 'string' && cfg.domain.trim().length > 0 ? 'ingress' : 'port-forward'
}
