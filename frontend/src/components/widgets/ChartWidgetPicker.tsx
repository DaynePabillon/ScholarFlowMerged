"use client"

import { useState } from 'react'
import { X, PieChart, BarChart3, TrendingUp, Hash, Users, CheckCircle2 } from 'lucide-react'

interface ChartWidgetPickerProps {
    isOpen: boolean
    onClose: () => void
    onSelectWidget: (widgetType: string, title: string) => void
}

const WIDGET_OPTIONS = [
    {
        type: 'pie_status',
        icon: PieChart,
        title: 'Tasks by Status',
        description: 'Pie chart showing task distribution by status',
        color: 'from-blue-500 to-cyan-500'
    },
    {
        type: 'pie_priority',
        icon: PieChart,
        title: 'Tasks by Priority',
        description: 'Pie chart showing task distribution by priority',
        color: 'from-red-500 to-orange-500'
    },
    {
        type: 'bar_assignee',
        icon: Users,
        title: 'Tasks by Team Member',
        description: 'Bar chart showing tasks per team member',
        color: 'from-purple-500 to-pink-500'
    },
    {
        type: 'bar_workload',
        icon: BarChart3,
        title: 'Team Workload',
        description: 'Bar chart showing workload distribution',
        color: 'from-green-500 to-emerald-500'
    },
    {
        type: 'number_summary',
        icon: Hash,
        title: 'Summary Numbers',
        description: 'Key metrics: Total, Done, Overdue',
        color: 'from-amber-500 to-yellow-500'
    },
    {
        type: 'completion_rate',
        icon: CheckCircle2,
        title: 'Completion Rate',
        description: 'Percentage of completed tasks',
        color: 'from-teal-500 to-cyan-500'
    }
]

export default function ChartWidgetPicker({ isOpen, onClose, onSelectWidget }: ChartWidgetPickerProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-cyan-500">
                    <div>
                        <h2 className="text-xl font-bold text-white">Add Chart Widget</h2>
                        <p className="text-white/80 text-sm">Choose a chart to add to your board</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Widget Options Grid */}
                <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto max-h-96">
                    {WIDGET_OPTIONS.map((widget) => (
                        <button
                            key={widget.type}
                            onClick={() => {
                                onSelectWidget(widget.type, widget.title)
                                onClose()
                            }}
                            className="group flex items-start gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl border-2 border-transparent hover:border-blue-300 transition-all text-left"
                        >
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${widget.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                <widget.icon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800">{widget.title}</h3>
                                <p className="text-sm text-gray-500 mt-1">{widget.description}</p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs text-gray-400 text-center">
                        Charts automatically update with your task data
                    </p>
                </div>
            </div>
        </div>
    )
}
