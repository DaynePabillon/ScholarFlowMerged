import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface AnalyticsData {
  name: string
  data: number[]
}

interface AnalyticsWidgetProps {
  data: AnalyticsData[]
}

export default function AnalyticsWidget({ data }: AnalyticsWidgetProps) {
  const chartData = [
    { week: "W1", ...Object.fromEntries(data.map((d, i) => [`class${i}`, d.data[0]])) },
    { week: "W2", ...Object.fromEntries(data.map((d, i) => [`class${i}`, d.data[1]])) },
    { week: "W3", ...Object.fromEntries(data.map((d, i) => [`class${i}`, d.data[2]])) },
    { week: "W4", ...Object.fromEntries(data.map((d, i) => [`class${i}`, d.data[3]])) },
    { week: "W5", ...Object.fromEntries(data.map((d, i) => [`class${i}`, d.data[4]])) },
    { week: "W6", ...Object.fromEntries(data.map((d, i) => [`class${i}`, d.data[5]])) },
    { week: "W7", ...Object.fromEntries(data.map((d, i) => [`class${i}`, d.data[6]])) },
    { week: "W8", ...Object.fromEntries(data.map((d, i) => [`class${i}`, d.data[7]])) },
  ]

  const colors = ["var(--color-primary)", "var(--color-accent)", "var(--color-chart-3)"]

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h2 className="text-xl font-bold text-foreground mb-4">Class Performance Trends</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="week" tick={{ fill: "var(--color-foreground)", fontSize: 12 }} />
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
          {data.map((cls, idx) => (
            <Line
              key={idx}
              type="monotone"
              dataKey={`class${idx}`}
              stroke={colors[idx]}
              name={cls.name}
              dot={{ fill: colors[idx], r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
