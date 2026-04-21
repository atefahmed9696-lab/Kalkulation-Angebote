import { useState, useEffect, useRef } from 'react'

const KATEGORIEN = ['Baumaterial', 'Lebensmittel', 'Sonstiges']

// Only allow blob: URLs (from createObjectURL) and relative /uploads/ paths
function safeSrc(url) {
  if (!url) return null
  if (url.startsWith('blob:')) return url
  if (url.startsWith('/uploads/')) return url
  return null
}

const emptyForm = {
  datum: '', markt: '', kategorie: 'Sonstiges',
  gesamtsumme: '', projekt_id: '', bild_pfad: '', positionen: []
}

const emptyPosition = { beschreibung: '', menge: 1, einzelpreis: '', gesamtpreis: '' }

export default function ReceiptForm({ receipt, onSaved, onCancel }) {
  const [step, setStep] = useState(receipt ? 2 : 1)
  const [form, setForm] = useState(receipt ? {
    datum: receipt.datum || '',
    markt: receipt.markt || '',
    kategorie: receipt.kategorie || 'Sonstiges',
    gesamtsumme: receipt.gesamtsumme ?? '',
    projekt_id: receipt.projekt_id ?? '',
    bild_pfad: receipt.bild_pfad || '',
    positionen: receipt.positionen ? receipt.positionen.map(p => ({
      beschreibung: p.beschreibung || '',
      menge: p.menge ?? 1,
      einzelpreis: p.einzelpreis ?? '',
      gesamtpreis: p.gesamtpreis ?? ''
    })) : []
  } : { ...emptyForm, positionen: [] })

  const [projekte, setProjekte] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(
    receipt?.bild_pfad ? `/uploads/${encodeURIComponent(receipt.bild_pfad)}` : null
  )
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const fileInputRef = useRef()

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => setProjekte(data.filter(p => !p.archiviert)))
      .catch(() => {})
  }, [])

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
  }

  async function handleScan() {
    if (!imageFile) { setError('Bitte zuerst ein Bild auswählen.'); return }
    setScanning(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('image', imageFile)
      const res = await fetch('/api/receipts/scan', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan fehlgeschlagen')
      setForm(f => ({
        ...f,
        datum: data.datum || f.datum,
        markt: data.markt || f.markt,
        kategorie: data.kategorie || f.kategorie,
        gesamtsumme: data.gesamtsumme != null ? data.gesamtsumme : f.gesamtsumme,
        bild_pfad: data.bild_pfad || f.bild_pfad,
        positionen: data.positionen && data.positionen.length > 0
          ? data.positionen.map(p => ({
              beschreibung: p.beschreibung || '',
              menge: p.menge ?? 1,
              einzelpreis: p.einzelpreis ?? '',
              gesamtpreis: p.gesamtpreis ?? ''
            }))
          : f.positionen
      }))
      setStep(2)
    } catch (e) {
      setError(e.message)
    } finally {
      setScanning(false)
    }
  }

  function updateField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addPosition() {
    setForm(f => ({ ...f, positionen: [...f.positionen, { ...emptyPosition }] }))
  }

  function removePosition(idx) {
    setForm(f => ({ ...f, positionen: f.positionen.filter((_, i) => i !== idx) }))
  }

  function updatePosition(idx, field, value) {
    setForm(f => {
      const pos = f.positionen.map((p, i) => {
        if (i !== idx) return p
        const updated = { ...p, [field]: value }
        // auto-calculate gesamtpreis
        if (field === 'menge' || field === 'einzelpreis') {
          const m = field === 'menge' ? parseFloat(value) : parseFloat(updated.menge)
          const ep = field === 'einzelpreis' ? parseFloat(value) : parseFloat(updated.einzelpreis)
          if (!isNaN(m) && !isNaN(ep)) {
            updated.gesamtpreis = (m * ep).toFixed(2)
          }
        }
        return updated
      })
      return { ...f, positionen: pos }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        datum: form.datum || null,
        markt: form.markt || null,
        kategorie: form.kategorie || null,
        gesamtsumme: form.gesamtsumme !== '' ? parseFloat(form.gesamtsumme) : null,
        projekt_id: form.projekt_id || null,
        bild_pfad: form.bild_pfad || null,
        positionen: form.positionen.map(p => ({
          beschreibung: p.beschreibung,
          menge: p.menge !== '' ? parseFloat(p.menge) : null,
          einzelpreis: p.einzelpreis !== '' ? parseFloat(p.einzelpreis) : null,
          gesamtpreis: p.gesamtpreis !== '' ? parseFloat(p.gesamtpreis) : null
        }))
      }
      const url = receipt ? `/api/receipts/${receipt.id}` : '/api/receipts'
      const method = receipt ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen')
      setSuccess(receipt ? 'Beleg aktualisiert!' : 'Beleg gespeichert!')
      setTimeout(() => onSaved(data), 800)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        {receipt ? '✏️ Beleg bearbeiten' : '➕ Neuer Beleg'}
      </div>

      {error && <div className="alert alert-error">❌ {error}</div>}
      {success && <div className="alert alert-success">✅ {success}</div>}

      {/* Step 1: Image upload & scan */}
      {step === 1 && (
        <div>
          <div className="scan-area" onClick={() => fileInputRef.current?.click()}>
            <div style={{ fontSize: '2.5rem' }}>📸</div>
            <p>Bild hier ablegen oder klicken zum Auswählen</p>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>JPG, PNG, WEBP · max. 20 MB</p>
            {imagePreview && (
              <img src={safeSrc(imagePreview)} alt="Vorschau" className="scan-preview" />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*;capture=camera"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleScan}
              disabled={!imageFile || scanning}
            >
              {scanning
                ? <><span className="spinner"></span> Scanne…</>
                : '🔍 Scannen & Auswerten'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(2)}
            >
              ✏️ Manuell eingeben
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
          </div>

          {scanning && (
            <div className="loading-overlay" style={{ marginTop: '1rem' }}>
              <span className="spinner" style={{ borderColor: 'rgba(30,64,175,.3)', borderTopColor: '#1e40af' }}></span>
              OCR läuft… Das kann einige Sekunden dauern.
            </div>
          )}
        </div>
      )}

      {/* Step 2: Form */}
      {step === 2 && (
        <form onSubmit={handleSubmit}>
          {!receipt && (
            <div style={{ marginBottom: '1rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>
                ← Zurück zum Scan
              </button>
            </div>
          )}

          {imagePreview && (
            <div style={{ marginBottom: '1rem' }}>
              <img src={safeSrc(imagePreview)} alt="Beleg" className="scan-preview" style={{ maxWidth: '200px' }} />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Datum</label>
              <input type="date" value={form.datum}
                onChange={e => updateField('datum', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Markt / Lieferant</label>
              <input type="text" placeholder="z. B. OBI, Bauhaus, Lidl…"
                value={form.markt} onChange={e => updateField('markt', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Kategorie</label>
              <select value={form.kategorie} onChange={e => updateField('kategorie', e.target.value)}>
                {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Projekt</label>
              <select value={form.projekt_id} onChange={e => updateField('projekt_id', e.target.value)}>
                <option value="">Kein Projekt</option>
                {projekte.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Gesamtsumme (€)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00"
                value={form.gesamtsumme} onChange={e => updateField('gesamtsumme', e.target.value)} />
            </div>
          </div>

          {/* Positionen */}
          <div className="positionen-section">
            <h3>📦 Positionen</h3>
            {form.positionen.map((pos, idx) => (
              <div className="pos-row" key={idx}>
                <input
                  className="pos-desc"
                  type="text"
                  placeholder="Beschreibung"
                  value={pos.beschreibung}
                  onChange={e => updatePosition(idx, 'beschreibung', e.target.value)}
                />
                <input
                  className="pos-qty"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Menge"
                  value={pos.menge}
                  onChange={e => updatePosition(idx, 'menge', e.target.value)}
                />
                <input
                  className="pos-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Einzelpreis"
                  value={pos.einzelpreis}
                  onChange={e => updatePosition(idx, 'einzelpreis', e.target.value)}
                />
                <input
                  className="pos-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Gesamtpreis"
                  value={pos.gesamtpreis}
                  onChange={e => updatePosition(idx, 'gesamtpreis', e.target.value)}
                />
                <button type="button" className="btn btn-danger btn-sm btn-icon"
                  onClick={() => removePosition(idx)}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}
              onClick={addPosition}>
              ＋ Position hinzufügen
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner"></span> Speichern…</> : '💾 Speichern'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
