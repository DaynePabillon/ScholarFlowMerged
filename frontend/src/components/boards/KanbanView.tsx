"use client"

import { memo } from 'react'
import ProfessionalKanban from "@/components/tasks/ProfessionalKanban"

interface KanbanViewProps {
    tasks: any[]
    members: any[]
    role: 'admin' | 'manager' | 'student'
    onStatusChange: (taskId: string, status: string) => void
    onProgressChange: (taskId: string, progress: number) => void
    onDeleteTask: (taskId: string) => void
    onArchiveTask: (taskId: string) => void
    onTaskClick: (task: any) => void
    onAddTask: (status: string) => void
}

const KanbanView = memo(({
    tasks,
    members,
    role,
    onStatusChange,
    onProgressChange,
    onDeleteTask,
    onArchiveTask,
    onTaskClick,
    onAddTask
}: KanbanViewProps) => {
    return (
        <div className="h-[calc(100vh-280px)] min-h-[600px] animate-in fade-in zoom-in-95 duration-500">
            <ProfessionalKanban
                tasks={tasks}
                onTaskClick={onTaskClick}
                onStatusChange={onStatusChange}
                onDeleteTask={onDeleteTask}
                onArchiveTask={onArchiveTask}
                onAddTask={onAddTask}
                onProgressChange={onProgressChange}
                role={role}
                canDrag={true}
            />
        </div>
    )
})

KanbanView.displayName = 'KanbanView'

export default KanbanView
