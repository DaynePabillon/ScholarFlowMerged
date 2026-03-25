"use client"

import { Cloud, Users, FolderKanban, CheckSquare, Calendar, HardDrive, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

// Cloud SVG component for animated background
const CloudShape = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 100" className={className} fill="currentColor">
    <path d="M166.257,66.823c-0.135-1.96-0.453-3.869-0.969-5.692c1.909-3.743,2.988-7.994,2.988-12.49 c0-15.473-12.527-28.028-28-28.028c-5.48,0-10.601,1.586-14.93,4.314c-4.711-6.252-12.201-10.314-20.641-10.314 c-12.426,0-22.821,8.78-25.346,20.462c-1.749-0.449-3.576-0.691-5.463-0.691c-11.776,0-21.328,9.552-21.328,21.328 c0,0.233,0.008,0.464,0.016,0.695c-7.352,2.574-12.631,9.584-12.631,17.855c0,10.432,8.458,18.89,18.891,18.89h99.084 c13.186,0,23.875-10.689,23.875-23.874C181.802,77.968,175.234,69.432,166.257,66.823z" />
  </svg>
)

export default function LandingPage() {
  const router = useRouter()

  const features = [
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Work together seamlessly with your organization members",
    },
    {
      icon: FolderKanban,
      title: "Project Management",
      description: "Organize and track projects with powerful tools",
    },
    {
      icon: CheckSquare,
      title: "Task Tracking",
      description: "Manage tasks with deadlines, priorities, and assignments",
    },
    {
      icon: Calendar,
      title: "Google Calendar Integration",
      description: "Sync schedules and never miss important meetings",
    },
    {
      icon: HardDrive,
      title: "Google Drive Integration",
      description: "Access and manage files directly from your workspace",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Original blur elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl animate-bounce-slow"></div>
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl animate-wave"></div>

        {/* Floating Cloud Shapes */}
        <CloudShape className="absolute w-48 h-24 text-white/60 animate-cloud-1 top-[8%]" />
        <CloudShape className="absolute w-64 h-32 text-white/50 animate-cloud-2 top-[18%]" />
        <CloudShape className="absolute w-40 h-20 text-white/55 animate-cloud-3 top-[5%]" />
        <CloudShape className="absolute w-56 h-28 text-white/45 animate-cloud-4 top-[28%]" />
        <CloudShape className="absolute w-44 h-22 text-white/50 animate-cloud-5 top-[12%]" />
        <CloudShape className="absolute w-52 h-26 text-white/40 animate-cloud-6 top-[35%]" />
        <CloudShape className="absolute w-36 h-18 text-white/65 animate-cloud-7 top-[22%]" />
        <CloudShape className="absolute w-48 h-24 text-white/55 animate-cloud-8 top-[6%]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
          <div className="text-center max-w-5xl mx-auto">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-8 shadow-2xl transform hover:scale-110 transition-transform duration-300">
              <Cloud className="w-10 h-10 text-white" />
            </div>

            {/* Main Heading */}
            <h1 className="text-7xl md:text-8xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent mb-6 tracking-tight">
              SkyFlow
            </h1>

            {/* Quote */}
            <p className="text-3xl md:text-4xl font-light text-gray-700 mb-4 italic">
              "The sky was never the limit."
            </p>

            <p className="text-xl md:text-2xl text-gray-600 mb-12 font-light">
              Organizational Project Management Platform
            </p>

            {/* CTA Button */}
            <button
              onClick={() => router.push('/login')}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Everything You Need
            </h2>
            <p className="text-center text-gray-600 text-lg mb-16 max-w-2xl mx-auto">
              Powerful tools to manage your organization, projects, and team collaboration
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 hover:border-blue-300 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl mb-5 shadow-md group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Additional Features */}
        <div className="py-20 px-4 bg-white/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800">
              What's Included
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Project & Task Tracking</h4>
                  <p className="text-gray-600 text-sm">Organize work with intuitive project boards and task management</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Team Collaboration Tools</h4>
                  <p className="text-gray-600 text-sm">Work together with role-based access and permissions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Time Tracking & Analytics</h4>
                  <p className="text-gray-600 text-sm">Monitor progress and productivity with detailed insights</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Real-time Updates</h4>
                  <p className="text-gray-600 text-sm">Stay in sync with instant notifications and updates</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Google Workspace Integration</h4>
                  <p className="text-gray-600 text-sm">Seamlessly connect with Calendar, Drive, and Sheets</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Secure & Reliable</h4>
                  <p className="text-gray-600 text-sm">Enterprise-grade security with Google OAuth authentication</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-800">
              Ready to elevate your workflow?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join teams already using SkyFlow to achieve more
            </p>
            <button
              onClick={() => router.push('/login')}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              Start Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-gray-200 bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-gray-600 text-sm">
                © 2025 SkyFlow. Built for organizational excellence.
              </div>
              <div className="flex items-center gap-6 text-sm">
                <a
                  href="/privacy"
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Privacy Policy
                </a>
                <a
                  href="/terms"
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
