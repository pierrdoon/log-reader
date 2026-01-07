import { ElectronAPI } from '@electron-toolkit/preload'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

export interface FileContent {
  lines: string[]
  totalLines: number
  startLine: number
  endLine: number
  hasMore: boolean
  hasPrevious: boolean
}

export interface FileStats {
  size: number
  modified: Date
}

export interface SSHConnectionConfig {
  host: string
  port?: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  id?: string
}

export interface SSHConnectionResult {
  success: boolean
  connectionId?: string
  error?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openDirectory: () => Promise<string | null>
      readDirectory: (path: string) => Promise<FileEntry[]>
      readFile: (path: string, offset?: number, limit?: number) => Promise<FileContent>
      getFileStats: (path: string) => Promise<FileStats>
      getLineCount: (path: string) => Promise<number>
      // SSH APIs
      sshConnect: (config: SSHConnectionConfig) => Promise<SSHConnectionResult>
      sshDisconnect: (connectionId: string) => Promise<{ success: boolean; error?: string }>
      sshReadDirectory: (connectionId: string, remotePath: string) => Promise<FileEntry[]>
      sshReadFile: (
        connectionId: string,
        remotePath: string,
        offset?: number,
        limit?: number
      ) => Promise<FileContent>
      sshGetLineCount: (connectionId: string, remotePath: string) => Promise<number>
      sshGetFileStats: (connectionId: string, remotePath: string) => Promise<FileStats>
      sshIsConnected: (connectionId: string) => Promise<boolean>
      onSSHReadFileProgress: (
        callback: (progress: {
          connectionId: string
          remotePath: string
          bytesRead: number
          totalBytes: number
          progress: number
        }) => void
      ) => void
      offSSHReadFileProgress: () => void
    }
  }
}
