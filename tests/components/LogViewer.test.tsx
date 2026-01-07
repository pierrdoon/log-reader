import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LogViewer from '../../src/renderer/src/components/LogViewer'

// Мокаем window.api
const mockApi = {
  openDirectory: vi.fn(),
  readDirectory: vi.fn(),
  readFile: vi.fn(),
  getFileStats: vi.fn(),
  getLineCount: vi.fn(),
  sshConnect: vi.fn(),
  sshDisconnect: vi.fn(),
  sshReadDirectory: vi.fn(),
  sshReadFile: vi.fn(),
  sshGetLineCount: vi.fn(),
  sshGetFileStats: vi.fn(),
  sshIsConnected: vi.fn(),
  onSSHReadFileProgress: vi.fn(),
  offSSHReadFileProgress: vi.fn()
}

Object.defineProperty(window, 'api', {
  writable: true,
  value: mockApi
})

describe('LogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('должен показывать пустое состояние когда файл не выбран', () => {
    render(<LogViewer filePath={null} />)
    expect(screen.getByText('No file selected')).toBeInTheDocument()
  })

  it('должен показывать индикатор загрузки при загрузке файла', async () => {
    const mockFileContent = {
      lines: ['line 1', 'line 2', 'line 3'],
      totalLines: 3,
      startLine: 1,
      endLine: 3,
      hasMore: false,
      hasPrevious: false
    }

    mockApi.readFile.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockFileContent), 50)))

    render(<LogViewer filePath="/test/file.log" />)

    // Проверяем, что индикатор загрузки показывается
    expect(screen.getByText(/Loading file/i)).toBeInTheDocument()

    // Ждем загрузки
    await waitFor(() => {
      expect(screen.getByText('line 1')).toBeInTheDocument()
    }, { timeout: 200 })
  })

  it('должен отображать содержимое файла после загрузки', async () => {
    const mockFileContent = {
      lines: ['line 1', 'line 2', 'line 3'],
      totalLines: 3,
      startLine: 1,
      endLine: 3,
      hasMore: false,
      hasPrevious: false
    }

    mockApi.readFile.mockResolvedValue(mockFileContent)

    render(<LogViewer filePath="/test/file.log" />)

    await waitFor(() => {
      expect(screen.getByText('line 1')).toBeInTheDocument()
      expect(screen.getByText('line 2')).toBeInTheDocument()
      expect(screen.getByText('line 3')).toBeInTheDocument()
    })
  })

  it('должен показывать ошибку при неудачной загрузке', async () => {
    const errorMessage = 'Failed to read file'
    mockApi.readFile.mockRejectedValue(new Error(errorMessage))

    render(<LogViewer filePath="/test/file.log" />)

    await waitFor(() => {
      expect(screen.getByText('Error loading file')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('должен использовать SSH API для SSH файлов', async () => {
    const mockFileContent = {
      lines: ['ssh line 1', 'ssh line 2'],
      totalLines: 2,
      startLine: 1,
      endLine: 2,
      hasMore: false,
      hasPrevious: false
    }

    mockApi.sshReadFile.mockResolvedValue(mockFileContent)

    render(<LogViewer filePath="/remote/file.log" isSSH={true} sshConnectionId="test-conn-id" />)

    await waitFor(() => {
      expect(mockApi.sshReadFile).toHaveBeenCalledWith('test-conn-id', '/remote/file.log', 0, 500)
    })
  })

  it('должен показывать бейдж SSH для SSH файлов', async () => {
    const mockFileContent = {
      lines: ['line 1'],
      totalLines: 1,
      startLine: 1,
      endLine: 1,
      hasMore: false,
      hasPrevious: false
    }

    mockApi.sshReadFile.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockFileContent), 50)))

    render(<LogViewer filePath="/remote/file.log" isSSH={true} sshConnectionId="test-conn-id" />)

    await waitFor(() => {
      expect(screen.getByText('SSH')).toBeInTheDocument()
    }, { timeout: 100 })
  })

  it('должен отображать статистику файла', async () => {
    const mockFileContent = {
      lines: Array(100).fill('line'),
      totalLines: 100,
      startLine: 1,
      endLine: 100,
      hasMore: false,
      hasPrevious: false
    }

    mockApi.readFile.mockResolvedValue(mockFileContent)

    render(<LogViewer filePath="/test/file.log" />)

    await waitFor(() => {
      expect(screen.getByText(/100 lines loaded/i)).toBeInTheDocument()
    })
  })
})

