import type { LucideIcon } from "lucide-react"

interface Metric {
  label: string
  value: string
  change: string
  icon: LucideIcon
}

interface SchoolMetricsProps {
  metrics: Metric[]
}

export default function SchoolMetrics({ metrics }: SchoolMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon
        const isPositive = !metric.change.startsWith("-")

        return (
          <div key={idx} className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">{metric.value}</p>
            <p className={`text-xs ${isPositive ? "text-primary" : "text-destructive"}`}>
              {metric.change} from last month
            </p>
          </div>
        )
      })}
    </div>
  )
}
