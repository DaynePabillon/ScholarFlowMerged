"use client"

import { memo } from 'react'
import AdvisorWBSExplorer from "@/components/tasks/AdvisorWBSExplorer"

interface AdvisorViewProps {
    selectedSheetId: string | null
    organizationId: string
}

const AdvisorView = memo(({
    selectedSheetId,
    organizationId
}: AdvisorViewProps) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-320px)]">
            <AdvisorWBSExplorer 
                sheetId={selectedSheetId} 
                organizationId={organizationId} 
            />
        </div>
    )
})

AdvisorView.displayName = 'AdvisorView'

export default AdvisorView
