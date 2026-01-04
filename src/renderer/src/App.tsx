import { useState } from 'react'
import Sidebar from './components/Sidebar'
import LogViewer from './components/LogViewer'

function App(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  return (
    <div className="app-container">
      <Sidebar onFileSelect={setSelectedFile} selectedFile={selectedFile} />
      <LogViewer filePath={selectedFile} />
    </div>
  )
}

export default App
