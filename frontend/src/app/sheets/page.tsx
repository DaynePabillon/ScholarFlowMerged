"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import { FileText, Plus, Search, MoreVertical, Clock, Users, Download, Share2, X, Edit3, Eye, Maximize2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import Portal from "@/components/ui/Portal"

interface Spreadsheet {
  id: string
  name: string
  modifiedTime: string
  webViewLink?: string
  iconLink?: string
  owners?: Array<{ displayName: string }>
}

interface Organization {
  id: string
  name: string
  role: 'admin' | 'manager' | 'member'
}

export default function SheetsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSheet, setSelectedSheet] = useState<Spreadsheet | null>(null)
  const [showSheetModal, setShowSheetModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSheetTitle, setNewSheetTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const handleSheetClick = (sheet: Spreadsheet) => {
    setSelectedSheet(sheet)
    setShowSheetModal(true)
  }

  const createSpreadsheet = async () => {
    if (creating) return
    setCreating(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/sheets/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newSheetTitle || 'Untitled Spreadsheet' })
      })

      if (response.ok) {
        const data = await response.json()
        // Open the new sheet in embedded editor
        setSelectedSheet({
          id: data.spreadsheet.id,
          name: data.spreadsheet.name,
          modifiedTime: new Date().toISOString(),
          webViewLink: data.spreadsheet.webViewLink
        })
        setIsEditMode(true)
        setShowSheetModal(true)
        setShowCreateModal(false)
        setNewSheetTitle('')
        // Refresh the list
        fetchSpreadsheets()
      }
    } catch (error) {
      console.error('Error creating spreadsheet:', error)
    } finally {
      setCreating(false)
    }
  }

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActionMenuId(null)
    if (actionMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [actionMenuId])

  const deleteSpreadsheet = async (sheetId: string) => {
    if (!confirm('Are you sure you want to delete this spreadsheet? This action cannot be undone.')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/drive/files/${sheetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        fetchSpreadsheets()
      }
    } catch (error) {
      console.error('Error deleting spreadsheet:', error)
    }
    setActionMenuId(null)
  }

  useEffect(() => {
    const token = localStorage.getItem("token")
    const storedUser = localStorage.getItem("user")
    const storedOrgs = localStorage.getItem("organizations")

    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        const orgsData = storedOrgs ? JSON.parse(storedOrgs) : []
        setUser(userData)
        setOrganizations(orgsData)
        if (orgsData.length > 0) {
          setSelectedOrg(orgsData[0])
        }
      } catch (e) {
        console.error('Error parsing stored user data:', e)
      }
    }

    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error('Authentication failed')
          return res.json()
        })
        .then(data => {
          const { organizations, ...userData } = data
          setUser(userData)
          setOrganizations(organizations || [])
          if (organizations && organizations.length > 0) {
            setSelectedOrg(organizations[0])
          }
          localStorage.setItem('user', JSON.stringify(userData))
          localStorage.setItem('organizations', JSON.stringify(organizations || []))
          setIsLoading(false)
        })
        .catch(err => {
          console.error('Failed to fetch user info:', err)
          setIsLoading(false)
        })
    } else {
      router.push("/")
    }
  }, [router])

  useEffect(() => {
    if (user) {
      fetchSpreadsheets()
    }
  }, [user])

  const fetchSpreadsheets = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        router.push("/")
        return
      }

      const response = await fetch(`${API_URL}/api/sheets/list`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error("Failed to fetch spreadsheets")

      const data = await response.json()
      setSpreadsheets(data.files || [])
    } catch (err) {
      console.error("Error fetching spreadsheets:", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredSheets = spreadsheets.filter(sheet =>
    sheet.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <AppLayout
        user={user}
        organizations={organizations}
        selectedOrg={selectedOrg}
        onOrgChange={setSelectedOrg}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Google Sheets</h1>
            <p className="text-gray-600 mt-1">Manage your spreadsheets</p>
          </div>
          {/* Search and Actions */}
          <div className="mb-8 flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search spreadsheets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">New Sheet</span>
            </button>
          </div>

          {/* Spreadsheets Grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredSheets.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-12 text-center border border-white/40 shadow-lg">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No spreadsheets found</h3>
              <p className="text-gray-600 mb-6">Create your first spreadsheet to get started</p>
              <button className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md">
                Create Spreadsheet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSheets.map((sheet) => (
                <div
                  key={sheet.id}
                  onClick={() => handleSheetClick(sheet)}
                  className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4 overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                        <FileText className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-800 truncate">{sheet.name}</h3>
                        <p className="text-xs text-gray-600">
                          {new Date(sheet.modifiedTime).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionMenuId(actionMenuId === sheet.id ? null : sheet.id)
                        }}
                        className="p-1 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                      </button>

                      {/* Dropdown Menu */}
                      {actionMenuId === sheet.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSheetClick(sheet)
                              setActionMenuId(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="w-4 h-4" />
                            Open
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedSheet(sheet)
                              setIsEditMode(true)
                              setShowSheetModal(true)
                              setActionMenuId(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteSpreadsheet(sheet.id)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>Modified {new Date(sheet.modifiedTime).toLocaleDateString()}</span>
                  </div>

                  {sheet.owners && sheet.owners.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                      <Users className="w-3 h-3" />
                      <span>{sheet.owners[0].displayName}</span>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Share2 className="w-3 h-3" />
                      Share
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppLayout>

      {/* Sheet Preview Modal - Using Portal to render above header */}
      {showSheetModal && selectedSheet && (
        <Portal>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-white/40">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileText className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 truncate max-w-md">{selectedSheet.name}</h2>
                    <p className="text-sm text-gray-500">
                      Modified {new Date(selectedSheet.modifiedTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Preview/Edit Toggle */}
                  <div className="flex bg-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => setIsEditMode(false)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!isEditMode
                        ? 'bg-white text-green-600 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      onClick={() => setIsEditMode(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isEditMode
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                  {selectedSheet.webViewLink && (
                    <a
                      href={selectedSheet.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 border border-green-200 rounded-xl hover:bg-green-50 transition-colors"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Open in Sheets
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setShowSheetModal(false)
                      setSelectedSheet(null)
                      setIsEditMode(false)
                    }}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Sheet Content - Preview or Edit */}
              <div className="flex-1 bg-gray-100 overflow-hidden">
                <iframe
                  src={isEditMode
                    ? `https://docs.google.com/spreadsheets/d/${selectedSheet.id}/edit?embedded=true`
                    : `https://docs.google.com/spreadsheets/d/${selectedSheet.id}/preview`
                  }
                  className="w-full h-full border-0"
                  title={selectedSheet.name}
                />
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Create New Sheet Modal */}
      {showCreateModal && (
        <Portal>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-green-500 to-emerald-500">
                <div>
                  <h2 className="text-xl font-bold text-white">Create New Spreadsheet</h2>
                  <p className="text-white/80 text-sm">Enter a name for your spreadsheet</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Spreadsheet Name</label>
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="e.g., Budget 2024"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && createSpreadsheet()}
                />
              </div>

              <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createSpreadsheet}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Open'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}

