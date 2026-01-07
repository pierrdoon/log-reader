import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
  readFile: (path: string, offset?: number, limit?: number) =>
    ipcRenderer.invoke('fs:readFile', path, offset, limit),
  getFileStats: (path: string) => ipcRenderer.invoke('fs:getFileStats', path),
  getLineCount: (path: string) => ipcRenderer.invoke('fs:getLineCount', path),
  // SSH APIs
  sshConnect: (config: any) => ipcRenderer.invoke('ssh:connect', config),
  sshDisconnect: (connectionId: string) => ipcRenderer.invoke('ssh:disconnect', connectionId),
  sshReadDirectory: (connectionId: string, remotePath: string) =>
    ipcRenderer.invoke('ssh:readDirectory', connectionId, remotePath),
  sshReadFile: (connectionId: string, remotePath: string, offset?: number, limit?: number) =>
    ipcRenderer.invoke('ssh:readFile', connectionId, remotePath, offset, limit),
  sshGetLineCount: (connectionId: string, remotePath: string) =>
    ipcRenderer.invoke('ssh:getLineCount', connectionId, remotePath),
  sshGetFileStats: (connectionId: string, remotePath: string) =>
    ipcRenderer.invoke('ssh:getFileStats', connectionId, remotePath),
  sshIsConnected: (connectionId: string) => ipcRenderer.invoke('ssh:isConnected', connectionId),
  // SSH progress event listener
  onSSHReadFileProgress: (callback: (progress: { connectionId: string; remotePath: string; bytesRead: number; totalBytes: number; progress: number }) => void) => {
    ipcRenderer.on('ssh:readFile:progress', (_, progress) => callback(progress))
  },
  offSSHReadFileProgress: () => {
    ipcRenderer.removeAllListeners('ssh:readFile:progress')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
