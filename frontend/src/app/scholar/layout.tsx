import './globals.css'

// Scholar routes use the root SkyFlow ThemeProvider (app/layout.tsx).
// The scholar-theme wrapper enables all .dark .scholar-theme CSS rules
// and applies role-based CSS variables (--color-text, --color-surface, etc.)
export default function ScholarLayout({ children }: { children: React.ReactNode }) {
  return <div className="scholar-theme">{children}</div>
}
