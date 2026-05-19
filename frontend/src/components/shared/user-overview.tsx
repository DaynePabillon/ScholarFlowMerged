import { Users } from "lucide-react"

export default function UserOverview() {
  const userStats = [
    { category: "Active Students", count: 2847, percentage: 95 },
    { category: "Active Teachers", count: 156, percentage: 98 },
    { category: "Class Assignments", count: 2341, percentage: 87 },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {userStats.map((stat, idx) => (
        <div key={idx} className="bg-card rounded-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground text-sm">{stat.category}</h3>
            <Users className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground mb-2">{stat.count.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background rounded-full h-2 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${stat.percentage}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{stat.percentage}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}
