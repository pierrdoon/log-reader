import { useState, useEffect } from 'react'
import type { FileEntry } from '../../preload/index.d'
import SSHConnection from './SSHConnection'

interface SidebarProps {
  onFileSelect: (filePath: string, isSSH?: boolean, connectionId?: string) => void
  selectedFile: string | null
}

function Sidebar({ onFileSelect, selectedFile }: SidebarProps): React.JSX.Element {
  const [directory, setDirectory] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)
  const [sshConnectionId, setSshConnectionId] = useState<string | null>(null)
  const [isSSHMode, setIsSSHMode] = useState(false)

  useEffect(() => {
    // Check if API is available
    if (
      typeof window !== 'undefined' &&
      window.api &&
      typeof window.api.openDirectory === 'function'
    ) {
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
        await loadFiles(dirPath, false, null)
      }
    } catch (error) {
      console.error('Error opening directory:', error)
      alert(`Error opening directory: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async (
    dirPath: string,
    useSSH: boolean = false,
    connectionId: string | null = null
  ): Promise<void> => {
    try {
      if (useSSH && connectionId) {
        const fileList = await window.api.sshReadDirectory(connectionId, dirPath)
        setFiles(fileList)
      } else {
        const fileList = await window.api.readDirectory(dirPath)
        setFiles(fileList)
      }
    } catch (error) {
      console.error('Error loading files:', error)
      alert(`Error loading files: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleSSHConnect = async (connectionId: string, remotePath: string): Promise<void> => {
    setSshConnectionId(connectionId)
    setDirectory(`ssh://${connectionId}${remotePath}`)
    setIsSSHMode(true)
    // Используем параметры напрямую, так как setState асинхронный
    await loadFiles(remotePath, true, connectionId)
  }

  const handleSSHDisconnect = (): void => {
    setSshConnectionId(null)
    setDirectory(null)
    setIsSSHMode(false)
    setFiles([])
  }

  const handleFileClick = (file: FileEntry): void => {
    if (file.isDirectory) {
      setDirectory(file.path)
      // Используем текущее состояние для определения режима
      loadFiles(file.path, isSSHMode, sshConnectionId)
    } else {
      if (isSSHMode && sshConnectionId) {
        onFileSelect(file.path, true, sshConnectionId)
      } else {
        onFileSelect(file.path, false)
      }
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
        <SSHConnection
          onConnect={handleSSHConnect}
          onDisconnect={handleSSHDisconnect}
          isConnected={isSSHMode}
          connectionId={sshConnectionId}
        />
        {!isSSHMode && (
          <button
            onClick={handleOpenDirectory}
            disabled={loading || !apiAvailable}
            className="open-dir-btn"
            title={!apiAvailable ? 'API not available' : ''}
          >
            {loading ? 'Loading...' : 'Open Folder'}
          </button>
        )}
      </div>
      <div className="sidebar-content">
        {directory ? (
          <div className="file-list">
            <div className="directory-path">
              {isSSHMode ? '🔐 ' : ''}
              {directory}
            </div>
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
                  {!file.isDirectory && (
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>No folder opened</p>
            <p className="hint">
              Click &quot;Open Folder&quot; or &quot;Connect via SSH&quot; to get started
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar
