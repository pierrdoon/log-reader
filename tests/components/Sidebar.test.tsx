import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '../../src/renderer/src/components/Sidebar'

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

describe('Sidebar', () => {
  const mockOnFileSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.openDirectory.mockResolvedValue(null)
    mockApi.readDirectory.mockResolvedValue([])
  })

  it('должен отображать кнопку "Open Folder"', () => {
    render(<Sidebar onFileSelect={mockOnFileSelect} selectedFile={null} />)
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
  })

  it('должен отображать кнопку "Connect via SSH"', () => {
    render(<Sidebar onFileSelect={mockOnFileSelect} selectedFile={null} />)
    expect(screen.getByText('Connect via SSH')).toBeInTheDocument()
  })

  it('должен показывать пустое состояние когда нет открытой директории', () => {
    render(<Sidebar onFileSelect={mockOnFileSelect} selectedFile={null} />)
    expect(screen.getByText('No folder opened')).toBeInTheDocument()
  })

  it('должен открыть диалог выбора директории при клике на "Open Folder"', async () => {
    const user = userEvent.setup()
    mockApi.openDirectory.mockResolvedValue('/test/path')
    mockApi.readDirectory.mockResolvedValue([
      { name: 'file1.log', path: '/test/path/file1.log', isDirectory: false, size: 1024 }
    ])

    render(<Sidebar onFileSelect={mockOnFileSelect} selectedFile={null} />)
    const button = screen.getByText('Open Folder')
    
    await user.click(button)

    await waitFor(() => {
      expect(mockApi.openDirectory).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('должен загружать файлы после выбора директории', async () => {
    const user = userEvent.setup()
    const testPath = '/test/path'
    const testFiles = [
      { name: 'file1.log', path: '/test/path/file1.log', isDirectory: false, size: 1024 },
      { name: 'file2.log', path: '/test/path/file2.log', isDirectory: false, size: 2048 }
    ]

    mockApi.openDirectory.mockResolvedValue(testPath)
    mockApi.readDirectory.mockResolvedValue(testFiles)

    render(<Sidebar onFileSelect={mockOnFileSelect} selectedFile={null} />)
    const button = screen.getByText('Open Folder')
    await user.click(button)

    await waitFor(() => {
      expect(mockApi.readDirectory).toHaveBeenCalledWith(testPath)
    })

    await waitFor(() => {
      expect(screen.getByText('file1.log')).toBeInTheDocument()
      expect(screen.getByText('file2.log')).toBeInTheDocument()
    })
  })

  it('должен вызывать onFileSelect при клике на файл', async () => {
    const user = userEvent.setup()
    const testPath = '/test/path'
    const testFiles = [
      { name: 'file1.log', path: '/test/path/file1.log', isDirectory: false, size: 1024 }
    ]

    mockApi.openDirectory.mockResolvedValue(testPath)
    mockApi.readDirectory.mockResolvedValue(testFiles)

    render(<Sidebar onFileSelect={mockOnFileSelect} selectedFile={null} />)
    const button = screen.getByText('Open Folder')
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('file1.log')).toBeInTheDocument()
    })

    const fileItem = screen.getByText('file1.log')
    await user.click(fileItem)

    expect(mockOnFileSelect).toHaveBeenCalledWith('/test/path/file1.log', false)
  })
})

