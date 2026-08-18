import React, { useEffect, useMemo, useState } from "react";

const money = n => new Intl.NumberFormat("es-CL", {
  style: "currency", currency: "CLP", maximumFractionDigits: 0
}).format(Number(n) || 0);

const today = new Date().toISOString().slice(0, 10);
const period = today.slice(0, 7);

async function api(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

function App() {
  const [data, setData] = useState({ personas: [], movimientos: [], auditoria: [] });
  const [view, setView] = useState("dashboard");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [toast, setToast] = useState("");

  const refresh = async () => setData(await api("/api/bootstrap"));

  useEffect(() => { refresh().catch(e => showToast(e.message)); }, []);

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const persons = data.personas;
  const validMovements = data.movimientos.filter(m => m.estado !== "Anulado");
  const monthMovements = validMovements.filter(m => m.periodo_descuento === period);

  const personMap = useMemo(() => Object.fromEntries(persons.map(p => [p.persona_id, p])), [persons]);
  const nameOf = id => personMap[id]?.nombre || "Sin persona";

  const totals = useMemo(() => ({
    total: monthMovements.reduce((a, m) => a + +m.monto, 0),
    anticipos: monthMovements.filter(m => m.tipo === "Anticipo").reduce((a, m) => a + +m.monto, 0),
    prestamos: monthMovements.filter(m => m.tipo === "Prestamo").reduce((a, m) => a + +m.monto, 0),
    descuentos: monthMovements.filter(m => m.tipo === "Descuento").reduce((a, m) => a + +m.monto, 0)
  }), [monthMovements]);

  const openPerson = id => {
    setSelectedPerson(id);
    setView("cuenta");
  };

  const cancelMovement = async id => {
    if (!confirm("¿Anular este movimiento? No se borrará: quedará trazabilidad en auditoría.")) return;
    try { await api(`/api/movimientos/${id}/anular`, { method: "PATCH" }); await refresh(); showToast("Movimiento anulado."); }
    catch (e) { showToast(e.message); }
  };

  const download = table => window.open(`/api/export/${table}`, "_blank");

  return <div className="shell">
    <header className="topbar">
      <div className="brand"><div className="logo">CC</div><div><strong>Cuenta Corriente</strong><small>Gestión local de anticipos y descuentos</small></div></div>
      <div className="top-actions">
        <span className="local-pill"><i></i> Datos locales</span>
        <button className="btn ghost" onClick={() => download("movimientos")}>Exportar CSV</button>
        <button className="btn primary" onClick={() => setModal("movement")}>+ Nuevo movimiento</button>
      </div>
    </header>

    <div className="layout">
      <aside className="sidebar">
        <div className="menu-label">GESTIÓN</div>
        {[
          ["dashboard","Resumen","⌂"],["personas","Personas","◉"],["movimientos","Movimientos","↔"],["cuenta","Cuenta corriente","▤"],["reportes","Reportes","▥"]
        ].map(([id,label,icon]) =>
          <button key={id} className={`nav ${view === id ? "active" : ""}`} onClick={() => setView(id)}><span>{icon}</span>{label}</button>
        )}
        <div className="sidebar-bottom">
          <div className="db-card"><span className="dot"></span><div><b>Modo local</b><small>CSV + Node.js</small></div></div>
        </div>
      </aside>

      <main className="main">
        {view === "dashboard" && <Dashboard totals={totals} movements={monthMovements} persons={persons} nameOf={nameOf} openPerson={openPerson} />}
        {view === "personas" && <People persons={persons} movements={validMovements} search={search} setSearch={setSearch} openPerson={openPerson} onNew={() => setModal("person")} />}
        {view === "movimientos" && <Movements movements={validMovements} nameOf={nameOf} search={search} setSearch={setSearch} typeFilter={typeFilter} setTypeFilter={setTypeFilter} onCancel={cancelMovement} />}
        {view === "cuenta" && <Account persons={persons} movements={validMovements} nameOf={nameOf} selected={selectedPerson || persons[0]?.persona_id} setSelected={setSelectedPerson} />}
        {view === "reportes" && <Reports persons={persons} movements={monthMovements} />}
      </main>
    </div>

    {modal === "person" && <PersonModal close={() => setModal(null)} done={async () => { await refresh(); setModal(null); showToast("Persona creada."); }} />}
    {modal === "movement" && <MovementModal persons={persons} close={() => setModal(null)} done={async () => { await refresh(); setModal(null); showToast("Movimiento registrado."); }} />}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function Header({ title, subtitle, action }) {
  return <div className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function Dashboard({ totals, movements, persons, nameOf, openPerson }) {
  const by = {};
  movements.forEach(m => by[m.persona_id] = (by[m.persona_id] || 0) + +m.monto);
  const people = Object.entries(by).sort((a,b) => b[1]-a[1]);
  return <><Header title="Resumen de agosto" subtitle="Vista general de los movimientos del período" action={<button className="btn primary">+ Registrar movimiento</button>} />
    <div className="hero"><div><span>MONTO REGISTRADO EN EL PERÍODO</span><strong>{money(totals.total)}</strong><small>Todo lo asociado al descuento/control de agosto 2026</small></div><div className="hero-icon">↗</div></div>
    <div className="cards">
      <Card label="Anticipos" value={totals.anticipos} icon="↑" />
      <Card label="Préstamos" value={totals.prestamos} icon="↻" />
      <Card label="Otros descuentos" value={totals.descuentos} icon="−" />
      <Card label="Personas con movimientos" value={people.length} raw icon="●" />
    </div>
    <div className="grid2">
      <section className="panel"><PanelTitle title="Resumen por persona" extra="Agosto 2026" />
        {people.slice(0,8).map(([id,total]) => <button className="person-row" key={id} onClick={() => openPerson(id)}><div className="avatar">{nameOf(id).split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div className="grow"><b>{nameOf(id)}</b><small>{persons.find(p=>p.persona_id===id)?.empresa}</small></div><strong>{money(total)}</strong><span>›</span></button>)}
      </section>
      <section className="panel"><PanelTitle title="Últimos movimientos" extra="Más recientes" />
        {movements.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,7).map(m => <div className="movement-row" key={m.movimiento_id}><div className="type-dot">{m.tipo[0]}</div><div className="grow"><b>{nameOf(m.persona_id)}</b><small>{m.concepto} · {m.fecha}</small></div><strong>{money(m.monto)}</strong></div>)}
      </section>
    </div>
  </>
}

function Card({label,value,icon,raw}) { return <div className="card"><div className="card-icon">{icon}</div><span>{label}</span><strong>{raw ? value : money(value)}</strong></div> }
function PanelTitle({title,extra}) { return <div className="panel-title"><h2>{title}</h2><span>{extra}</span></div> }

function People({ persons, movements, search, setSearch, openPerson, onNew }) {
  const rows = persons.filter(p => `${p.nombre} ${p.rut} ${p.empresa}`.toLowerCase().includes(search.toLowerCase()));
  return <><Header title="Personas" subtitle="Maestro de trabajadores y sus cuentas" action={<button className="btn primary" onClick={onNew}>+ Nueva persona</button>} />
    <div className="toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, RUT o empresa..." /></div>
    <section className="panel table-panel"><table><thead><tr><th>Persona</th><th>RUT</th><th>Empresa</th><th>Estado</th><th>Movimientos</th><th></th></tr></thead><tbody>
      {rows.map(p => <tr key={p.persona_id}><td><b>{p.nombre}</b></td><td>{p.rut}</td><td>{p.empresa}</td><td><span className="status">{p.estado}</span></td><td>{movements.filter(m=>m.persona_id===p.persona_id).length}</td><td><button className="link" onClick={()=>openPerson(p.persona_id)}>Ver cuenta</button></td></tr>)}
    </tbody></table></section>
  </>
}

function Movements({ movements, nameOf, search, setSearch, typeFilter, setTypeFilter, onCancel }) {
  const rows = movements.filter(m => `${nameOf(m.persona_id)} ${m.concepto}`.toLowerCase().includes(search.toLowerCase()) && (!typeFilter || m.tipo===typeFilter)).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return <><Header title="Movimientos" subtitle="Registro de salidas y descuentos asociados a personas" />
    <div className="toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar persona o concepto..." /><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">Todos los tipos</option><option>Anticipo</option><option>Prestamo</option><option>Descuento</option></select></div>
    <section className="panel table-panel"><table><thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Concepto</th><th>Medio</th><th>Cuota</th><th>Monto</th><th></th></tr></thead><tbody>
      {rows.map(m=><tr key={m.movimiento_id}><td>{m.fecha}</td><td><b>{nameOf(m.persona_id)}</b></td><td><span className="tag">{m.tipo}</span></td><td>{m.concepto}</td><td>{m.medio_pago || "—"}</td><td>{m.cuota_actual ? `${m.cuota_actual}/${m.cuotas_total}` : "—"}</td><td className="amount">{money(m.monto)}</td><td><button className="icon-btn" title="Anular" onClick={()=>onCancel(m.movimiento_id)}>⋮</button></td></tr>)}
    </tbody></table></section>
  </>
}

function Account({persons,movements,nameOf,selected,setSelected}) {
  const ms=movements.filter(m=>m.persona_id===selected && m.periodo_descuento===period);
  const total=ms.reduce((a,m)=>a+ +m.monto,0), ant=ms.filter(m=>m.tipo==="Anticipo").reduce((a,m)=>a+ +m.monto,0), pre=ms.filter(m=>m.tipo==="Prestamo").reduce((a,m)=>a+ +m.monto,0), des=ms.filter(m=>m.tipo==="Descuento").reduce((a,m)=>a+ +m.monto,0);
  const p=persons.find(x=>x.persona_id===selected);
  return <><Header title="Cuenta corriente" subtitle="Detalle mensual y total a descontar/controlar" />
    <div className="account-head"><div className="profile"><div className="avatar big">{p?.nombre.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><h2>{p?.nombre}</h2><p>{p?.empresa} · {p?.rut || "RUT no informado"}</p></div></div><select value={selected||""} onChange={e=>setSelected(e.target.value)}>{persons.map(p=><option key={p.persona_id} value={p.persona_id}>{p.nombre}</option>)}</select></div>
    <div className="account-cards"><div><span>Total del período</span><strong>{money(total)}</strong></div><div><span>Anticipos</span><strong>{money(ant)}</strong></div><div><span>Préstamos</span><strong>{money(pre)}</strong></div><div><span>Descuentos</span><strong>{money(des)}</strong></div></div>
    <section className="panel table-panel"><PanelTitle title="Movimientos de agosto 2026" extra={`${ms.length} registros`} /><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Medio</th><th>Cuota</th><th>Monto</th></tr></thead><tbody>{ms.map(m=><tr key={m.movimiento_id}><td>{m.fecha}</td><td><span className="tag">{m.tipo}</span></td><td>{m.concepto}</td><td>{m.medio_pago || "—"}</td><td>{m.cuota_actual ? `${m.cuota_actual}/${m.cuotas_total}` : "—"}</td><td className="amount">{money(m.monto)}</td></tr>)}</tbody></table></section>
  </>
}

function Reports({persons,movements}) {
  const rows=persons.map(p=>{const ms=movements.filter(m=>m.persona_id===p.persona_id);return {p,ant:ms.filter(m=>m.tipo==="Anticipo").reduce((a,m)=>a+ +m.monto,0),pre:ms.filter(m=>m.tipo==="Prestamo").reduce((a,m)=>a+ +m.monto,0),des:ms.filter(m=>m.tipo==="Descuento").reduce((a,m)=>a+ +m.monto,0),cash:ms.filter(m=>m.medio_pago==="Efectivo").reduce((a,m)=>a+ +m.monto,0),transfer:ms.filter(m=>m.medio_pago==="Transferencia").reduce((a,m)=>a+ +m.monto,0)}).filter(x=>x.ant+x.pre+x.des);
  return <><Header title="Reportes" subtitle="Consolidado para revisión de remuneraciones" /><section className="panel table-panel"><PanelTitle title="Resumen mensual" extra="Agosto 2026" /><table><thead><tr><th>Persona</th><th>Empresa</th><th>Anticipos</th><th>Préstamos</th><th>Descuentos</th><th>Efectivo</th><th>Transferencia</th><th>Total</th></tr></thead><tbody>{rows.map(x=><tr key={x.p.persona_id}><td><b>{x.p.nombre}</b></td><td>{x.p.empresa}</td><td className="amount">{money(x.ant)}</td><td className="amount">{money(x.pre)}</td><td className="amount">{money(x.des)}</td><td className="amount">{money(x.cash)}</td><td className="amount">{money(x.transfer)}</td><td className="amount"><b>{money(x.ant+x.pre+x.des)}</b></td></tr>)}</tbody></table></section></>
}

function PersonModal({close,done}) {
 const [form,setForm]=useState({nombre:"",rut:"",empresa:"",estado:"Activo"});
 const submit=async e=>{e.preventDefault();try{await api("/api/personas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});await done()}catch(e){alert(e.message)}};
 return <Modal title="Nueva persona" close={close}><form onSubmit={submit}><div className="form-grid"><Field label="Nombre completo"><input required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></Field><Field label="RUT"><input value={form.rut} onChange={e=>setForm({...form,rut:e.target.value})}/></Field><Field label="Empresa"><input value={form.empresa} onChange={e=>setForm({...form,empresa:e.target.value})}/></Field><Field label="Estado"><select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}><option>Activo</option><option>Inactivo</option></select></Field></div><Actions close={close} label="Guardar persona"/></form></Modal>
}

function MovementModal({persons,close,done}) {
 const [form,setForm]=useState({persona_id:persons[0]?.persona_id||"",fecha:today,tipo:"Anticipo",concepto:"",monto:"",medio_pago:"",cuota_actual:"",cuotas_total:"",observacion:""});
 const set=(k,v)=>setForm({...form,[k]:v});
 const submit=async e=>{e.preventDefault();try{await api("/api/movimientos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});await done()}catch(e){alert(e.message)}};
 return <Modal title="Registrar movimiento" close={close}><form onSubmit={submit}><div className="form-grid"><Field label="Persona" full><select value={form.persona_id} onChange={e=>set("persona_id",e.target.value)}>{persons.map(p=><option key={p.persona_id} value={p.persona_id}>{p.nombre} · {p.empresa}</option>)}</select></Field><Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>set("fecha",e.target.value)}/></Field><Field label="Tipo"><select value={form.tipo} onChange={e=>set("tipo",e.target.value)}><option>Anticipo</option><option>Prestamo</option><option>Descuento</option></select></Field><Field label="Concepto" full><input required placeholder="Ej. Anticipo sueldo" value={form.concepto} onChange={e=>set("concepto",e.target.value)}/></Field><Field label="Monto"><input required type="number" min="1" value={form.monto} onChange={e=>set("monto",e.target.value)}/></Field><Field label="Medio de pago"><select value={form.medio_pago} onChange={e=>set("medio_pago",e.target.value)}><option></option><option>Transferencia</option><option>Efectivo</option></select></Field><Field label="Cuota actual"><input placeholder="Ej. 22" value={form.cuota_actual} onChange={e=>set("cuota_actual",e.target.value)}/></Field><Field label="Total cuotas"><input placeholder="Ej. 28" value={form.cuotas_total} onChange={e=>set("cuotas_total",e.target.value)}/></Field><Field label="Observación" full><input value={form.observacion} onChange={e=>set("observacion",e.target.value)}/></Field></div><div className="form-note">El sistema asignará automáticamente el período de descuento según la fecha y conservará la trazabilidad del registro.</div><Actions close={close} label="Guardar movimiento"/></form></Modal>
}

function Field({label,children,full}) { return <div className={`field ${full?"full":""}`}><label>{label}</label>{children}</div> }
function Actions({close,label}) { return <div className="modal-actions"><button type="button" className="btn ghost" onClick={close}>Cancelar</button><button className="btn primary">{label}</button></div> }
function Modal({title,close,children}) { return <div className="backdrop"><div className="modal"><div className="modal-title"><h2>{title}</h2><button onClick={close}>×</button></div>{children}</div></div> }

export default App;
