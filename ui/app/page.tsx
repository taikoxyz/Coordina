'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import OnboardingWizard from '@/components/OnboardingWizard'

export default function HomePage() {
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [noTeams, setNoTeams] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const settings = await api.getGlobalSettings()
        if (!settings.has_bootstrap_sa_key) {
          setShowOnboarding(true)
          setLoading(false)
          return
        }
        const teams = await api.getTeams()
        if (teams.length > 0) {
          router.replace(`/teams/${teams[0].id}`)
          return
        }
        setNoTeams(true)
      } catch {
        // API not reachable yet — show empty state
        setNoTeams(true)
      }
      setLoading(false)
    }
    init()
  }, [router])

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setShowOnboarding(false)
          window.location.reload()
        }}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#666' }}>
        Loading...
      </div>
    )
  }

  if (noTeams) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">No teams yet</h2>
          <p className="text-sm" style={{ color: '#666' }}>
            Use the left nav to create your first team.
          </p>
        </div>
      </div>
    )
  }

  return null
}
