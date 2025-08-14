import React, { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts'

const COLORS = { P0:'#F64C38', P1:'#2C8EFF', P2:'#FFA726' }
const priorityLabel = p => ({P0:'Bloccante (MVP)', P1:'Importante', P2:'Post-MVP'})[p] || p
const euro = n => new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(n)

// ⚠️ Imposta in Vercel → Project Settings → Environment Variables
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'change-me-now'

function useQuery() {
  const [q, setQ] = useState(new URLSearchParams(window.location.search))
  useEffect(() => {
    const onPop = () => setQ(new URLSearchParams(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return q
}

// --- Draft encoding/decoding in URL hash ---
function encodeDraft(obj) {
  // Compact: no spaces to keep URL shorter
  const json = JSON.stringify(obj)
  return btoa(unescape(encodeURIComponent(json)))
}
function decodeDraft(str) {
  try {
    const json = decodeURIComponent(escape(atob(str)))
    return JSON.parse(json)
  } catch (e) {
    console.warn('Invalid draft hash', e)
    return null
  }
}
function getDraftFromHash() {
  const h = window.location.hash || ''
  const m = h.match(/#draft=([^&]+)/)
  if (!m) return null
  return decodeDraft(m[1])
}

async function loadPublishedDataset() {
  const res = await fetch('/data.json', { cache: 'no-store' })
  const js = await res.json()
  return js.items ?? []
}

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
function csvDownload(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')
  downloadFile(filename, csv)
}

export default function App() {
  const params = useQuery()
  const initialView = params.get('view') === 'admin' ? 'admin' : 'client'
  const [view, setView] = useState(initialView)
  const [previewingClient, setPreviewingClient] = useState(false) // anteprima cliente con dati correnti
  const [authed, setAuthed] = useState(false)
  const [rate, setRate] = useState(Number(params.get('rate') || 45))
  const [bufferPct, setBufferPct] = useState(Number(params.get('buffer') || 20))
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('ALL')

  // Caricamento iniziale: se c'è un draft nell'hash lo usiamo, altrimenti dati pubblicati
  useEffect(() => {
    const draft = getDraftFromHash()
    if (draft && Array.isArray(draft.items)) {
      setItems(draft.items)
      setLoading(false)
      return
    }
    loadPublishedDataset().then(setItems).finally(()=>setLoading(false))
  }, [])

  // Se entri in admin, prova a caricare una bozza locale
  useEffect(() => {
    if (view !== 'admin') return
    const saved = localStorage.getItem('sendura_admin_overrides')
    if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length) setItems(parsed) } catch {} }
  }, [view])

  const data = useMemo(() => items.map(r => ({...r, total: r.fe + r.be + r.intg + r.qa})), [items])

  const filtered = useMemo(() =>
    data.filter(d =>
      (selectedPriority === 'ALL' || d.priority === selectedPriority) &&
      (search.trim() === '' || (d.name + ' ' + d.id + ' ' + d.desc).toLowerCase().includes(search.toLowerCase()))
    ), [data, selectedPriority, search])

  const totals = useMemo(() => {
    const byP = { P0:0, P1:0, P2:0 }
    data.forEach(d => { byP[d.priority] += d.total })
    const grand = Object.values(byP).reduce((a,b)=>a+b,0)
    return { byP, grand, withBuffer: Math.round(grand * (1 + (bufferPct/100))) }
  }, [data, bufferPct])

  const costTot = totals.grand * rate
  const costTotBuf = Math.round(totals.withBuffer * rate)

  function handleAdminLogin() {
    const val = prompt('Inserisci passcode admin')
    if (!val) return
    if (val === ADMIN_KEY) { setAuthed(true); alert('Accesso admin OK') } else { alert('Passcode errato') }
  }
  function copyClientLinkPublished() {
    // Link cliente che usa i dati pubblicati (public/data.json)
    const url = new URL(window.location.href)
    url.searchParams.set('view','client')
    url.searchParams.set('rate', String(rate))
    url.searchParams.set('buffer', String(bufferPct))
    url.hash = ''
    navigator.clipboard.writeText(url.toString())
    alert('Link cliente (dati pubblicati) copiato negli appunti')
  }
  function copyClientLinkDraft() {
    // Link cliente che incorpora la bozza nell'URL (#draft=...)
    const url = new URL(window.location.href)
    url.searchParams.set('view','client')
    url.searchParams.set('rate', String(rate))
    url.searchParams.set('buffer', String(bufferPct))
    url.hash = 'draft=' + encodeDraft({ items })
    navigator.clipboard.writeText(url.toString())
    alert('Link cliente (bozza) copiato negli appunti')
  }
  function previewClientNow() {
    setPreviewingClient(true)
    setView('client')
    alert('Anteprima cliente attiva: stai vedendo le modifiche senza pubblicarle.')
  }
  function exitPreview() {
    setPreviewingClient(false)
    setView('admin')
  }

  function downloadHoursCSV() {
    const rows = [["ID","Interfaccia","Priorità","FE","BE","INTG","QA","Totale (h)"]]
    data.forEach(d => rows.push([d.id, d.name, d.priority, d.fe, d.be, d.intg, d.qa, d.total]))
    rows.push([]); rows.push(["P0", totals.byP.P0]); rows.push(["P1", totals.byP.P1]); rows.push(["P2", totals.byP.P2])
    rows.push(["Totale", totals.grand]); rows.push([`Totale + buffer ${bufferPct}%`, totals.withBuffer])
    csvDownload('sendura_ore.csv', rows)
  }
  function downloadPricingCSV() {
    const rows = [["ID","Interfaccia","Priorità","Ore","Tariffa €/h","Totale €","Totale+buffer €"]]
    data.forEach(d => rows.push([d.id, d.name, d.priority, d.total, rate, Math.round(d.total*rate), Math.round(d.total*rate*(1+bufferPct/100))]))
    rows.push([]); rows.push(["— Riepilogo —", "", "", totals.grand, rate, Math.round(costTot), Math.round(costTotBuf)])
    csvDownload('sendura_economica.csv', rows)
  }
  function setItemValue(idx, field, val) {
    const v = Number(val||0)
    setItems(prev => prev.map((it,i) => i===idx ? {...it, [field]: v} : it))
  }
  function saveOverridesLocal() {
    localStorage.setItem('sendura_admin_overrides', JSON.stringify(items))
    alert('Bozza salvata (solo su questo dispositivo). Per condividerla: "Copia link cliente (bozza)". Per pubblicarla: scarica data.json e aggiorna su GitHub.')
  }
  function resetToPublished() {
    localStorage.removeItem('sendura_admin_overrides')
    loadPublishedDataset().then(setItems)
    alert('Ripristinato ai dati pubblicati (data.json)')
  }
  function downloadDataJson() { downloadFile('data.json', JSON.stringify({items}, null, 2)) }

  if (loading) return <div style={{padding:20}}>Caricamento…</div>

  return (
    <div className="container">
      <div className="header">
        <div className="title">
          <div style={{height:36,width:36,borderRadius:10,background:'#002F6C',color:'#fff',display:'grid',placeItems:'center',fontWeight:700}}>S</div>
          <div>
            <div style={{fontSize:22,fontWeight:600}}>SENDURA — Stime & Prospetto Interfacce</div>
            <div className="muted">{new Date().toLocaleDateString('it-IT')} • {view==='admin'?'Vista Admin':'Vista Cliente'} {previewingClient && '(Anteprima)'}</div>
          </div>
          <span className="badge" style={{background: view==='admin' ? '#1f2937' : '#059669'}}>{view==='admin'?'Admin':'Cliente'}</span>
        </div>
        <div className="controls no-print">
          {view==='admin' ? (
            <>
              {!authed && <button className="btn" onClick={handleAdminLogin}>Login admin</button>}
              {authed && <button className="btn" onClick={()=>{setAuthed(false)}}>Esci admin</button>}
              {!previewingClient && <button className="btn" onClick={previewClientNow}>Anteprima cliente (applica modifiche)</button>}
              {previewingClient && <button className="btn" onClick={exitPreview}>Esci anteprima</button>}
              <button className="btn" onClick={copyClientLinkPublished}>Copia link cliente (pubblicato)</button>
              <button className="btn" onClick={copyClientLinkDraft}>Copia link cliente (bozza)</button>
              <button className="btn" onClick={()=>window.print()}>Stampa / PDF</button>
              <button className="btn" onClick={downloadHoursCSV}>Ore (CSV)</button>
              {authed && <button className="btn primary" onClick={downloadPricingCSV}>Economica (CSV)</button>}
            </>
          ) : (
            <>
              <button className="btn" onClick={()=>window.print()}>Stampa / PDF</button>
              <button className="btn" onClick={downloadHoursCSV}>Ore (CSV)</button>
            </>
          )}
        </div>
      </div>

      <div className="linkbar no-print">
        <a className="anchor" href="#panoramica">Panoramica</a>
        <a className="anchor" href="#dettaglio">Dettaglio</a>
        <a className="anchor" href="#economica">Economica</a>
        {view==='admin' && <a className="anchor" href="#admin">Modifica (Admin)</a>}
      </div>

      {/* Filtri + Economica */}
      <div className="row row-2" style={{marginTop:12}}>
        <div className="card">
          <h3>Filtri</h3>
          <div className="content">
            <div className="controls" style={{gap:12}}>
              <select className="select" value={selectedPriority} onChange={e=>setSelectedPriority(e.target.value)}>
                <option value="ALL">Tutte le priorità</option>
                <option value="P0">P0 • Bloccante (MVP)</option>
                <option value="P1">P1 • Importante</option>
                <option value="P2">P2 • Post-MVP</option>
              </select>
              <input className="input" placeholder="Cerca ID, interfaccia, descrizione…" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Economica — Tariffa oraria</h3>
          <div className="content grid" style={{gridTemplateColumns:'repeat(5, minmax(0,1fr))', alignItems:'end'}}>
            {view==='admin' ? (
              <>
                <div style={{gridColumn:'span 2'}}>
                  <div className="muted">Tariffa</div>
                  <select className="select" value={String(rate)} onChange={e=>setRate(Number(e.target.value))}>
                    <option value="35">35 €/h</option>
                    <option value="45">45 €/h</option>
                    <option value="60">60 €/h</option>
                  </select>
                </div>
                <div>
                  <div className="muted">Custom €/h</div>
                  <input className="input" inputMode="numeric" placeholder="es. 50" onChange={e=>setRate(Number(e.target.value||0))}/>
                </div>
                <div>
                  <div className="muted">Buffer %</div>
                  <input className="input" inputMode="numeric" value={bufferPct} onChange={e=>setBufferPct(Math.max(0, Number(e.target.value||0)))} />
                </div>
              </>
            ) : (
              <>
                <div style={{gridColumn:'span 3'}}>
                  <div className="muted">Tariffa concordata</div>
                  <div style={{fontSize:18,fontWeight:600}}>{rate} €/h</div>
                </div>
                <div>
                  <div className="muted">Buffer</div>
                  <div style={{fontSize:18,fontWeight:600}}>{bufferPct}%</div>
                </div>
                <div className="muted" style={{display:'flex',alignItems:'center'}}>Parametri preimpostati</div>
              </>
            )}
            <div className="muted" style={{gridColumn:'span 1'}}>
              <div>Tot. ore: <b>{totals.grand}</b></div>
              <div>Tot. costo: <b>{euro(costTot)}</b></div>
              <div>+ buffer {bufferPct}%: <b>{euro(costTotBuf)}</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="row row-4" style={{marginTop:12}}>
        <div className="kpi"><div className="label">Ore P0</div><div className="value">{totals.byP.P0}h</div></div>
        <div className="kpi"><div className="label">Ore P1</div><div className="value">{totals.byP.P1}h</div></div>
        <div className="kpi"><div className="label">Ore P2</div><div className="value">{totals.byP.P2}h</div></div>
        <div className="kpi"><div className="label">Totale ore</div><div className="value">{totals.grand}h</div></div>
      </div>

      {/* Panoramica grafici */}
      <div id="panoramica" className="row row-2" style={{marginTop:12}}>
        <div className="card" style={{height:380}}>
          <h3>Ripartizione ore per priorità</h3>
          <div className="content" style={{height:300}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[
                  { name: 'P0', value: totals.byP.P0, fill: COLORS.P0 },
                  { name: 'P1', value: totals.byP.P1, fill: COLORS.P1 },
                  { name: 'P2', value: totals.byP.P2, fill: COLORS.P2 }
                ]} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  <Cell fill={COLORS.P0} /><Cell fill={COLORS.P1} /><Cell fill={COLORS.P2} />
                </Pie>
                <Tooltip formatter={(v)=>`${v}h`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card" style={{height:380}}>
          <h3>Ore per interfaccia</h3>
          <div className="content" style={{height:300}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.map(d => ({ name: `${d.id} ${d.name}`.slice(0,28), Ore: d.total }))} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(v)=>`${v}h`} />
                <Bar dataKey="Ore" fill="#2C8EFF" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Dettaglio */}
      <div id="dettaglio" className="card" style={{marginTop:12}}>
        <h3>Dettaglio interfacce ({filtered.length}/{data.length})</h3>
        <div className="content">
          <table className="table">
            <thead>
              <tr>
                <th className="nowrap">ID</th>
                <th>Interfaccia</th>
                <th className="nowrap">Priorità</th>
                <th className="right nowrap">FE</th>
                <th className="right nowrap">BE</th>
                <th className="right nowrap">INTG</th>
                <th className="right nowrap">QA</th>
                <th className="right nowrap">Totale</th>
                <th className="right nowrap">Costo @ {rate}€/h</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d,idx) => (
                <tr key={d.id} className="rowcard">
                  <td className="nowrap">{d.id}</td>
                  <td>
                    <div style={{fontWeight:600}}>{d.name}</div>
                    <div className="desc">{d.desc}</div>
                    <div className="desc"><i>Dipendenze:</i> {d.deps}</div>
                  </td>
                  <td><span className="pill" style={{background: COLORS[d.priority]}}>{d.priority} — {priorityLabel(d.priority)}</span></td>
                  {view==='admin' && authed ? (
                    <>
                      <td className="right"><input className="input small" type="number" min="0" value={d.fe} onChange={e=>setItemValue(idx,'fe',e.target.value)} /></td>
                      <td className="right"><input className="input small" type="number" min="0" value={d.be} onChange={e=>setItemValue(idx,'be',e.target.value)} /></td>
                      <td className="right"><input className="input small" type="number" min="0" value={d.intg} onChange={e=>setItemValue(idx,'intg',e.target.value)} /></td>
                      <td className="right"><input className="input small" type="number" min="0" value={d.qa} onChange={e=>setItemValue(idx,'qa',e.target.value)} /></td>
                    </>
                  ) : (
                    <>
                      <td className="right">{d.fe}h</td>
                      <td className="right">{d.be}h</td>
                      <td className="right">{d.intg}h</td>
                      <td className="right">{d.qa}h</td>
                    </>
                  )}
                  <td className="right" style={{fontWeight:600}}>{d.total}h</td>
                  <td className="right">{euro(d.total * rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Economica */}
      <div id="economica" className="row row-2" style={{marginTop:12}}>
        <div className="card">
          <h3>Riepilogo ore</h3>
          <div className="content grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div className="kpi"><div className="label">Totale ore</div><div className="value">{totals.grand}h</div></div>
            <div className="kpi"><div className="label">Con buffer {bufferPct}%</div><div className="value">{totals.withBuffer}h</div></div>
            <div className="kpi"><div className="label">Costo @ {rate}€/h</div><div className="value">{euro(costTot)}</div></div>
            <div className="kpi"><div className="label">Costo + buffer</div><div className="value">{euro(costTotBuf)}</div></div>
          </div>
        </div>
        <div className="card">
          <h3>Scenari tariffari</h3>
          <div className="content">
            {view==='admin' && authed ? (
              <div className="grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                {[35,45,60].map(r => (
                  <div key={r} className="kpi" style={{borderColor: r===rate ? 'var(--cta)' : 'var(--border)', boxShadow: r===rate ? '0 0 0 2px rgba(44,142,255,.2)' : 'none'}}>
                    <div className="label">Tariffa</div>
                    <div className="value">{r} €/h</div>
                    <div className="section-title">Totale</div>
                    <div>{euro(totals.grand * r)}</div>
                    <div className="section-title">+ Buffer</div>
                    <div>{euro(Math.round(totals.withBuffer * r))}</div>
                    <button className="btn" style={{marginTop:8}} onClick={()=>setRate(r)}>Usa questa</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">Gli scenari automatici sono nascosti nella vista cliente.</div>
            )}
          </div>
        </div>
      </div>

      {/* Admin edit */}
      {view==='admin' && (
        <div id="admin" className="card" style={{marginTop:12}}>
          <h3>Modifica dati (Admin)</h3>
          <div className="content">
            {!authed ? (
              <div className="muted">Esegui il <b>login admin</b> per modificare ore e prezzi.</div>
            ) : (
              <div className="controls" style={{gap:10}}>
                <button className="btn" onClick={saveOverridesLocal}>Salva bozza (locale)</button>
                <button className="btn" onClick={resetToPublished}>Ripristina dati pubblicati</button>
                <button className="btn primary" onClick={downloadDataJson}>Scarica <code>data.json</code> per pubblicazione</button>
              </div>
            )}
            <p className="muted" style={{marginTop:8}}>Per condividere subito al cliente senza pubblicare: usa <b>Copia link cliente (bozza)</b>. Per rendere definitive le modifiche, sostituisci il file <code>public/data.json</code> nel repo GitHub e redeploy su Vercel.</p>
          </div>
        </div>
      )}

      <p className="muted" style={{marginTop:16}}>Nota: il passcode admin è una barriera leggera per demo. Per protezione reale usa autenticazione lato server.</p>
    </div>
  )
}
