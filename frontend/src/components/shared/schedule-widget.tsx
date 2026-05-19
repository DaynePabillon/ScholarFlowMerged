import { Clock, MapPin } from "lucide-react"

interface ScheduleItem {
  time: string
  subject: string
  instructor: string
  room: string
}

interface ScheduleWidgetProps {
  schedule: ScheduleItem[]
}

export default function ScheduleWidget({ schedule }: ScheduleWidgetProps) {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {schedule.map((item, idx) => (
        <div
          key={idx}
          className={`p-4 flex items-center gap-4 ${idx !== schedule.length - 1 ? "border-b border-border" : ""}`}
        >
          <div className="flex items-center gap-2 text-primary font-bold min-w-fit">
            <Clock className="w-4 h-4" />
            {item.time}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">{item.subject}</h4>
            <p className="text-sm text-muted-foreground">{item.instructor}</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{item.room}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
