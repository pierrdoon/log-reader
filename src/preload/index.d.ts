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

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openDirectory: () => Promise<string | null>
      readDirectory: (path: string) => Promise<FileEntry[]>
      readFile: (path: string, offset?: number, limit?: number) => Promise<FileContent>
      getFileStats: (path: string) => Promise<FileStats>
      getLineCount: (path: string) => Promise<number>
    }
  }
}
