import { CheckCircle2, Clock, AlertCircle } from "lucide-react"

interface Task {
  id: string
  title: string
  class: string
  dueDate: string
  status: "pending" | "in-progress" | "not-started"
  progress: number
}

interface TaskCardProps {
  task: Task
}

export default function TaskCard({ task }: TaskCardProps) {
  const daysUntilDue = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

  const getStatusIcon = () => {
    switch (task.status) {
      case "pending":
        return <Clock className="w-4 h-4 text-accent" />
      case "in-progress":
        return <AlertCircle className="w-4 h-4 text-primary" />
      default:
        return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getStatusColor = () => {
    switch (task.status) {
      case "pending":
        return "bg-accent/10 border-accent/20"
      case "in-progress":
        return "bg-primary/10 border-primary/20"
      default:
        return "bg-muted/10 border-muted/20"
    }
  }

  return (
    <div className={`rounded-lg p-4 border ${getStatusColor()} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {getStatusIcon()}
            <h3 className="font-semibold text-foreground text-sm">{task.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{task.class}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-muted-foreground">Due in {daysUntilDue} days</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-background rounded-full h-2 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${task.progress}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-2">{task.progress}% complete</p>
    </div>
  )
}
