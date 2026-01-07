import { Client, ConnectConfig, SFTPWrapper } from 'ssh2'
import { createInterface } from 'readline'

export interface SSHConnectionConfig extends ConnectConfig {
  id?: string
}

export interface SSHFileContent {
  lines: string[]
  totalLines: number
  startLine: number
  endLine: number
  hasMore: boolean
  hasPrevious: boolean
}

export interface SSHFileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

interface ConnectionState {
  client: Client
  sftp: SFTPWrapper | null
  sftpPromise: Promise<SFTPWrapper> | null
  activeStreams: Set<any>
}

class SSHManager {
  private connections: Map<string, ConnectionState> = new Map()
  private maxConcurrentStreams = 3 // Ограничение на одновременные потоки

  async connect(config: SSHConnectionConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = new Client()
      const connectionId = config.id || `ssh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      client.on('ready', () => {
        this.connections.set(connectionId, {
          client,
          sftp: null,
          sftpPromise: null,
          activeStreams: new Set()
        })
        console.log(`SSH connection established: ${connectionId}`)
        resolve(connectionId)
      })

      client.on('error', (err) => {
        console.error('SSH connection error:', err)
        reject(err)
      })

      client.connect(config)
    })
  }

  async disconnect(connectionId: string): Promise<void> {
    const state = this.connections.get(connectionId)
    if (state) {
      // Закрываем все активные потоки
      state.activeStreams.forEach((stream) => {
        try {
          if (stream.destroy) stream.destroy()
        } catch (e) {
          // Игнорируем ошибки при закрытии
        }
      })
      state.activeStreams.clear()

      // Закрываем SFTP сессию
      if (state.sftp) {
        try {
          state.sftp.end()
        } catch (e) {
          // Игнорируем ошибки
        }
      }

      state.client.end()
      this.connections.delete(connectionId)
      console.log(`SSH connection closed: ${connectionId}`)
    }
  }

  // Получить или создать SFTP сессию (переиспользуем одну сессию)
  private async getSFTP(connectionId: string): Promise<SFTPWrapper> {
    const state = this.connections.get(connectionId)
    if (!state) {
      console.error(`[SSH] Connection not found when getting SFTP: ${connectionId}`)
      throw new Error(`SSH connection not found: ${connectionId}`)
    }

    // Если SFTP уже открыт, возвращаем его
    if (state.sftp) {
      console.log(`[SSH] Reusing existing SFTP session for ${connectionId}`)
      return state.sftp
    }

    // Если уже идет открытие SFTP, ждем его
    if (state.sftpPromise) {
      console.log(`[SSH] Waiting for existing SFTP promise for ${connectionId}`)
      return state.sftpPromise
    }

    // Создаем новую SFTP сессию
    console.log(`[SSH] Creating new SFTP session for ${connectionId}`)
    state.sftpPromise = new Promise((resolve, reject) => {
      state.client.sftp((err, sftp) => {
        if (err) {
          console.error(`[SSH] Failed to create SFTP session for ${connectionId}:`, err)
          state.sftpPromise = null
          reject(err)
          return
        }
        state.sftp = sftp
        state.sftpPromise = null
        console.log(`[SSH] SFTP session created successfully for ${connectionId}`)
        resolve(sftp)
      })
    })

    return state.sftpPromise
  }

  async readDirectory(connectionId: string, remotePath: string): Promise<SSHFileEntry[]> {
    const state = this.connections.get(connectionId)
    if (!state) {
      throw new Error(`SSH connection not found: ${connectionId}`)
    }

    const sftp = await this.getSFTP(connectionId)

    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          const errorMessage = err.message || String(err)
          reject(new Error(`Failed to read SSH directory ${remotePath}: ${errorMessage}`))
          return
        }

        if (!list) {
          reject(new Error(`No files found in ${remotePath}`))
          return
        }

        const files: SSHFileEntry[] = list.map((item) => ({
          name: item.filename,
          path: remotePath.endsWith('/') ? `${remotePath}${item.filename}` : `${remotePath}/${item.filename}`,
          isDirectory: item.longname.startsWith('d'),
          size: item.attrs.size || 0
        }))

        // Sort: directories first, then by name
        files.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })

        resolve(files)
      })
    })
  }

  async readFile(
    connectionId: string,
    remotePath: string,
    offset: number = 0,
    limit: number = 1000,
    onProgress?: (bytesRead: number, totalBytes: number) => void
  ): Promise<SSHFileContent> {
    console.log(`[SSH] Starting to read file: ${remotePath}, offset: ${offset}, limit: ${limit}`)
    const state = this.connections.get(connectionId)
    if (!state) {
      console.error(`[SSH] Connection not found: ${connectionId}`)
      throw new Error(`SSH connection not found: ${connectionId}`)
    }

    // Проверяем количество активных потоков
    console.log(`[SSH] Active streams: ${state.activeStreams.size}/${this.maxConcurrentStreams}`)
    if (state.activeStreams.size >= this.maxConcurrentStreams) {
      console.error(`[SSH] Too many concurrent streams: ${state.activeStreams.size}`)
      throw new Error(`Too many concurrent streams. Maximum: ${this.maxConcurrentStreams}`)
    }

    console.log(`[SSH] Getting SFTP session for connection: ${connectionId}`)
    const sftp = await this.getSFTP(connectionId)
    console.log(`[SSH] SFTP session obtained, creating read stream`)

    // Получаем размер файла для прогресса
    let fileSize = 0
    try {
      const stats = await this.getFileStats(connectionId, remotePath)
      fileSize = stats.size
      console.log(`[SSH] File size: ${fileSize} bytes`)
    } catch (err) {
      console.warn(`[SSH] Could not get file size:`, err)
    }

    return new Promise((resolve, reject) => {
      // Используем потоковое чтение для больших файлов
      // highWaterMark контролирует размер буфера (256KB для больших файлов)
      console.log(`[SSH] Creating read stream for: ${remotePath}`)
      const stream = sftp.createReadStream(remotePath, {
        encoding: 'utf-8',
        highWaterMark: 256 * 1024 // 256KB буфер для эффективного чтения больших файлов
      })

      // Отслеживаем активные потоки
      state.activeStreams.add(stream)
      console.log(`[SSH] Stream created, active streams: ${state.activeStreams.size}`)

      const lines: string[] = []
      let currentLine = 0
      const startLine = Math.max(0, offset)
      const endLine = offset + limit
      let streamEnded = false
      let resolved = false

      const cleanup = () => {
        console.log(`[SSH] Cleaning up stream for ${remotePath}, activeStreams before: ${state.activeStreams.size}`)
        state.activeStreams.delete(stream)
        console.log(`[SSH] Active streams after cleanup: ${state.activeStreams.size}`)
        try {
          if (!streamEnded) {
            rl.close()
          }
          if (stream.destroy) {
            stream.destroy()
          }
        } catch (e) {
          console.warn(`[SSH] Error during cleanup for ${remotePath}:`, e)
        }
      }

      console.log(`[SSH] Creating readline interface`)
      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity
      })

      // Таймаут с продлением при получении данных
      // Для больших файлов нужно больше времени, особенно если offset большой
      let timeout: NodeJS.Timeout | null = null
      let lastActivityTime = Date.now()
      const TIMEOUT_DURATION = 300000 // 5 минут для больших файлов
      const ACTIVITY_THRESHOLD = 60000 // Продлеваем таймаут, если была активность в последнюю минуту

      const resetTimeout = () => {
        if (timeout) {
          clearTimeout(timeout)
        }
        lastActivityTime = Date.now()
        timeout = setTimeout(() => {
          const timeSinceLastActivity = Date.now() - lastActivityTime
          // Если была активность недавно, продлеваем таймаут
          if (timeSinceLastActivity < ACTIVITY_THRESHOLD && !resolved) {
            console.log(`[SSH] Timeout extended, activity detected ${Math.round(timeSinceLastActivity / 1000)}s ago`)
            resetTimeout()
            return
          }
          if (!resolved) {
            resolved = true
            console.error(`[SSH] Timeout reading file ${remotePath} (no activity for ${Math.round(timeSinceLastActivity / 1000)}s)`)
            cleanup()
            if (timeout) {
              clearTimeout(timeout)
              timeout = null
            }
            reject(new Error(`Timeout reading file ${remotePath} (no activity for ${Math.round(timeSinceLastActivity / 1000)}s)`))
          }
        }, TIMEOUT_DURATION)
      }

      // Начинаем с таймаута
      console.log(`[SSH] Starting timeout timer (${TIMEOUT_DURATION / 1000}s)`)
      resetTimeout()

      // Отслеживаем активность потока и прогресс
      let bytesRead = 0
      stream.on('data', (chunk) => {
        if (!resolved) {
          lastActivityTime = Date.now()
          bytesRead += chunk.length
          // Логируем только первые несколько чанков, чтобы не спамить
          if (bytesRead <= 1024 * 1024 || bytesRead % (5 * 1024 * 1024) === 0) {
            console.log(`[SSH] Stream data received, chunk size: ${chunk.length} bytes, total: ${bytesRead} bytes`)
          }
          // Вызываем callback прогресса, если он есть
          if (onProgress && fileSize > 0) {
            onProgress(bytesRead, fileSize)
          }
        }
      })

      stream.on('open', () => {
        console.log(`[SSH] Stream opened for: ${remotePath}`)
      })

      rl.on('line', (line) => {
        if (resolved) return

        // Обновляем время последней активности
        lastActivityTime = Date.now()

        if (currentLine >= startLine && currentLine < endLine) {
          lines.push(line)
        }
        currentLine++

        // Показываем прогресс для больших файлов
        if (currentLine % 10000 === 0) {
          console.log(`[SSH] Progress: processed ${currentLine} lines, collected ${lines.length}/${endLine - startLine} target lines, file: ${remotePath}`)
        }

        // Останавливаем чтение, если получили достаточно строк
        if (currentLine >= endLine && !streamEnded && !resolved) {
          console.log(`[SSH] Reached target line count: ${currentLine} >= ${endLine}, stopping read`)
          streamEnded = true
          resolved = true
          const actualEndLine = Math.min(endLine, currentLine)
          // Закрываем поток перед resolve
          try {
            rl.close()
            console.log(`[SSH] Readline interface closed`)
          } catch (e) {
            console.error(`[SSH] Error closing readline:`, e)
          }
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
          }
          cleanup()
          console.log(`[SSH] File read completed: ${remotePath}, lines: ${lines.length}, total processed: ${currentLine}`)
          resolve({
            lines,
            totalLines: currentLine,
            startLine: startLine + 1,
            endLine: actualEndLine,
            hasMore: currentLine >= endLine,
            hasPrevious: offset > 0
          })
        }
      })

      rl.on('close', () => {
        console.log(`[SSH] Readline interface closed, resolved: ${resolved}, currentLine: ${currentLine}`)
        if (!resolved) {
          streamEnded = true
          resolved = true
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
          }
          cleanup()
          const actualEndLine = Math.min(endLine, currentLine)
          console.log(`[SSH] File read completed (EOF): ${remotePath}, lines: ${lines.length}, total: ${currentLine}`)
          resolve({
            lines,
            totalLines: currentLine,
            startLine: startLine + 1,
            endLine: actualEndLine,
            hasMore: currentLine >= endLine,
            hasPrevious: offset > 0
          })
        }
      })

      rl.on('error', (error) => {
        if (!resolved) {
          resolved = true
          console.error(`[SSH] Readline error for ${remotePath}:`, error)
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
          }
          cleanup()
          reject(error)
        }
      })

      stream.on('error', (error) => {
        if (!resolved) {
          resolved = true
          console.error(`[SSH] Stream error for ${remotePath}:`, error)
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
          }
          cleanup()
          reject(error)
        }
      })

      stream.on('end', () => {
        console.log(`[SSH] Stream ended for: ${remotePath}`)
      })

    })
  }

  async getLineCount(connectionId: string, remotePath: string): Promise<number> {
    const state = this.connections.get(connectionId)
    if (!state) {
      throw new Error(`SSH connection not found: ${connectionId}`)
    }

    const sftp = await this.getSFTP(connectionId)

    return new Promise((resolve, reject) => {
      const stream = sftp.createReadStream(remotePath, {
        encoding: 'utf-8',
        highWaterMark: 256 * 1024
      })

      state.activeStreams.add(stream)
      let lineCount = 0
      let resolved = false

      const cleanup = () => {
        state.activeStreams.delete(stream)
        try {
          rl.close()
          if (stream.destroy) {
            stream.destroy()
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }

      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity
      })

      rl.on('line', () => {
        lineCount++
      })

      rl.on('close', () => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve(lineCount)
        }
      })

      rl.on('error', (error) => {
        if (!resolved) {
          resolved = true
          cleanup()
          console.error('Error counting SSH file lines:', error)
          reject(error)
        }
      })

      stream.on('error', (error) => {
        if (!resolved) {
          resolved = true
          cleanup()
          console.error('Error reading SSH file stream:', error)
          reject(error)
        }
      })

      // Таймаут 60 секунд для подсчета строк больших файлов
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          reject(new Error(`Timeout counting lines in ${remotePath}`))
        }
      }, 60000)

      rl.once('close', () => clearTimeout(timeout))
      stream.once('error', () => clearTimeout(timeout))
    })
  }

  async getFileStats(connectionId: string, remotePath: string): Promise<{ size: number; modified: Date }> {
    const state = this.connections.get(connectionId)
    if (!state) {
      throw new Error(`SSH connection not found: ${connectionId}`)
    }

    const sftp = await this.getSFTP(connectionId)

    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) {
          reject(err)
          return
        }

        resolve({
          size: stats.size || 0,
          modified: stats.mtime ? new Date(stats.mtime * 1000) : new Date()
        })
      })
    })
  }

  isConnected(connectionId: string): boolean {
    return this.connections.has(connectionId)
  }

  getAllConnections(): string[] {
    return Array.from(this.connections.keys())
  }
}

export const sshManager = new SSHManager()

