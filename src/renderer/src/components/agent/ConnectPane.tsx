import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useGkeConfig } from '../../hooks/useEnvironments'

interface GkeConfig {
  projectId?: string
  clusterName?: string
  clusterZone?: string
}

function CopyBlock({ label, command, hint }: { label: string; command: string; hint?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="relative group">
        <pre className="bg-gray-900 text-gray-100 text-xs font-mono rounded-lg p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-all">
          {command}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      {hint && <div className="text-xs text-gray-400">{hint}</div>}
    </div>
  )
}

const KUBECTL_PREFIX = 'kubectl exec -it -n'

function kubectlExec(teamSlug: string, agentSlug: string, cmd: string): string {
  return `${KUBECTL_PREFIX} ${teamSlug} agent-${agentSlug}-0 -c openclaw -- ${cmd}`
}

export function ConnectPane({ teamSlug, agentSlug }: {
  teamSlug: string
  agentSlug: string
}) {
  const { data: gkeConfig } = useGkeConfig()
  const config = (gkeConfig?.config ?? {}) as GkeConfig

  if (!gkeConfig) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Deploy to a GKE environment to see connect instructions.
      </div>
    )
  }

  const { projectId, clusterName, clusterZone } = config
  const missing = !projectId || !clusterName || !clusterZone

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <p className="text-sm text-gray-500">
          Access the OpenClaw CLI directly inside the running pod to configure models,
          channels, skills, and other settings not available in this app.
        </p>

        {missing ? (
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Environment is missing GKE cluster details (projectId, clusterName, or clusterZone).
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Setup (one-time)</div>
            <p className="text-sm text-gray-500">
              Install the <a href="https://cloud.google.com/sdk/docs/install" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google Cloud CLI</a> and <a href="https://kubernetes.io/docs/tasks/tools/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">kubectl</a>, then run:
            </p>

            <CopyBlock
              label="1. Log in to Google Cloud"
              command="gcloud auth login"
            />

            <CopyBlock
              label="2. Get cluster credentials"
              command={`gcloud container clusters get-credentials ${clusterName} --location=${clusterZone} --project=${projectId}`}
            />

            <div className="border-t border-gray-200 pt-4 space-y-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">OpenClaw CLI</div>

              <CopyBlock
                label="Interactive terminal UI"
                command={kubectlExec(teamSlug, agentSlug, 'openclaw tui')}
                hint="Full terminal interface connected to the agent's gateway."
              />

              <CopyBlock
                label="Configuration wizard"
                command={kubectlExec(teamSlug, agentSlug, 'openclaw configure')}
                hint="Interactive setup for credentials, channels, gateway, and agent defaults."
              />

              <CopyBlock
                label="View/change config"
                command={kubectlExec(teamSlug, agentSlug, 'openclaw config --help')}
                hint="Non-interactive config helpers: get, set, unset, validate."
              />

              <CopyBlock
                label="Manage models"
                command={kubectlExec(teamSlug, agentSlug, 'openclaw models --help')}
                hint="Discover, scan, and configure models."
              />

              <CopyBlock
                label="Manage skills"
                command={kubectlExec(teamSlug, agentSlug, 'openclaw skills --help')}
                hint="List and inspect available skills."
              />

              <CopyBlock
                label="Manage channels"
                command={kubectlExec(teamSlug, agentSlug, 'openclaw channels --help')}
                hint="Manage connected chat channels (Telegram, Discord, etc.)."
              />
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Troubleshooting</div>

              <CopyBlock
                label="Health check"
                command={kubectlExec(teamSlug, agentSlug, 'openclaw doctor')}
                hint="Run health checks and quick fixes for the gateway and channels."
              />

              <CopyBlock
                label="View pod logs"
                command={`kubectl logs -n ${teamSlug} agent-${agentSlug}-0 -c openclaw --tail=100 -f`}
              />

              <CopyBlock
                label="Open a shell"
                command={kubectlExec(teamSlug, agentSlug, 'sh')}
              />

              <CopyBlock
                label="Restart the pod"
                command={`kubectl delete pod -n ${teamSlug} agent-${agentSlug}-0`}
              />
            </div>

            <div className="text-xs text-gray-400 mt-4">
              Tip: You can run all of these from <a href="https://shell.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google Cloud Shell</a> in your browser — gcloud and kubectl are pre-installed.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
