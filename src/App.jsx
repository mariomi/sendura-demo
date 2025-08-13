import React, { useMemo, useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts'

const RAW = [
  { id: "A1", name: "Login / Autenticazione con redirect per ruolo", desc: "Schermata di login + routing per ruolo (Admin, PM, RO, Cliente). Protezione route e controllo sessione.", priority: "P0", deps: "Supabase Auth, RLS, Matrice ruoli", fe: 8, be: 6, intg: 0, qa: 4 },
  { id: "R1", name: "Reply Operator — Home (una conversazione alla volta)", desc: "Thread, editor risposta con template, classificazione, code, guardrail booking.", priority: "P0", deps: "Resend (in/out), DB conversazioni, regole di stato", fe: 28, be: 18, intg: 12, qa: 10 },
  { id: "R2", name: "Booking Discovery Call (Cal.com)", desc: "Bottone booking, pass dati contatto, webhook, stato appuntamento, cancel.", priority: "P0", deps: "Cal.com API/Webhook, DB bookings, RO Home", fe: 8, be: 10, intg: 0, qa: 6 },
  { id: "L1", name: "Reply Operator — Log Page", desc: "Eventi/azioni (assegnazioni, risposte, classificazioni, booking) con filtri.", priority: "P1", deps: "Event log, ruoli", fe: 8, be: 6, intg: 0, qa: 3 },
  { id: "P1", name: "Project Manager — Dashboard", desc: "Overview progetti, workload operatori, assegnazioni, KPI base.", priority: "P1", deps: "RLS, viste KPI base, assignments", fe: 14, be: 10, intg: 0, qa: 5 },
  { id: "K1", name: "KPI Dashboard (Admin/PM)", desc: "Grafici KPI (gestite, <24h, TTR, booking/100, errati) + filtri.", priority: "P1", deps: "Materialized views, event log, charts", fe: 16, be: 16, intg: 0, qa: 6 },
  { id: "A2", name: "Admin — Utenti & Ruoli", desc: "Gestione utenti, ruoli, permessi e associazioni a progetti/scope.", priority: "P1", deps: "Supabase RLS, schema ruoli", fe: 10, be: 12, intg: 0, qa: 4 },
  { id: "C1", name: "Dashboard Cliente (reporting)", desc: "Vista lettura KPI e appuntamenti del cliente. Export semplice.", priority: "P2", deps: "Viste KPI per client_id", fe: 10, be: 8, intg: 0, qa: 4 },
  { id: "E1", name: "Lead Explorer", desc: "Filtri area/settore/fatturato/ruolo/template, conteggi, export.", priority: "P2", deps: "Dataset lead, indici ricerche", fe: 14, be: 14, intg: 0, qa: 6 },
  { id: "V1", name: "Virtual Desk — Selettore e UI soglie", desc: "Selettore scrivania, indicatori carico/soglia (autoscaling server-side).", priority: "P2", deps: "Assignments, metriche carico", fe: 6, be: 4, intg: 10, qa: 2 },
  { id: "A3", name: "Recupero password (forgot/reset)", desc: "Reset via email, stato e conferme.", priority: "P1", deps: "Supabase Auth", fe: 2, be: 1, intg: 0, qa: 1 },
]

const COLORS = { P0:'#F64C38', P1:'#2C8EFF', P2:'#FFA726' }
const priorityLabel = p => ({P0:'Bloccante (MVP)', P1:'Importante', P2:'Post-MVP'})[p] || p
const euro = n => new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(n)

function useQueryParams() {
  const [params, setParams] = useState(new URLSearchParams(window.location.search))
  useEffect(() => {
    const onPop = () => setParams(new URLSearchParams(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return params
}

export default function App() {
  const params = useQueryParams()
  const initialRole = params.get('view') === 'client' ? 'client' : 'owner'
  const [role, setRole] = useState(initialRole)
  const [selectedPriority, setSelectedPriority] = useState('ALL')
  const [rate, setRate] = useState(Number(params.get('rate') || 45))
  const [bufferPct, setBufferPct] = useState(Number(params.get('buffer') || 20))
  const [search, setSearch] = useState('')

  const data = useMemo(() => RAW.map(r => ({ ...r, total: r.fe + r.be + r.intg + r.qa })), [])

  const filtered = useMemo(() =>
    data.filter(d => (selectedPriority === 'ALL' || d.priority === selectedPriority) &&
      (search.trim() === '' || (d.name + ' ' + d.id + ' ' + d.desc).toLowerCase().includes(search.toLowerCase()))),
    [data, selectedPriority, search]
  )

  const totals = useMemo(() => {
    const byP = { P0:0, P1:0, P2:0 }
    data.forEach(d => { byP[d.priority] += d.total })
    const grand = Object.values(byP).reduce((a,b)=>a+b,0)
    return { byP, grand, withBuffer: Math.round(grand * (1 + bufferPct/100)) }
  }, [data, bufferPct])

  const effectiveRate = role === 'client' ? Number(params.get('rate') || rate) : rate
  const effectiveBuffer = role === 'client' ? Number(params.get('buffer') || bufferPct) : bufferPct

  const pieData = [
    { name: 'P0', value: totals.byP.P0, fill: COLORS.P0 },
    { name: 'P1', value: totals.byP.P1, fill: COLORS.P1 },
    { name: 'P2', value: totals.byP.P2, fill: COLORS.P2 }
  ]
  const barData = data.map(d => ({ name: `${d.id} ${d.name}`.slice(0, 28), Ore: d.total }))

  const costTot = totals.grand * effectiveRate
  const costTotBuf = Math.round(totals.withBuffer * effectiveRate)

  function csvDownload(filename, rows) {
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  }
  function downloadHoursCSV() {
    const rows = [["ID","Interfaccia","Priorità","FE","BE","INTG","QA","Totale (h)"]]
    data.forEach(d => rows.push([d.id, d.name, d.priority, d.fe, d.be, d.intg, d.qa, d.total]))
    rows.push([])
    rows.push(["P0", totals.byP.P0])
    rows.push(["P1", totals.byP.P1])
    rows.push(["P2", totals.byP.P2])
    rows.push(["Totale", totals.grand])
    rows.push([`Totale + buffer ${effectiveBuffer}%`, totals.withBuffer])
    csvDownload('sendura_ore.csv', rows)
  }
  function downloadPricingCSV() {
    const rows = [["ID","Interfaccia","Priorità","Ore","Tariffa €/h","Totale €","Totale+buffer €"]]
    data.forEach(d => rows.push([d.id, d.name, d.priority, d.total, effectiveRate, Math.round(d.total*effectiveRate), Math.round(d.total*effectiveRate*(1+effectiveBuffer/100))]))
    rows.push([])
    rows.push(["— Riepilogo —", "", "", totals.grand, effectiveRate, Math.round(costTot), Math.round(costTotBuf)])
    csvDownload('sendura_economica.csv', rows)
  }
  function copyClientLink() {
    const url = new URL(window.location.href)
    url.searchParams.set('view','client')
    url.searchParams.set('rate', String(rate))
    url.searchParams.set('buffer', String(bufferPct))
    navigator.clipboard.writeText(url.toString())
    alert('Link cliente copiato negli appunti')
  }

  return (
    <div className="container">
      <div className="header">
        <div className="title">
          <div style={{height:36,width:36,borderRadius:10,background:'#002F6C',color:'#fff',display:'grid',placeItems:'center',fontWeight:700}}>S</div>
          <div>
            <div style={{fontSize:22,fontWeight:600}}>SENDURA — Stime & Prospetto Interfacce</div>
            <div className="muted">{new Date().toLocaleDateString('it-IT')} • Demo presentabile</div>
          </div>
          <span className="badge" style={{background: role==='client' ? '#059669' : '#1f2937'}}>{role==='client'?'Vista Cliente':'Vista Interna'}</span>
        </div>
        <div className="controls no-print">
          {role === 'owner' && (<>
            <button className="btn" onClick={copyClientLink}>Copia link cliente</button>
            <button className="btn" onClick={()=>setRole('client')}>Anteprima cliente</button>
          </>)}
          <button className="btn" onClick={()=>window.print()}>Stampa / PDF</button>
          <button className="btn" onClick={downloadHoursCSV}>Ore (CSV)</button>
          {role === 'owner' && (<button className="btn primary" onClick={downloadPricingCSV}>Economica (CSV)</button>)}
        </div>
      </div>

      <div className="linkbar no-print">
        <a className="anchor" href="#panoramica">Panoramica</a>
        <a className="anchor" href="#dettaglio">Dettaglio</a>
        <a className="anchor" href="#economica">Economica</a>
        <a className="anchor" href="#roadmap">Roadmap</a>
      </div>

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
            {role === 'owner' ? (<>
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
                <input className="input" inputMode="numeric" value={effectiveBuffer} onChange={e=>setBufferPct(Math.max(0, Number(e.target.value||0)))} />
              </div>
            </>) : (<>
              <div style={{gridColumn:'span 3'}}>
                <div className="muted">Tariffa concordata</div>
                <div style={{fontSize:18,fontWeight:600}}>{effectiveRate} €/h</div>
              </div>
              <div>
                <div className="muted">Buffer</div>
                <div style={{fontSize:18,fontWeight:600}}>{effectiveBuffer}%</div>
              </div>
              <div className="muted" style={{display:'flex',alignItems:'center'}}>Parametri preimpostati</div>
            </>)}
            <div className="muted" style={{gridColumn:'span 1'}}>
              <div>Tot. ore: <b>{totals.grand}</b></div>
              <div>Tot. costo: <b>{euro(costTot)}</b></div>
              <div>+ buffer {effectiveBuffer}%: <b>{euro(costTotBuf)}</b></div>
            </div>
          </div>
        </div>
      </div>

      <div className="row row-4" style={{marginTop:12}}>
        <div className="kpi"><div className="label">Ore P0</div><div className="value">{totals.byP.P0}h</div></div>
        <div className="kpi"><div className="label">Ore P1</div><div className="value">{totals.byP.P1}h</div></div>
        <div className="kpi"><div className="label">Ore P2</div><div className="value">{totals.byP.P2}h</div></div>
        <div className="kpi"><div className="label">Totale ore</div><div className="value">{totals.grand}h</div></div>
      </div>

      <div id="panoramica" className="row row-2" style={{marginTop:12}}>
        <div className="card" style={{height:380}}>
          <h3>Ripartizione ore per priorità</h3>
          <div className="content" style={{height:300}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {pieData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
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
              <BarChart data={barData} margin={{ left: 0, right: 8 }}>
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
                <th className="right nowrap">Costo @ {effectiveRate}€/h</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="rowcard">
                  <td className="nowrap">{d.id}</td>
                  <td>
                    <div style={{fontWeight:600}}>{d.name}</div>
                    <div className="desc">{d.desc}</div>
                    <div className="desc"><i>Dipendenze:</i> {d.deps}</div>
                  </td>
                  <td><span className="pill" style={{background: COLORS[d.priority]}}>{d.priority} — {priorityLabel(d.priority)}</span></td>
                  <td className="right">{d.fe}h</td>
                  <td className="right">{d.be}h</td>
                  <td className="right">{d.intg}h</td>
                  <td className="right">{d.qa}h</td>
                  <td className="right" style={{fontWeight:600}}>{d.total}h</td>
                  <td className="right">{euro(d.total * effectiveRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="economica" className="row row-2" style={{marginTop:12}}>
        <div className="card">
          <h3>Riepilogo ore</h3>
          <div className="content grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div className="kpi"><div className="label">Totale ore</div><div className="value">{totals.grand}h</div></div>
            <div className="kpi"><div className="label">Con buffer {effectiveBuffer}%</div><div className="value">{totals.withBuffer}h</div></div>
            <div className="kpi"><div className="label">Costo @ {effectiveRate}€/h</div><div className="value">{euro(costTot)}</div></div>
            <div className="kpi"><div className="label">Costo + buffer</div><div className="value">{euro(costTotBuf)}</div></div>
          </div>
        </div>
        <div className="card">
          <h3>Scenari tariffari</h3>
          <div className="content">
            {role === 'owner' ? (
              <div className="grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                {[35,45,60].map(r => (
                  <div key={r} className="kpi" style={{borderColor: r===effectiveRate ? 'var(--cta)' : 'var(--border)', boxShadow: r===effectiveRate ? '0 0 0 2px rgba(44,142,255,.2)' : 'none'}}>
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

      <div id="roadmap" className="card" style={{marginTop:12}}>
        <h3>Roadmap (per priorità)</h3>
        <div className="content grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
          {['P0','P1','P2'].map(p => (
            <div key={p} className="kpi" style={{alignSelf:'start'}}>
              <div className="label">{p} — {priorityLabel(p)}</div>
              <ul style={{paddingLeft:16, margin:'8px 0', lineHeight:1.5}}>
                {data.filter(d => d.priority === p).map(d => (
                  <li key={d.id}>
                    <b>{d.id}</b> — {d.name}
                    <div className="desc">{d.total}h</div>
                  </li>
                ))}
              </ul>
              <div className="desc" style={{marginTop:8}}>Totale {p}: <b>{data.filter(d=>d.priority===p).reduce((a,b)=>a+b.total,0)}h</b></div>
            </div>
          ))}
        </div>
      </div>

      <p className="muted" style={{marginTop:16}}>Nota: le stime includono FE/BE/Integrazioni/QA. Prezzi IVA esclusa. Il buffer copre rischi, rework e setup.</p>
    </div>
  )
}
