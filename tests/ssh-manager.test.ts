import { describe, it, expect, beforeEach } from 'vitest'
import { sshManager } from '../src/main/ssh-manager'

describe('SSHManager', () => {
  beforeEach(() => {
    // Очищаем все подключения перед каждым тестом
    const connections = sshManager.getAllConnections()
    for (const connId of connections) {
      sshManager.disconnect(connId).catch(() => {})
    }
  })

  describe('isConnected', () => {
    it('должен вернуть false для несуществующего подключения', () => {
      expect(sshManager.isConnected('nonexistent')).toBe(false)
    })
  })

  describe('getAllConnections', () => {
    it('должен вернуть пустой массив когда нет подключений', () => {
      const connections = sshManager.getAllConnections()
      expect(connections).toEqual([])
    })
  })

  describe('disconnect', () => {
    it('должен безопасно обработать отключение несуществующего подключения', async () => {
      await expect(sshManager.disconnect('nonexistent')).resolves.not.toThrow()
    })
  })
})

