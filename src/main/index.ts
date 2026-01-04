import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { createReadStream } from 'fs'
import { readdir, stat } from 'fs/promises'
import { createInterface } from 'readline'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers for file system operations
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (!canceled && filePaths.length > 0) {
      return filePaths[0]
    }
    return null
  })

  ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      const files = []
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        const stats = await stat(fullPath)
        files.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stats.size
        })
      }
      return files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error('Error reading directory:', error)
      return []
    }
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string, offset: number = 0, limit: number = 1000) => {
    return new Promise((resolve, reject) => {
      try {
        const lines: string[] = []
        let currentLine = 0
        const startLine = Math.max(0, offset)
        const endLine = offset + limit
        let streamEnded = false

        const fileStream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 64 * 1024 }) // 64KB chunks
        const rl = createInterface({
          input: fileStream,
          crlfDelay: Infinity
        })

        rl.on('line', (line) => {
          if (currentLine >= startLine && currentLine < endLine) {
            lines.push(line)
          }
          currentLine++
          
          // Stop reading if we've got enough lines
          if (currentLine >= endLine && !streamEnded) {
            rl.close()
            fileStream.destroy()
          }
        })

        rl.on('close', () => {
          streamEnded = true
          const actualEndLine = Math.min(endLine, currentLine)
          resolve({
            lines,
            totalLines: currentLine, // Approximate, will be updated by getLineCount
            startLine: startLine + 1, // 1-based for display
            endLine: actualEndLine,
            hasMore: currentLine >= endLine,
            hasPrevious: offset > 0
          })
        })

        rl.on('error', (error) => {
          console.error('Error reading file:', error)
          reject(error)
        })

        fileStream.on('error', (error) => {
          console.error('Error reading file stream:', error)
          reject(error)
        })
      } catch (error) {
        console.error('Error reading file:', error)
        reject(error)
      }
    })
  })

  // New method to get total line count without loading entire file
  ipcMain.handle('fs:getLineCount', async (_, filePath: string) => {
    return new Promise((resolve, reject) => {
      try {
        let lineCount = 0
        const fileStream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 64 * 1024 })
        const rl = createInterface({
          input: fileStream,
          crlfDelay: Infinity
        })

        rl.on('line', () => {
          lineCount++
        })

        rl.on('close', () => {
          resolve(lineCount)
        })

        rl.on('error', (error) => {
          console.error('Error counting lines:', error)
          reject(error)
        })

        fileStream.on('error', (error) => {
          console.error('Error reading file stream:', error)
          reject(error)
        })
      } catch (error) {
        console.error('Error counting lines:', error)
        reject(error)
      }
    })
  })

  ipcMain.handle('fs:getFileStats', async (_, filePath: string) => {
    try {
      const stats = await stat(filePath)
      return {
        size: stats.size,
        modified: stats.mtime
      }
    } catch (error) {
      console.error('Error getting file stats:', error)
      throw error
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
