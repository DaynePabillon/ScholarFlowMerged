export default function RecentSubmissions() {
  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h3 className="font-bold text-foreground mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="pb-3 border-b border-border last:border-0">
            <p className="text-sm font-medium text-foreground">Assignment submitted</p>
            <p className="text-xs text-muted-foreground">2 hours ago</p>
          </div>
        ))}
      </div>
    </div>
  )
}
