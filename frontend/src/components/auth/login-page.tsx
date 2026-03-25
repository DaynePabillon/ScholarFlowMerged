"use client"

import { API_URL } from '@/lib/api/client'
import { Cloud, Mail, Users, FolderKanban, CheckSquare, ArrowRight } from "lucide-react"

// Cloud SVG component for the animated background
const CloudShape = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 100" className={className} fill="currentColor">
    <path d="M166.257,66.823c-0.135-1.96-0.453-3.869-0.969-5.692c1.909-3.743,2.988-7.994,2.988-12.49 c0-15.473-12.527-28.028-28-28.028c-5.48,0-10.601,1.586-14.93,4.314c-4.711-6.252-12.201-10.314-20.641-10.314 c-12.426,0-22.821,8.78-25.346,20.462c-1.749-0.449-3.576-0.691-5.463-0.691c-11.776,0-21.328,9.552-21.328,21.328 c0,0.233,0.008,0.464,0.016,0.695c-7.352,2.574-12.631,9.584-12.631,17.855c0,10.432,8.458,18.89,18.891,18.89h99.084 c13.186,0,23.875-10.689,23.875-23.874C181.802,77.968,175.234,69.432,166.257,66.823z" />
  </svg>
)

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/google`)
      const data = await response.json()
      // Smooth redirect to Google OAuth
      window.location.href = data.authUrl
    } catch (error) {
      console.error('Failed to initiate Google login:', error)
      alert('Failed to connect to authentication server. Please try again.')
    }
  }

  const features = [
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Work together with your organization",
    },
    {
      icon: FolderKanban,
      title: "Project Management",
      description: "Organize and track projects efficiently",
    },
    {
      icon: CheckSquare,
      title: "Task Tracking",
      description: "Manage tasks with deadlines and priorities",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-palladian to-white flex flex-col overflow-hidden relative">
      {/* Animated Clouds Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Cloud layer 1 - slow, back */}
        <CloudShape className="absolute w-48 h-24 text-white/40 animate-cloud-1 top-[10%]" />
        <CloudShape className="absolute w-64 h-32 text-white/30 animate-cloud-2 top-[25%]" />
        <CloudShape className="absolute w-40 h-20 text-white/35 animate-cloud-3 top-[5%]" />

        {/* Cloud layer 2 - medium speed */}
        <CloudShape className="absolute w-56 h-28 text-white/50 animate-cloud-4 top-[35%]" />
        <CloudShape className="absolute w-44 h-22 text-white/45 animate-cloud-5 top-[15%]" />
        <CloudShape className="absolute w-52 h-26 text-white/40 animate-cloud-6 top-[45%]" />

        {/* Cloud layer 3 - faster, front */}
        <CloudShape className="absolute w-36 h-18 text-white/60 animate-cloud-7 top-[20%]" />
        <CloudShape className="absolute w-48 h-24 text-white/55 animate-cloud-8 top-[8%]" />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-fantastic/5 via-transparent to-truffle-trouble/5 pointer-events-none" />

      <div className="relative flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Logo Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-fantastic to-abyssal-anchorfish rounded-xl mb-4 shadow-lg">
              <Cloud className="w-8 h-8 text-burning-flame" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-fantastic to-abyssal-anchorfish bg-clip-text text-transparent mb-2">SkyFlow</h1>
            <p className="text-lg text-truffle-trouble">Organizational Project Management Platform</p>
          </div>

          {/* Login Section */}
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 border border-oatmeal shadow-lg">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-blue-fantastic mb-2">
                  Sign in to SkyFlow
                </h2>
                <p className="text-sm text-truffle-trouble">
                  Connect with your Google Workspace account
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleGoogleLogin}
                  className="group w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg bg-gradient-to-r from-blue-fantastic to-abyssal-anchorfish text-white hover:shadow-xl hover:scale-[1.02] transition-all duration-300 font-medium relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <Mail className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">Continue with Google</span>
                  <ArrowRight className="w-5 h-5 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>

                <p className="text-xs text-center text-truffle-trouble">
                  Secure sign-in powered by Google
                </p>
              </div>
            </div>

            {/* Features preview */}
            <div className="grid md:grid-cols-3 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-oatmeal">
                  <feature.icon className="w-8 h-8 text-blue-fantastic mb-3" />
                  <h3 className="font-semibold text-blue-fantastic mb-2">{feature.title}</h3>
                  <p className="text-sm text-truffle-trouble">{feature.description}</p>
                </div>
              ))}
            </div>

            {/* Additional Features */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-oatmeal">
              <h3 className="font-semibold text-blue-fantastic mb-4">What's Included</h3>
              <ul className="grid md:grid-cols-2 gap-2 text-sm text-truffle-trouble">
                <li>✓ Google Calendar Integration</li>
                <li>✓ Google Drive File Management</li>
                <li>✓ Project & Task Tracking</li>
                <li>✓ Team Collaboration Tools</li>
                <li>✓ Time Tracking & Analytics</li>
                <li>✓ Real-time Updates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
