import { useState, useEffect, useRef, useCallback } from 'react'
import type { FileContent } from '../../preload/index.d'

interface LogViewerProps {
  filePath: string | null
  isSSH?: boolean
  sshConnectionId?: string
}

const LINES_PER_LOAD = 500
const SCROLL_THRESHOLD = 200 // pixels from bottom to trigger load

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function LogViewer({ filePath, isSSH = false, sshConnectionId }: LogViewerProps): React.JSX.Element {
  const [allLines, setAllLines] = useState<string[]>([])
  const [totalLines, setTotalLines] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadProgress, setLoadProgress] = useState<{ bytesRead: number; totalBytes: number; progress: number } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  useEffect(() => {
    if (filePath) {
      resetAndLoad(filePath)
    } else {
      setAllLines([])
      setTotalLines(0)
      setError(null)
      setCurrentOffset(0)
      setHasMore(true)
      setLoadProgress(null)
    }
  }, [filePath])

  // Подписываемся на события прогресса для SSH файлов
  useEffect(() => {
    if (!isSSH || !window.api?.onSSHReadFileProgress) return

    const handleProgress = (progress: {
      connectionId: string
      remotePath: string
      bytesRead: number
      totalBytes: number
      progress: number
    }) => {
      // Обновляем прогресс только если это текущий файл
      if (filePath && progress.remotePath === filePath) {
        setLoadProgress({
          bytesRead: progress.bytesRead,
          totalBytes: progress.totalBytes,
          progress: progress.progress
        })
      }
    }

    window.api.onSSHReadFileProgress(handleProgress)

    return () => {
      if (window.api?.offSSHReadFileProgress) {
        window.api.offSSHReadFileProgress()
      }
    }
  }, [isSSH, filePath])

  const resetAndLoad = async (path: string): Promise<void> => {
    setLoading(true)
    setError(null)
    setAllLines([])
    setCurrentOffset(0)
    setHasMore(true)
    setLoadProgress(null)
    loadingRef.current = false

    try {
      // Для больших файлов не считаем общее количество строк сразу - это может занять много времени
      // Будем обновлять по мере загрузки
      setTotalLines(0)

      // Load initial chunk асинхронно
      let fileContent: FileContent
      if (isSSH && sshConnectionId && window.api && typeof window.api.sshReadFile === 'function') {
        fileContent = await window.api.sshReadFile(sshConnectionId, path, 0, LINES_PER_LOAD)
      } else {
        fileContent = await window.api.readFile(path, 0, LINES_PER_LOAD)
      }
      
      setAllLines(fileContent.lines)
      setCurrentOffset(LINES_PER_LOAD)
      setHasMore(fileContent.hasMore)
      
      // Обновляем общее количество строк из результата чтения
      // Это приблизительное значение, но достаточно для отображения
      if (fileContent.totalLines > 0) {
        setTotalLines(fileContent.totalLines)
      }

      // Для больших файлов не пытаемся считать точное количество строк в фоне
      // Это может занять слишком много времени и ресурсов
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
      setAllLines([])
    } finally {
      setLoading(false)
    }
  }

  const loadMore = useCallback(async (): Promise<void> => {
    if (!filePath || loadingRef.current || !hasMore) return

    loadingRef.current = true
    setLoadingMore(true)

    try {
      let fileContent: FileContent
      if (isSSH && sshConnectionId && window.api && typeof window.api.sshReadFile === 'function') {
        fileContent = await window.api.sshReadFile(sshConnectionId, filePath, currentOffset, LINES_PER_LOAD)
      } else {
        fileContent = await window.api.readFile(filePath, currentOffset, LINES_PER_LOAD)
      }
      
      setAllLines((prev) => [...prev, ...fileContent.lines])
      setCurrentOffset((prev) => prev + fileContent.lines.length)
      setHasMore(fileContent.hasMore)
    } catch (err) {
      console.error('Error loading more lines:', err)
      setError(err instanceof Error ? err.message : 'Failed to load more lines')
    } finally {
      setLoadingMore(false)
      loadingRef.current = false
    }
  }, [filePath, currentOffset, hasMore, isSSH, sshConnectionId])

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || loadingRef.current || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    if (distanceFromBottom < SCROLL_THRESHOLD) {
      loadMore()
    }
  }, [loadMore, hasMore])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => {
        container.removeEventListener('scroll', handleScroll)
      }
    }
  }, [handleScroll])

  if (!filePath) {
    return (
      <div className="log-viewer">
        <div className="log-viewer-empty">
          <p>No file selected</p>
          <p className="hint">Select a file from the sidebar to view its content</p>
        </div>
      </div>
    )
  }

  if (loading) {
    const fileName = filePath.split(/[/\\]/).pop()
    return (
      <div className="log-viewer">
        <div className="log-viewer-header">
          <div className="file-info">
            <span className="file-name">{fileName}</span>
            {isSSH && <span className="file-source-badge">SSH</span>}
          </div>
        </div>
        <div className="log-viewer-loading">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">
              {isSSH ? 'Connecting to server and reading file...' : 'Loading file...'}
            </p>
            <p className="loading-hint">
              {isSSH
                ? 'This may take a moment for large files'
                : 'Please wait'}
            </p>
            {loadProgress && loadProgress.totalBytes > 0 ? (
              <div className="progress-container">
                <div className="progress-info">
                  <span>
                    {formatBytes(loadProgress.bytesRead)} / {formatBytes(loadProgress.totalBytes)}
                  </span>
                  <span>{loadProgress.progress}%</span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${loadProgress.progress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="progress-bar-container">
                <div className="progress-bar"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (error && allLines.length === 0) {
    return (
      <div className="log-viewer">
        <div className="log-viewer-error">
          <p>Error loading file</p>
          <p className="error-message">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="log-viewer">
      <div className="log-viewer-header">
        <div className="file-info">
          <span className="file-name">{filePath.split(/[/\\]/).pop()}</span>
          <span className="file-stats">
            {allLines.length.toLocaleString()} lines loaded
            {totalLines > 0 && ` of ${totalLines.toLocaleString()}`}
            {hasMore && ' (loading more...)'}
          </span>
        </div>
      </div>
      <div className="log-viewer-content" ref={scrollContainerRef}>
        <div className="log-lines">
          {allLines.map((line, index) => {
            const lineNumber = index + 1
            return (
              <div key={index} className="log-line">
                <span className="line-number">{lineNumber}</span>
                <span className="line-content">{line || ' '}</span>
              </div>
            )
          })}
          {loadingMore && (
            <div className="loading-more-indicator">
              <span>Loading more lines...</span>
            </div>
          )}
          {!hasMore && allLines.length > 0 && (
            <div className="end-of-file-indicator">
              <span>End of file</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LogViewer
