'use client'
import dynamic from 'next/dynamic'

const TeamNav = dynamic(() => import('./TeamNav'), { ssr: false })

export default function TeamNavWrapper() {
  return <TeamNav />
}
