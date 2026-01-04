import { useState, useEffect } from 'react'
import type { FileEntry } from '../../preload/index.d'

interface SidebarProps {
  onFileSelect: (filePath: string) => void
  selectedFile: string | null
}

function Sidebar({ onFileSelect, selectedFile }: SidebarProps): React.JSX.Element {
  const [directory, setDirectory] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)

  useEffect(() => {
    // Check if API is available
    if (window.api && window.api.openDirectory) {
      setApiAvailable(true)
    } else {
      console.warn('window.api is not available. Make sure preload script is loaded.')
      setApiAvailable(false)
    }
  }, [])

  const handleOpenDirectory = async (): Promise<void> => {
    if (!apiAvailable || !window.api || !window.api.openDirectory) {
      console.error('window.api is not available')
      alert('API is not available. Please restart the application.')
      return
    }

    setLoading(true)
    try {
      const dirPath = await window.api.openDirectory()
      if (dirPath) {
        setDirectory(dirPath)
        await loadFiles(dirPath)
      }
    } catch (error) {
      console.error('Error opening directory:', error)
      alert(`Error opening directory: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async (dirPath: string): Promise<void> => {
    try {
      const fileList = await window.api.readDirectory(dirPath)
      setFiles(fileList)
    } catch (error) {
      console.error('Error loading files:', error)
    }
  }

  const handleFileClick = (file: FileEntry): void => {
    if (!file.isDirectory) {
      onFileSelect(file.path)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Files</h2>
        <button 
          onClick={handleOpenDirectory} 
          disabled={loading || !apiAvailable} 
          className="open-dir-btn"
          title={!apiAvailable ? 'API not available' : ''}
        >
          {loading ? 'Loading...' : 'Open Folder'}
        </button>
      </div>
      <div className="sidebar-content">
        {directory ? (
          <div className="file-list">
            <div className="directory-path">{directory}</div>
            {files.length === 0 ? (
              <div className="empty-state">No files found</div>
            ) : (
              files.map((file) => (
                <div
                  key={file.path}
                  className={`file-item ${file.isDirectory ? 'directory' : ''} ${
                    selectedFile === file.path ? 'selected' : ''
                  }`}
                  onClick={() => handleFileClick(file)}
                  title={file.path}
                >
                  <span className="file-icon">{file.isDirectory ? '📁' : '📄'}</span>
                  <span className="file-name">{file.name}</span>
                  {!file.isDirectory && <span className="file-size">{formatFileSize(file.size)}</span>}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>No folder opened</p>
            <p className="hint">Click "Open Folder" to select a directory</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar

