import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface SchoolAnalyticsData {
  subject: string
  avgScore: number
  passRate: number
}

interface SchoolAnalyticsProps {
  data: SchoolAnalyticsData[]
}

export default function SchoolAnalytics({ data }: SchoolAnalyticsProps) {
  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h2 className="text-xl font-bold text-foreground mb-4">School-Wide Academic Performance</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="subject" tick={{ fill: "var(--color-foreground)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--color-foreground)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
            }}
            labelStyle={{ color: "var(--color-foreground)" }}
          />
          <Legend />
          <Bar dataKey="avgScore" fill="var(--color-primary)" name="Avg Score" radius={[8, 8, 0, 0]} />
          <Bar dataKey="passRate" fill="var(--color-accent)" name="Pass Rate %" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
