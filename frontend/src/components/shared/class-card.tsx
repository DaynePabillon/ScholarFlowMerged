import { Users, TrendingUp } from "lucide-react"

interface ClassInfo {
  id: string
  name: string
  code: string
  students: number
  avgGrade: number
  nextClass: string
}

interface ClassCardProps {
  classInfo: ClassInfo
}

export default function ClassCard({ classInfo }: ClassCardProps) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{classInfo.name}</h3>
          <p className="text-xs text-muted-foreground">{classInfo.code}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{classInfo.avgGrade}%</div>
          <p className="text-xs text-muted-foreground">avg grade</p>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span className="text-sm">{classInfo.students} students</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm">{classInfo.nextClass}</span>
        </div>
      </div>
    </div>
  )
}
