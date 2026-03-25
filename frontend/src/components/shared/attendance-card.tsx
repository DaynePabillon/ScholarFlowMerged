import { Calendar } from "lucide-react"

interface AttendanceCardProps {
  attendance: number
  daysPresent: number
  totalDays: number
}

export default function AttendanceCard({ attendance, daysPresent, totalDays }: AttendanceCardProps) {
  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">Attendance</h3>
        <Calendar className="w-5 h-5 text-primary" />
      </div>

      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-primary mb-1">{attendance}%</div>
        <p className="text-xs text-muted-foreground">
          {daysPresent} of {totalDays} days present
        </p>
      </div>

      <div className="bg-background rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all"
          style={{ width: `${attendance}%` }}
        />
      </div>
    </div>
  )
}
