import { useState, useEffect } from 'react'

const emptyForm = { name: '', beschreibung: '' }

export default function ProjectManager() {
  const [projekte, setProjekte] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  async function fetchProjekte() {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Laden fehlgeschlagen')
      setProjekte(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjekte() }, [])

  function openNew() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
    setError(null)
  }

  function openEdit(p) {
    setForm({ name: p.name, beschreibung: p.beschreibung || '' })
    setEditingId(p.id)
    setShowForm(true)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name ist erforderlich'); return }
    setSaving(true)
    setError(null)
    try {
      const url = editingId ? `/api/projects/${editingId}` : '/api/projects'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, beschreibung: form.beschreibung })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fehler')
      setSuccess(editingId ? 'Projekt aktualisiert!' : 'Projekt erstellt!')
      setShowForm(false)
      setEditingId(null)
      fetchProjekte()
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(p) {
    try {
      const res = await fetch(`/api/projects/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiviert: p.archiviert ? 0 : 1 })
      })
      if (!res.ok) throw new Error('Fehler')
      fetchProjekte()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Projekt wirklich löschen? Zugeordnete Belege bleiben erhalten.')) return
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Löschen fehlgeschlagen')
      fetchProjekte()
    } catch (e) {
      setError(e.message)
    }
  }

  function formatCurrency(val) {
    if (val == null || val === 0) return '0,00 €'
    return Number(val).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  }

  const active = projekte.filter(p => !p.archiviert)
  const archived = projekte.filter(p => p.archiviert)

  return (
    <div>
      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span>📁 Projekte</span>
          <button className="btn btn-primary btn-sm" onClick={openNew}>➕ Neues Projekt</button>
        </div>

        {error && <div className="alert alert-error">❌ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div className="card-title" style={{ marginBottom: '0.75rem' }}>
              {editingId ? '✏️ Projekt bearbeiten' : '➕ Neues Projekt'}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Projektname *</label>
                <input type="text" placeholder="z. B. Badezimmer Umbau"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Beschreibung</label>
                <input type="text" placeholder="Optionale Beschreibung"
                  value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <><span className="spinner"></span> …</> : '💾 Speichern'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => { setShowForm(false); setEditingId(null); setError(null); }}>
                Abbrechen
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="loading-overlay">
            <span className="spinner" style={{ borderColor: 'rgba(30,64,175,.3)', borderTopColor: '#1e40af' }}></span>
            Lade Projekte…
          </div>
        ) : (
          <>
            {active.length === 0 && archived.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📁</span>
                <p>Noch keine Projekte vorhanden.</p>
              </div>
            ) : (
              <>
                {active.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                      Aktive Projekte ({active.length})
                    </h3>
                    <div className="project-grid">
                      {active.map(p => (
                        <ProjectCard key={p.id} project={p}
                          onEdit={openEdit} onArchive={handleArchive} onDelete={handleDelete}
                          formatCurrency={formatCurrency} />
                      ))}
                    </div>
                  </>
                )}

                {archived.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.5rem 0 0.75rem' }}>
                      Archiviert ({archived.length})
                    </h3>
                    <div className="project-grid">
                      {archived.map(p => (
                        <ProjectCard key={p.id} project={p}
                          onEdit={openEdit} onArchive={handleArchive} onDelete={handleDelete}
                          formatCurrency={formatCurrency} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project: p, onEdit, onArchive, onDelete, formatCurrency }) {
  return (
    <div className={`project-card${p.archiviert ? ' archived' : ''}`}>
      <div className="project-card-header">
        <div className="project-name">{p.name}</div>
        {p.archiviert ? (
          <span className="badge badge-gray">Archiviert</span>
        ) : (
          <span className="badge badge-blue">Aktiv</span>
        )}
      </div>
      {p.beschreibung && <div className="project-desc">{p.beschreibung}</div>}
      <div className="project-total">{formatCurrency(p.gesamtsumme_total)}</div>
      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>Gesamtausgaben</div>
      <div className="project-actions">
        <button className="btn btn-warning btn-sm" onClick={() => onEdit(p)}>✏️ Bearbeiten</button>
        <button className="btn btn-secondary btn-sm" onClick={() => onArchive(p)}>
          {p.archiviert ? '📤 Aktivieren' : '📦 Archivieren'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(p.id)}>🗑️</button>
      </div>
    </div>
  )
}
