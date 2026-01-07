import { describe, it, expect } from 'vitest'

// Тесты для утилитарных функций
describe('Utility Functions', () => {
  describe('formatBytes', () => {
    // Эта функция находится в LogViewer, но мы можем протестировать логику
    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }

    it('должен форматировать байты', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(512)).toBe('512 B')
    })

    it('должен форматировать килобайты', () => {
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
    })

    it('должен форматировать мегабайты', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
    })

    it('должен форматировать гигабайты', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB')
    })
  })

  describe('formatFileSize', () => {
    // Функция из Sidebar
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    it('должен форматировать размер файла', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(512)).toBe('512 B')
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    })
  })
})

