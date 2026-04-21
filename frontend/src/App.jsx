import { useState } from 'react'
import ReceiptList from './components/ReceiptList.jsx'
import ReceiptForm from './components/ReceiptForm.jsx'
import ProjectManager from './components/ProjectManager.jsx'

export default function App() {
  const [activeTab, setActiveTab] = useState('belege')
  const [editingReceipt, setEditingReceipt] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleReceiptSaved() {
    setActiveTab('belege')
    setEditingReceipt(null)
    setRefreshKey(k => k + 1)
  }

  function handleEditReceipt(receipt) {
    setEditingReceipt(receipt)
    setActiveTab('neuer-beleg')
  }

  function handleNewReceipt() {
    setEditingReceipt(null)
    setActiveTab('neuer-beleg')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <span className="header-logo">🧾</span>
          <h1>Beleg-Scanner</h1>
        </div>
      </header>

      <nav className="tab-bar">
        <button
          className={`tab-btn${activeTab === 'belege' ? ' active' : ''}`}
          onClick={() => { setActiveTab('belege'); setEditingReceipt(null); }}
        >
          📋 Belege
        </button>
        <button
          className={`tab-btn${activeTab === 'neuer-beleg' ? ' active' : ''}`}
          onClick={handleNewReceipt}
        >
          ➕ Neuer Beleg
        </button>
        <button
          className={`tab-btn${activeTab === 'projekte' ? ' active' : ''}`}
          onClick={() => setActiveTab('projekte')}
        >
          📁 Projekte
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'belege' && (
          <ReceiptList
            key={refreshKey}
            onNewReceipt={handleNewReceipt}
            onEditReceipt={handleEditReceipt}
          />
        )}
        {activeTab === 'neuer-beleg' && (
          <ReceiptForm
            receipt={editingReceipt}
            onSaved={handleReceiptSaved}
            onCancel={() => { setActiveTab('belege'); setEditingReceipt(null); }}
          />
        )}
        {activeTab === 'projekte' && (
          <ProjectManager />
        )}
      </main>
    </div>
  )
}
