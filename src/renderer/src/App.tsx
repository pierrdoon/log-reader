import { useState } from 'react'
import Sidebar from './components/Sidebar'
import LogViewer from './components/LogViewer'

function App(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [isSSH, setIsSSH] = useState(false)
  const [sshConnectionId, setSshConnectionId] = useState<string | undefined>(undefined)

  const handleFileSelect = (filePath: string, isSSHMode?: boolean, connectionId?: string): void => {
    setSelectedFile(filePath)
    setIsSSH(isSSHMode || false)
    setSshConnectionId(connectionId)
  }

  return (
    <div className="app-container">
      <Sidebar onFileSelect={handleFileSelect} selectedFile={selectedFile} />
      <LogViewer filePath={selectedFile} isSSH={isSSH} sshConnectionId={sshConnectionId} />
    </div>
  )
}

export default App
