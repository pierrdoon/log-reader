import { useState } from 'react'
import type { SSHConnectionConfig, SSHConnectionResult } from '../../preload/index.d'

interface SSHConnectionProps {
  onConnect: (connectionId: string, remotePath: string) => void
  onDisconnect: () => void
  isConnected: boolean
  connectionId: string | null
}

function SSHConnection({ onConnect, onDisconnect, isConnected, connectionId }: SSHConnectionProps): React.JSX.Element {
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<SSHConnectionConfig>({
    host: '',
    port: 22,
    username: '',
    password: '',
    privateKey: '',
    passphrase: ''
  })
  const [remotePath, setRemotePath] = useState('/')

  const handleConnect = async (): Promise<void> => {
    if (!config.host || !config.username) {
      setError('Host and username are required')
      return
    }

    if (!config.password && !config.privateKey) {
      setError('Either password or private key is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (!window.api || !window.api.sshConnect) {
        throw new Error('SSH API is not available')
      }

      const result: SSHConnectionResult = await window.api.sshConnect(config)
      if (result.success && result.connectionId) {
        setShowDialog(false)
        onConnect(result.connectionId, remotePath)
      } else {
        setError(result.error || 'Connection failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async (): Promise<void> => {
    if (connectionId && window.api && window.api.sshDisconnect) {
      try {
        await window.api.sshDisconnect(connectionId)
        onDisconnect()
      } catch (err) {
        console.error('Disconnect error:', err)
      }
    }
  }

  return (
    <div className="ssh-connection">
      {!isConnected ? (
        <button onClick={() => setShowDialog(true)} className="ssh-connect-btn">
          Connect via SSH
        </button>
      ) : (
        <div className="ssh-status">
          <span className="ssh-status-indicator">● Connected</span>
          <button onClick={handleDisconnect} className="ssh-disconnect-btn">
            Disconnect
          </button>
        </div>
      )}

      {showDialog && (
        <div className="ssh-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="ssh-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ssh-dialog-header">
              <h3>SSH Connection</h3>
              <button className="ssh-dialog-close" onClick={() => setShowDialog(false)}>
                ×
              </button>
            </div>
            <div className="ssh-dialog-content">
              {error && <div className="ssh-error">{error}</div>}
              <div className="ssh-form-group">
                <label>Host:</label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  placeholder="example.com"
                />
              </div>
              <div className="ssh-form-group">
                <label>Port:</label>
                <input
                  type="number"
                  value={config.port || 22}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 22 })}
                />
              </div>
              <div className="ssh-form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={config.username}
                  onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  placeholder="user"
                />
              </div>
              <div className="ssh-form-group">
                <label>Password:</label>
                <input
                  type="password"
                  value={config.password || ''}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  placeholder="Leave empty if using private key"
                />
              </div>
              <div className="ssh-form-group">
                <label>Private Key (optional):</label>
                <textarea
                  value={config.privateKey || ''}
                  onChange={(e) => setConfig({ ...config, privateKey: e.target.value })}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                  rows={4}
                />
              </div>
              {config.privateKey && (
                <div className="ssh-form-group">
                  <label>Passphrase (if key is encrypted):</label>
                  <input
                    type="password"
                    value={config.passphrase || ''}
                    onChange={(e) => setConfig({ ...config, passphrase: e.target.value })}
                  />
                </div>
              )}
              <div className="ssh-form-group">
                <label>Remote Path:</label>
                <input
                  type="text"
                  value={remotePath}
                  onChange={(e) => setRemotePath(e.target.value)}
                  placeholder="/var/log"
                />
              </div>
              <div className="ssh-dialog-actions">
                <button onClick={() => setShowDialog(false)} className="ssh-btn-cancel">
                  Cancel
                </button>
                <button onClick={handleConnect} disabled={loading} className="ssh-btn-connect">
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SSHConnection

