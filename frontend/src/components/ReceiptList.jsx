import { useState, useEffect, useCallback } from 'react'

const KATEGORIEN = ['Baumaterial', 'Lebensmittel', 'Sonstiges']

export default function ReceiptList({ onNewReceipt, onEditReceipt }) {
  const [belege, setBelege] = useState([])
  const [projekte, setProjekte] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  const [filters, setFilters] = useState({
    projekt_id: '', kategorie: '', markt: '', von: '', bis: ''
  })

  const fetchBelege = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const res = await fetch(`/api/receipts?${params}`)
      if (!res.ok) throw new Error('Fehler beim Laden')
      setBelege(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(setProjekte)
      .catch(() => {})
  }, [])

  useEffect(() => { fetchBelege() }, [fetchBelege])

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleDelete(id) {
    if (!window.confirm('Beleg wirklich löschen?')) return
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Löschen fehlgeschlagen')
      fetchBelege()
    } catch (e) {
      setError(e.message)
    }
  }

  function handleExport() {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    window.open(`/api/export/excel?${params}`, '_blank')
  }

  function formatCurrency(val) {
    if (val == null || val === '') return '–'
    return Number(val).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  }

  function formatDate(val) {
    if (!val) return '–'
    try {
      const d = new Date(val)
      return d.toLocaleDateString('de-DE')
    } catch { return val }
  }

  function kategorieBadge(kat) {
    if (kat === 'Baumaterial') return <span className="badge badge-orange">{kat}</span>
    if (kat === 'Lebensmittel') return <span className="badge badge-green">{kat}</span>
    return <span className="badge badge-gray">{kat || 'Sonstiges'}</span>
  }

  const gesamtSumme = belege.reduce((s, b) => s + (b.gesamtsumme || 0), 0)

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span>🔍</span> Filter & Suche
        </div>
        <div className="filter-bar">
          <div className="form-group">
            <label>Projekt</label>
            <select value={filters.projekt_id} onChange={e => setFilters(f => ({ ...f, projekt_id: e.target.value }))}>
              <option value="">Alle Projekte</option>
              {projekte.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Kategorie</label>
            <select value={filters.kategorie} onChange={e => setFilters(f => ({ ...f, kategorie: e.target.value }))}>
              <option value="">Alle</option>
              {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Markt</label>
            <input type="text" placeholder="Markt suchen…" value={filters.markt}
              onChange={e => setFilters(f => ({ ...f, markt: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Von</label>
            <input type="date" value={filters.von}
              onChange={e => setFilters(f => ({ ...f, von: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Bis</label>
            <input type="date" value={filters.bis}
              onChange={e => setFilters(f => ({ ...f, bis: e.target.value }))} />
          </div>
          <div className="filter-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ projekt_id: '', kategorie: '', markt: '', von: '', bis: '' })}>
              ✕ Zurücksetzen
            </button>
            <button className="btn btn-success btn-sm" onClick={handleExport}>
              📊 Excel Export
            </button>
            <button className="btn btn-primary btn-sm" onClick={onNewReceipt}>
              ➕ Neuer Beleg
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">❌ {error}</div>}

      <div className="card">
        <div className="card-title">
          <span>🧾</span> Belege
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 400, color: '#64748b' }}>
            {belege.length} Einträge · Gesamt: <strong>{formatCurrency(gesamtSumme)}</strong>
          </span>
        </div>

        {loading ? (
          <div className="loading-overlay">
            <span className="spinner" style={{ borderColor: 'rgba(30,64,175,.3)', borderTopColor: '#1e40af' }}></span>
            Lade Belege…
          </div>
        ) : belege.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🧾</span>
            <p>Keine Belege gefunden. Erstellen Sie den ersten Beleg!</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Nr.</th>
                  <th>Datum</th>
                  <th>Markt</th>
                  <th>Kategorie</th>
                  <th>Projekt</th>
                  <th>Gesamtsumme</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {belege.map(b => (
                  <>
                    <tr key={b.id}>
                      <td>
                        <button
                          className={`expand-btn${expanded[b.id] ? ' open' : ''}`}
                          onClick={() => toggleExpand(b.id)}
                          title="Positionen anzeigen"
                        >
                          {expanded[b.id] ? '▲' : '▼'}
                        </button>
                      </td>
                      <td><strong>#{b.laufende_nummer}</strong></td>
                      <td>{formatDate(b.datum)}</td>
                      <td>{b.markt || '–'}</td>
                      <td>{kategorieBadge(b.kategorie)}</td>
                      <td>{b.projekt_name ? <span className="badge badge-blue">{b.projekt_name}</span> : '–'}</td>
                      <td><strong>{formatCurrency(b.gesamtsumme)}</strong></td>
                      <td>
                        <div className="actions-cell">
                          {b.bild_pfad && (
                            <a className="btn btn-secondary btn-sm btn-icon" href={`/uploads/${b.bild_pfad}`} target="_blank" rel="noreferrer" title="Bild anzeigen">🖼️</a>
                          )}
                          <button className="btn btn-warning btn-sm" onClick={() => onEditReceipt(b)}>✏️ Bearb.</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                    {expanded[b.id] && (
                      <tr key={`acc-${b.id}`} className="accordion-row">
                        <td colSpan={8}>
                          <div className="accordion-content">
                            <strong>Positionen:</strong>
                            {b.positionen && b.positionen.length > 0 ? (
                              <table style={{ marginTop: '0.5rem' }}>
                                <thead>
                                  <tr>
                                    <th>Beschreibung</th>
                                    <th>Menge</th>
                                    <th>Einzelpreis</th>
                                    <th>Gesamtpreis</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {b.positionen.map(pos => (
                                    <tr key={pos.id}>
                                      <td>{pos.beschreibung}</td>
                                      <td>{pos.menge}</td>
                                      <td>{formatCurrency(pos.einzelpreis)}</td>
                                      <td>{formatCurrency(pos.gesamtpreis)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Keine Positionen erfasst.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
