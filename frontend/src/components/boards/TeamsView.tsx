"use client"

import { memo } from 'react'
import TeamCardGrid from "@/components/teams/TeamCardGrid"

interface TeamsViewProps {
    teams: any[]
    userRole: string
    isResyncing: boolean
    onTeamClick: (team: any) => void
    onCreateTeam: () => void
    onShowTemplate: () => void
    onSyncAll: () => void
}

const TeamsView = memo(({
    teams,
    userRole,
    isResyncing,
    onTeamClick,
    onCreateTeam,
    onShowTemplate,
    onSyncAll
}: TeamsViewProps) => {
    return (
        <TeamCardGrid
            teams={teams}
            userRole={userRole}
            onTeamClick={onTeamClick}
            onCreateTeam={onCreateTeam}
            onShowTemplate={onShowTemplate}
            onSyncAll={onSyncAll}
            isResyncing={isResyncing}
        />
    )
})

TeamsView.displayName = 'TeamsView'

export default TeamsView
