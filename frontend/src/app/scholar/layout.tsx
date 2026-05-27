// Scholar routes use the root SkyFlow ThemeProvider (app/layout.tsx).
// No separate theme override needed — the platform is unified.
export default function ScholarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
