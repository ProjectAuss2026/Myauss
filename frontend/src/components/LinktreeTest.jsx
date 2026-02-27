import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const ROW = { border: '1px solid #333', borderRadius: 8, padding: 12, marginTop: 10 }
const SECTION = { marginBottom: 32, padding: 16, background: '#1a1a1a', borderRadius: 10 }
const INPUT = { padding: 8, width: '100%', boxSizing: 'border-box' }
const COL = { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }

const authHeaders = { 'Content-Type': 'application/json' }

function LinktreeTest({ onBack }) {
  // ── Shared ───────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)

  // ── Communication Links ──────────────────────────────────────────────────
  const [links, setLinks] = useState([])
  const [newLink, setNewLink] = useState({ platform: '', url: '', imgUrl: '' })
  const [editLinkId, setEditLinkId] = useState(null)
  const [editLinkData, setEditLinkData] = useState({ platform: '', url: '', imgUrl: '', isActive: true })
  const addImgRef = useRef(null)
  const editImgRef = useRef(null)

  // ── Media Config ─────────────────────────────────────────────────────────
  const [mediaConfigs, setMediaConfigs] = useState([])
  const [newMedia, setNewMedia] = useState({ mediaDriveUrl: '' })
  const [editMediaId, setEditMediaId] = useState(null)
  const [editMediaData, setEditMediaData] = useState({ mediaDriveUrl: '' })

  // ── Sponsorship Pages ────────────────────────────────────────────────────
  const [sponsorshipPages, setSponsorshipPages] = useState([])
  const [newPage, setNewPage] = useState({ pageContent: '' })
  const [editPageId, setEditPageId] = useState(null)
  const [editPageData, setEditPageData] = useState({ pageContent: '' })

  // ── Sponsors ─────────────────────────────────────────────────────────────
  const [newSponsor, setNewSponsor] = useState({ name: '', sponsorshipPageId: '', logoUrl: '', websiteUrl: '' })
  const [editSponsorId, setEditSponsorId] = useState(null)
  const [editSponsorData, setEditSponsorData] = useState({ name: '', logoUrl: '', websiteUrl: '', sponsorshipPageId: '' })

  // ── Fetch all ─────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    try {
      const res = await fetch(`${API}/api/config`)
      const data = await res.json()
      setLinks(data.communicationLinks || [])
      setMediaConfigs(data.mediaConfig ? [data.mediaConfig] : [])
      setSponsorshipPages(data.sponsorshipPages || [])
    } catch (e) {
      setStatus('Error fetching data: ' + e.message)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // ── Image upload ──────────────────────────────────────────────────────────
  const uploadImage = async (file, onSuccess) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setStatus(`Upload error: ${data.message}`); return }
      onSuccess(data.imgUrl)
      setStatus(`Image uploaded: ${data.imgUrl}`)
    } catch (e) {
      setStatus('Upload error: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Generic API helpers ───────────────────────────────────────────────────
  const apiPost = async (type, data, onSuccess) => {
    try {
      const res = await fetch(`${API}/api/config`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ type, data }),
      })
      const json = await res.json()
      if (!res.ok) { setStatus(`Error: ${json.message}`); return }
      setStatus(`Created ${type} (id=${json.created.id})`)
      onSuccess()
      fetchAll()
    } catch (e) { setStatus('Error: ' + e.message) }
  }

  const apiPatch = async (type, id, data, onSuccess) => {
    try {
      const res = await fetch(`${API}/api/config`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ type, id, data }),
      })
      const json = await res.json()
      if (!res.ok) { setStatus(`Error: ${json.message}`); return }
      setStatus(`Updated ${type} (id=${id})`)
      onSuccess()
      fetchAll()
    } catch (e) { setStatus('Error: ' + e.message) }
  }

  const apiDelete = async (type, id, label) => {
    try {
      const res = await fetch(`${API}/api/config`, {
        method: 'DELETE', headers: authHeaders,
        body: JSON.stringify({ type, id }),
      })
      const json = await res.json()
      if (!res.ok) { setStatus(`Error: ${json.message}`); return }
      setStatus(`Deleted ${label}`)
      fetchAll()
    } catch (e) { setStatus('Error: ' + e.message) }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 750, margin: '0 auto', padding: 24, fontFamily: 'monospace' }}>
      <button onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
      <h1>Linktree Test Page</h1>

      {status && (
        <div style={{ padding: 10, marginBottom: 16, background: '#2a2a2a', borderRadius: 6, color: '#9cdcfe' }}>
          {status} <button onClick={() => setStatus('')} style={{ marginLeft: 12, fontSize: 11 }}>✕</button>
        </div>
      )}

      {/* ── COMMUNICATION LINKS ─────────────────────────────────────────── */}
      <h2 style={{ borderBottom: '1px solid #444', paddingBottom: 6 }}>Communication Links</h2>

      <div style={SECTION}>
        <strong>Add New Link</strong>
        <div style={COL}>
          <input placeholder="platform (e.g. instagram)" value={newLink.platform}
            onChange={e => setNewLink({ ...newLink, platform: e.target.value })} style={INPUT} />
          <input placeholder="url (e.g. https://instagram.com/...)" value={newLink.url}
            onChange={e => setNewLink({ ...newLink, url: e.target.value })} style={INPUT} />
          <input placeholder="imgUrl (or upload below)" value={newLink.imgUrl}
            onChange={e => setNewLink({ ...newLink, imgUrl: e.target.value })} style={INPUT} />
          <input ref={addImgRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) uploadImage(e.target.files[0], url => setNewLink(l => ({ ...l, imgUrl: url }))) }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => addImgRef.current.click()} disabled={uploading}>
              {uploading ? 'Uploading...' : '📁 Upload Image'}
            </button>
            <button onClick={() => apiPost('communicationLink', newLink, () => setNewLink({ platform: '', url: '', imgUrl: '' }))}>
              + Add Link
            </button>
          </div>
        </div>
      </div>

      <div>
        <strong>Current Links ({links.length})</strong>
        <button onClick={fetchAll} style={{ marginLeft: 12, padding: '4px 10px', fontSize: 12 }}>Refresh</button>
        {links.length === 0 && <p style={{ color: '#888' }}>No links yet.</p>}
        {links.map(link => (
          <div key={link.id} style={ROW}>
            {editLinkId === link.id ? (
              <div style={COL}>
                <input value={editLinkData.platform} placeholder="platform" style={INPUT}
                  onChange={e => setEditLinkData({ ...editLinkData, platform: e.target.value })} />
                <input value={editLinkData.url} placeholder="url" style={INPUT}
                  onChange={e => setEditLinkData({ ...editLinkData, url: e.target.value })} />
                <input value={editLinkData.imgUrl} placeholder="imgUrl" style={INPUT}
                  onChange={e => setEditLinkData({ ...editLinkData, imgUrl: e.target.value })} />
                <input ref={editImgRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) uploadImage(e.target.files[0], url => setEditLinkData(d => ({ ...d, imgUrl: url }))) }} />
                <label style={{ fontSize: 13 }}>
                  <input type="checkbox" checked={editLinkData.isActive}
                    onChange={e => setEditLinkData({ ...editLinkData, isActive: e.target.checked })} />{' '}isActive
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => editImgRef.current.click()} disabled={uploading}>📁 Upload Image</button>
                  <button onClick={() => apiPatch('communicationLink', editLinkId, editLinkData, () => setEditLinkId(null))}>Save</button>
                  <button onClick={() => setEditLinkId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div><strong>id:</strong> {link.id} &nbsp; <strong>platform:</strong> {link.platform}</div>
                <div style={{ fontSize: 12, color: '#aaa', wordBreak: 'break-all' }}>
                  <strong>url:</strong>{' '}
                  <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: '#569cd6' }}>{link.url}</a>
                </div>
                {link.imgUrl && (
                  <img src={link.imgUrl} alt={link.platform}
                    style={{ maxWidth: 100, maxHeight: 100, borderRadius: 6, border: '1px solid #444', marginTop: 6 }} />
                )}
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, wordBreak: 'break-all' }}>
                  <strong>imgUrl:</strong> {link.imgUrl}
                </div>
                <div style={{ fontSize: 12, color: link.isActive ? '#4ec9b0' : '#f48771' }}>isActive: {String(link.isActive)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setEditLinkId(link.id); setEditLinkData({ platform: link.platform, url: link.url, imgUrl: link.imgUrl, isActive: link.isActive }) }}>Edit</button>
                  <button onClick={() => apiDelete('communicationLink', link.id, link.platform)} style={{ color: '#f48771' }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── MEDIA CONFIG ───────────────────────────────────────────────────── */}
      <h2 style={{ borderBottom: '1px solid #444', paddingBottom: 6, marginTop: 40 }}>Media Config</h2>

      <div style={SECTION}>
        <strong>Add Media Config</strong>
        <div style={COL}>
          <input placeholder="mediaDriveUrl (e.g. https://drive.google.com/...)" value={newMedia.mediaDriveUrl}
            onChange={e => setNewMedia({ mediaDriveUrl: e.target.value })} style={INPUT} />
          <button style={{ alignSelf: 'flex-start' }}
            onClick={() => apiPost('mediaConfig', newMedia, () => setNewMedia({ mediaDriveUrl: '' }))}>
            + Add Media Config
          </button>
        </div>
      </div>

      <div>
        <strong>Current Media Configs ({mediaConfigs.length})</strong>
        <button onClick={fetchAll} style={{ marginLeft: 12, padding: '4px 10px', fontSize: 12 }}>Refresh</button>
        {mediaConfigs.length === 0 && <p style={{ color: '#888' }}>No media config yet.</p>}
        {mediaConfigs.map(m => (
          <div key={m.id} style={ROW}>
            {editMediaId === m.id ? (
              <div style={COL}>
                <input value={editMediaData.mediaDriveUrl} placeholder="mediaDriveUrl" style={INPUT}
                  onChange={e => setEditMediaData({ mediaDriveUrl: e.target.value })} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => apiPatch('mediaConfig', editMediaId, editMediaData, () => setEditMediaId(null))}>Save</button>
                  <button onClick={() => setEditMediaId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div><strong>id:</strong> {m.id}</div>
                <div style={{ fontSize: 12, color: '#aaa', wordBreak: 'break-all' }}>
                  <strong>mediaDriveUrl:</strong>{' '}
                  <a href={m.mediaDriveUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#569cd6' }}>{m.mediaDriveUrl}</a>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setEditMediaId(m.id); setEditMediaData({ mediaDriveUrl: m.mediaDriveUrl }) }}>Edit</button>
                  <button onClick={() => apiDelete('mediaConfig', m.id, `mediaConfig id=${m.id}`)} style={{ color: '#f48771' }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── SPONSORSHIP PAGES & SPONSORS ───────────────────────────────────── */}
      <h2 style={{ borderBottom: '1px solid #444', paddingBottom: 6, marginTop: 40 }}>Sponsorship Pages &amp; Sponsors</h2>

      <div style={SECTION}>
        <strong>Add Sponsorship Page</strong>
        <div style={COL}>
          <textarea placeholder="pageContent (describe the sponsorship page...)" value={newPage.pageContent}
            onChange={e => setNewPage({ pageContent: e.target.value })}
            style={{ ...INPUT, minHeight: 80, resize: 'vertical' }} />
          <button style={{ alignSelf: 'flex-start' }}
            onClick={() => apiPost('sponsorshipPage', newPage, () => setNewPage({ pageContent: '' }))}>
            + Add Sponsorship Page
          </button>
        </div>
      </div>

      <div>
        <strong>Sponsorship Pages ({sponsorshipPages.length})</strong>
        <button onClick={fetchAll} style={{ marginLeft: 12, padding: '4px 10px', fontSize: 12 }}>Refresh</button>
        {sponsorshipPages.length === 0 && <p style={{ color: '#888' }}>No sponsorship pages yet.</p>}
        {sponsorshipPages.map(page => (
          <div key={page.id} style={{ ...ROW, background: '#1c1c1c' }}>
            {editPageId === page.id ? (
              <div style={COL}>
                <textarea value={editPageData.pageContent} placeholder="pageContent"
                  onChange={e => setEditPageData({ pageContent: e.target.value })}
                  style={{ ...INPUT, minHeight: 80, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => apiPatch('sponsorshipPage', editPageId, editPageData, () => setEditPageId(null))}>Save</button>
                  <button onClick={() => setEditPageId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div><strong>id:</strong> {page.id}</div>
                <div style={{ fontSize: 12, color: '#aaa', whiteSpace: 'pre-wrap', marginTop: 4 }}>
                  <strong>pageContent:</strong> {page.pageContent}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setEditPageId(page.id); setEditPageData({ pageContent: page.pageContent }) }}>Edit Page</button>
                  <button onClick={() => apiDelete('sponsorshipPage', page.id, `sponsorshipPage id=${page.id}`)} style={{ color: '#f48771' }}>Delete Page</button>
                </div>
              </div>
            )}

            {/* Sponsors nested under their page */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #333' }}>
              <strong style={{ fontSize: 13 }}>Sponsors ({(page.sponsors || []).length})</strong>

              <div style={{ ...COL, padding: 10, background: '#111', borderRadius: 6 }}>
                <small style={{ color: '#888' }}>Add sponsor to Page id={page.id}</small>
                <input placeholder="name (required)" style={INPUT}
                  value={newSponsor.sponsorshipPageId === String(page.id) ? newSponsor.name : ''}
                  onChange={e => setNewSponsor({ ...newSponsor, name: e.target.value, sponsorshipPageId: String(page.id) })} />
                <input placeholder="logoUrl (optional)" style={INPUT}
                  value={newSponsor.sponsorshipPageId === String(page.id) ? newSponsor.logoUrl : ''}
                  onChange={e => setNewSponsor({ ...newSponsor, logoUrl: e.target.value, sponsorshipPageId: String(page.id) })} />
                <input placeholder="websiteUrl (optional)" style={INPUT}
                  value={newSponsor.sponsorshipPageId === String(page.id) ? newSponsor.websiteUrl : ''}
                  onChange={e => setNewSponsor({ ...newSponsor, websiteUrl: e.target.value, sponsorshipPageId: String(page.id) })} />
                <button style={{ alignSelf: 'flex-start' }} onClick={() => {
                  const d = { name: newSponsor.name, sponsorshipPageId: Number(page.id) }
                  if (newSponsor.logoUrl) d.logoUrl = newSponsor.logoUrl
                  if (newSponsor.websiteUrl) d.websiteUrl = newSponsor.websiteUrl
                  apiPost('sponsor', d, () => setNewSponsor({ name: '', sponsorshipPageId: '', logoUrl: '', websiteUrl: '' }))
                }}>+ Add Sponsor</button>
              </div>

              {(page.sponsors || []).map(s => (
                <div key={s.id} style={{ ...ROW, marginLeft: 12, background: '#161616' }}>
                  {editSponsorId === s.id ? (
                    <div style={COL}>
                      <input value={editSponsorData.name} placeholder="name" style={INPUT}
                        onChange={e => setEditSponsorData({ ...editSponsorData, name: e.target.value })} />
                      <input value={editSponsorData.logoUrl} placeholder="logoUrl" style={INPUT}
                        onChange={e => setEditSponsorData({ ...editSponsorData, logoUrl: e.target.value })} />
                      <input value={editSponsorData.websiteUrl} placeholder="websiteUrl" style={INPUT}
                        onChange={e => setEditSponsorData({ ...editSponsorData, websiteUrl: e.target.value })} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => apiPatch('sponsor', editSponsorId, editSponsorData, () => setEditSponsorId(null))}>Save</button>
                        <button onClick={() => setEditSponsorId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div><strong>id:</strong> {s.id} &nbsp; <strong>name:</strong> {s.name}</div>
                      {s.websiteUrl && (
                        <div style={{ fontSize: 12, color: '#aaa' }}>
                          <strong>website:</strong>{' '}
                          <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#569cd6' }}>{s.websiteUrl}</a>
                        </div>
                      )}
                      {s.logoUrl && (
                        <img src={s.logoUrl} alt={s.name}
                          style={{ maxWidth: 80, maxHeight: 60, borderRadius: 4, border: '1px solid #444', marginTop: 4 }} />
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => {
                          setEditSponsorId(s.id)
                          setEditSponsorData({ name: s.name, logoUrl: s.logoUrl || '', websiteUrl: s.websiteUrl || '', sponsorshipPageId: s.sponsorshipPageId })
                        }}>Edit</button>
                        <button onClick={() => apiDelete('sponsor', s.id, s.name)} style={{ color: '#f48771' }}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LinktreeTest
