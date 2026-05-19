"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import { FolderOpen, File, FileText, Image, Video, Music, Upload, Search, Grid3x3, List, MoreVertical, Plus, X, Edit3, Maximize2, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import Portal from "@/components/ui/Portal"

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime: string
  webViewLink?: string
  iconLink?: string
  thumbnailLink?: string
  owners?: Array<{ displayName: string }>
}

interface Organization {
  id: string
  name: string
  role: 'admin' | 'manager' | 'member'
}

export default function DrivePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [uploading, setUploading] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

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
      fetchFiles()
    }
  }, [user])

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActionMenuId(null)
    if (actionMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [actionMenuId])

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await fetch(`${API_URL}/api/drive/files`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error("Failed to fetch files")

      const data = await response.json()
      setFiles(data.files || [])
    } catch (err) {
      console.error("Error fetching files:", err)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("folder")) return <FolderOpen className="w-6 h-6 text-blue-500" />
    if (mimeType.includes("image")) return <Image className="w-6 h-6 text-green-500" />
    if (mimeType.includes("video")) return <Video className="w-6 h-6 text-red-500" />
    if (mimeType.includes("audio")) return <Music className="w-6 h-6 text-purple-500" />
    if (mimeType.includes("document") || mimeType.includes("text")) return <FileText className="w-6 h-6 text-blue-600" />
    if (mimeType.includes("spreadsheet")) return <FileText className="w-6 h-6 text-green-600" />
    if (mimeType.includes("presentation")) return <FileText className="w-6 h-6 text-orange-500" />
    if (mimeType.includes("pdf")) return <FileText className="w-6 h-6 text-red-600" />
    return <File className="w-6 h-6 text-gray-400" />
  }

  const handleFileClick = (file: DriveFile) => {
    setSelectedFile(file)
    setShowFileModal(true)
  }

  const getEmbedUrl = (file: DriveFile) => {
    if (file.mimeType.includes('google-apps.document')) {
      return `https://docs.google.com/document/d/${file.id}/preview`
    }
    if (file.mimeType.includes('google-apps.spreadsheet')) {
      return `https://docs.google.com/spreadsheets/d/${file.id}/preview`
    }
    if (file.mimeType.includes('google-apps.presentation')) {
      return `https://docs.google.com/presentation/d/${file.id}/preview`
    }
    if (file.mimeType.includes('image')) {
      return file.thumbnailLink?.replace('=s220', '=s800') || `https://drive.google.com/uc?export=view&id=${file.id}`
    }
    return `https://drive.google.com/file/d/${file.id}/preview`
  }

  const canPreview = (file: DriveFile) => {
    const previewable = ['image', 'pdf', 'google-apps.document', 'google-apps.spreadsheet', 'google-apps.presentation', 'video', 'text', 'audio', 'document']
    return previewable.some(type => file.mimeType.includes(type))
  }

  // Check if file can be edited in embedded mode
  const canEdit = (file: DriveFile) => {
    const editable = [
      'google-apps.document',
      'google-apps.spreadsheet',
      'google-apps.presentation',
      // Office formats that can be opened in Google editors
      'application/vnd.openxmlformats-officedocument.wordprocessingml',
      'application/vnd.openxmlformats-officedocument.spreadsheetml',
      'application/vnd.openxmlformats-officedocument.presentationml',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint'
    ]
    return editable.some(type => file.mimeType.includes(type))
  }

  // Get the edit URL for Google Docs/Sheets/Slides or Office files
  const getEditUrl = (file: DriveFile) => {
    // Native Google files
    if (file.mimeType.includes('google-apps.document')) {
      return `https://docs.google.com/document/d/${file.id}/edit?embedded=true`
    }
    if (file.mimeType.includes('google-apps.spreadsheet')) {
      return `https://docs.google.com/spreadsheets/d/${file.id}/edit?embedded=true`
    }
    if (file.mimeType.includes('google-apps.presentation')) {
      return `https://docs.google.com/presentation/d/${file.id}/edit?embedded=true`
    }
    // Word documents - open in Google Docs
    if (file.mimeType.includes('wordprocessingml') || file.mimeType.includes('msword')) {
      return `https://docs.google.com/document/d/${file.id}/edit?embedded=true`
    }
    // Excel files - open in Google Sheets
    if (file.mimeType.includes('spreadsheetml') || file.mimeType.includes('ms-excel')) {
      return `https://docs.google.com/spreadsheets/d/${file.id}/edit?embedded=true`
    }
    // PowerPoint files - open in Google Slides
    if (file.mimeType.includes('presentationml') || file.mimeType.includes('ms-powerpoint')) {
      return `https://docs.google.com/presentation/d/${file.id}/edit?embedded=true`
    }
    // Default fallback to Google Docs
    return `https://docs.google.com/document/d/${file.id}/edit?embedded=true`
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`${API_URL}/api/drive/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (response.ok) {
        fetchFiles()
      }
    } catch (err) {
      console.error("Upload error:", err)
    } finally {
      setUploading(false)
    }
  }

  const handleCreateFolder = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await fetch(`${API_URL}/api/drive/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: folderName }),
      })

      if (response.ok) {
        fetchFiles()
        setShowFolderModal(false)
        setFolderName("")
      }
    } catch (err) {
      console.error("Folder creation error:", err)
    }
  }

  const formatSize = (bytes?: string) => {
    if (!bytes) return "—"
    const size = parseInt(bytes)
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      selectedOrg={selectedOrg}
      onOrgChange={setSelectedOrg}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Google Drive</h1>
          <p className="text-gray-600 mt-1">Manage your files and folders</p>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFolderModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">New Folder</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer">
              <Upload className="w-5 h-5" />
              <span className="font-medium">{uploading ? "Uploading..." : "Upload"}</span>
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            <button
              onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
              className="p-2 border border-gray-200 rounded-xl hover:bg-blue-50 transition-colors"
            >
              {viewMode === "list" ? <Grid3x3 className="w-5 h-5 text-blue-600" /> : <List className="w-5 h-5 text-blue-600" />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-12 text-center border border-white/40 shadow-lg">
            <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No files found</h3>
            <p className="text-gray-600">Upload your first file to get started</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-blue-50/50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-blue-600">Name</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-blue-600">Owner</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-blue-600">Modified</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-blue-600">Size</th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-blue-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    onClick={() => handleFileClick(file)}
                    className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.mimeType)}
                        <span className="font-medium text-gray-800">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {file.owners?.[0]?.displayName || "Me"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(file.modifiedTime)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatSize(file.size)}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionMenuId(actionMenuId === file.id ? null : file.id)
                        }}
                        className="p-1 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                      </button>

                      {/* Dropdown Menu */}
                      {actionMenuId === file.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(file.webViewLink, '_blank')
                              setActionMenuId(null)
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <FolderOpen className="w-4 h-4" />
                            Open in Drive
                          </button>
                          {canPreview(file) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleFileClick(file)
                                setActionMenuId(null)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Eye className="w-4 h-4" />
                              Preview
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`https://drive.google.com/uc?export=download&id=${file.id}`, '_blank')
                              setActionMenuId(null)
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Upload className="w-4 h-4 rotate-180" />
                            Download
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => handleFileClick(file)}
                className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate w-full mb-1">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {formatDate(file.modifiedTime)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/40">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">New Folder</h2>
              <button
                onClick={() => setShowFolderModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Untitled folder"
                  className="w-full px-4 py-2 bg-white/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowFolderModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!folderName}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal - Using Portal to render above header */}
      {showFileModal && selectedFile && (
        <Portal>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-white/40">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  {getFileIcon(selectedFile.mimeType)}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 truncate max-w-md">{selectedFile.name}</h2>
                    <p className="text-sm text-gray-500">{formatSize(selectedFile.size)} • Modified {formatDate(selectedFile.modifiedTime)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Preview/Edit Toggle for editable files */}
                  {canEdit(selectedFile) && (
                    <div className="flex bg-gray-100 rounded-xl p-1">
                      <button
                        onClick={() => setIsEditMode(false)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!isEditMode
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <button
                        onClick={() => setIsEditMode(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isEditMode
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                    </div>
                  )}
                  {selectedFile.webViewLink && (
                    <a href={selectedFile.webViewLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors">
                      <Maximize2 className="w-4 h-4" />
                      Open in Drive
                    </a>
                  )}
                  <button onClick={() => { setShowFileModal(false); setSelectedFile(null); setIsEditMode(false); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-gray-100 overflow-hidden">
                {canPreview(selectedFile) ? (
                  selectedFile.mimeType.includes('image') ? (
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <img src={getEmbedUrl(selectedFile)} alt={selectedFile.name} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                    </div>
                  ) : (
                    <iframe
                      src={isEditMode && canEdit(selectedFile) ? getEditUrl(selectedFile) : getEmbedUrl(selectedFile)}
                      className="w-full h-full border-0"
                      title={selectedFile.name}
                      allow="autoplay"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                    {getFileIcon(selectedFile.mimeType)}
                    <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">Preview not available</h3>
                    <p className="text-gray-600 mb-6">This file type cannot be previewed.</p>
                    {selectedFile.webViewLink && (
                      <a href={selectedFile.webViewLink} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl">Open in Google Drive</a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </AppLayout>
  )
}
