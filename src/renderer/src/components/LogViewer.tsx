import { useState, useEffect, useRef, useCallback } from 'react'
import type { FileContent } from '../../preload/index.d'

interface LogViewerProps {
  filePath: string | null
}

const LINES_PER_LOAD = 500
const SCROLL_THRESHOLD = 200 // pixels from bottom to trigger load

function LogViewer({ filePath }: LogViewerProps): React.JSX.Element {
  const [allLines, setAllLines] = useState<string[]>([])
  const [totalLines, setTotalLines] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
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
    }
  }, [filePath])

  const resetAndLoad = async (path: string): Promise<void> => {
    setLoading(true)
    setError(null)
    setAllLines([])
    setCurrentOffset(0)
    setHasMore(true)
    loadingRef.current = false

    try {
      // Get total line count first (if available)
      if (window.api && typeof window.api.getLineCount === 'function') {
        try {
          const lineCount = await window.api.getLineCount(path)
          setTotalLines(lineCount)
        } catch (err) {
          console.warn('Failed to get line count, continuing without it:', err)
          setTotalLines(0) // Will be updated as we load
        }
      } else {
        console.warn('getLineCount is not available. Available methods:', Object.keys(window.api || {}))
        setTotalLines(0) // Will be updated as we load
      }

      // Load initial chunk
      const fileContent = await window.api.readFile(path, 0, LINES_PER_LOAD)
      setAllLines(fileContent.lines)
      setCurrentOffset(LINES_PER_LOAD)
      setHasMore(fileContent.hasMore)
      
      // Update total lines if we got it from readFile
      if (fileContent.totalLines > 0) {
        setTotalLines(fileContent.totalLines)
      }
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
      const fileContent = await window.api.readFile(filePath, currentOffset, LINES_PER_LOAD)
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
  }, [filePath, currentOffset, hasMore])

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
    return (
      <div className="log-viewer">
        <div className="log-viewer-header">
          <div className="file-info">
            <span className="file-name">{filePath.split(/[/\\]/).pop()}</span>
          </div>
        </div>
        <div className="log-viewer-loading">Loading file...</div>
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
