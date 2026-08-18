import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const money = n => new Intl.NumberFormat("es-CL", {
  style: "currency", currency: "CLP", maximumFractionDigits: 0
}).format(Number(n) || 0);

const today = new Date().toISOString().slice(0,10);
const IS_PAGES = window.location.hostname.endsWith("github.io");
const LS_KEY = "sistema-prestamos-anticipo-v04";

const seed = {
  personas: [
    {persona_id:"P001",rut:"13.066.599-3",nombre:"Paulina Acuña Campos",empresa:"MGS Repuestos",estado:"Activo",fecha_alta:"2026-08-01"},
    {persona_id:"P002",rut:"",nombre:"Mauricio Alvear Alfaro",empresa:"MGS Repuestos",estado:"Activo",fecha_alta:"2026-08-01"},
    {persona_id:"P003",rut:"",nombre:"Luis Alarcon Gutierrez",empresa:"MGS Repuestos",estado:"Activo",fecha_alta:"2026-08-01"},
    {persona_id:"P004",rut:"",nombre:"Cesar Gonzalez Lopez",empresa:"Floma SPA",estado:"Activo",fecha_alta:"2026-08-01"}
  ],
  movimientos: [
    {movimiento_id:"M001",persona_id:"P001",fecha:"2026-08-03",tipo:"Anticipo",concepto:"Anticipo sueldo",monto:"400000",medio_pago:"Transferencia",cuota_actual:"",cuotas_total:"",periodo_descuento:"2026-08",observacion:"",estado:"Vigente"},
    {movimiento_id:"M002",persona_id:"P001",fecha:"2026-08-04",tipo:"Anticipo",concepto:"Anticipo sueldo ayuda",monto:"150000",medio_pago:"Transferencia",cuota_actual:"",cuotas_total:"",periodo_descuento:"2026-08",observacion:"Ayuda",estado:"Vigente"},
    {movimiento_id:"M003",persona_id:"P001",fecha:"2026-08-11",tipo:"Prestamo",concepto:"Prestamo empresa",monto:"150000",medio_pago:"",cuota_actual:"22",cuotas_total:"28",periodo_descuento:"2026-08",observacion:"",estado:"Vigente"},
    {movimiento_id:"M004",persona_id:"P001",fecha:"2026-08-17",tipo:"Descuento",concepto:"Seguro MetLife",monto:"16547",medio_pago:"",cuota_actual:"",cuotas_total:"",periodo_descuento:"2026-08",observacion:"",estado:"Vigente"},
    {movimiento_id:"M005",persona_id:"P002",fecha:"2026-08-12",tipo:"Anticipo",concepto:"Anticipo sueldo",monto:"530000",medio_pago:"Transferencia",cuota_actual:"",cuotas_total:"",periodo_descuento:"2026-08",observacion:"",estado:"Vigente"},
    {movimiento_id:"M006",persona_id:"P004",fecha:"2026-08-03",tipo:"Anticipo",concepto:"Anticipo sueldo",monto:"850000",medio_pago:"Transferencia",cuota_actual:"",cuotas_total:"",periodo_descuento:"2026-08",observacion:"",estado:"Vigente"}
  ]
};

function pageData(){
  if(!localStorage.getItem(LS_KEY)) localStorage.setItem(LS_KEY, JSON.stringify(seed));
  return JSON.parse(localStorage.getItem(LS_KEY));
}
function savePageData(d){ localStorage.setItem(LS_KEY, JSON.stringify(d)); }

async function api(url, options={}) {
  if (!IS_PAGES) {
    const r = await fetch(url, options);
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || "No se pudo completar la operación.");
    return data;
  }
  const d = pageData();
  if (url === "/api/bootstrap") return d;

  if (url === "/api/personas" && options.method === "POST") {
    const body = JSON.parse(options.body);
    const item = {...body, persona_id:"P"+Date.now(), estado:"Activo", fecha_alta:today};
    d.personas.push(item); savePageData(d); return item;
  }

  if (url === "/api/movimientos" && options.method === "POST") {
    const body = JSON.parse(options.body), ts=Date.now();
    const item = {...body, movimiento_id:"M"+ts, periodo_descuento:body.fecha.slice(0,7), estado:"Vigente"};
    d.movimientos.push(item); savePageData(d); return item;
  }
  throw new Error("Operación no disponible.");
}

const typeClass = t => t==="Anticipo" ? "advance" : t==="Prestamo" ? "loan" : "discount";
const labelType = t => t==="Prestamo" ? "Préstamo" : t;

function safeSheetName(name) {
  return String(name || "Persona").replace(/[\\/?*\[\]:]/g, " ").trim().slice(0,31) || "Persona";
}

function fitSheet(ws) {
  if (!ws["!ref"]) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const widths = [];
  for (let C=range.s.c; C<=range.e.c; ++C) {
    let max=10;
    for (let R=range.s.r; R<=range.e.r; ++R) {
      const cell=ws[XLSX.utils.encode_cell({r:R,c:C})];
      const val=cell?.v == null ? "" : String(cell.v);
      max=Math.max(max, Math.min(val.length+2, 35));
    }
    widths.push({wch:max});
  }
  ws["!cols"]=widths;
}

function detailRows(person, movements) {
  const rows = movements.map(m => ({
    "Fecha": m.fecha,
    "Tipo": labelType(m.tipo),
    "Concepto": m.concepto,
    "Medio de pago": m.medio_pago || "",
    "Cuota": m.cuota_actual ? `${m.cuota_actual}/${m.cuotas_total}` : "",
    "Monto": Number(m.monto),
    "Observación": m.observacion || ""
  }));
  rows.push({
    "Fecha":"",
    "Tipo":"",
    "Concepto":"TOTAL",
    "Medio de pago":"",
    "Cuota":"",
    "Monto":movements.reduce((a,m)=>a+Number(m.monto),0),
    "Observación":""
  });
  return rows;
}

export default function App() {
  const [data,setData]=useState({personas:[],movimientos:[]});
  const [view,setView]=useState("personal");
  const [filters,setFilters]=useState({persona:"",tipo:"",mes:"2026-08"});
  const [detailPerson,setDetailPerson]=useState(null);
  const [toast,setToast]=useState("");

  const refresh=async()=>setData(await api("/api/bootstrap"));
  useEffect(()=>{refresh().catch(e=>showToast(e.message))},[]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2600)};

  return <div className="app-shell">
    <header className="header">
      <div className="eyebrow">GESTIÓN LOCAL DE PERSONAL</div>
      <h1>Sistema Préstamos/Anticipo</h1>
      <nav className="top-nav" aria-label="Navegación principal">
        <button className={view==="personal"?"active":""} onClick={()=>setView("personal")}>Personal</button>
        <button className={view==="movimiento"?"active":""} onClick={()=>setView("movimiento")}>Nuevo movimiento</button>
        <button className={view==="admin"?"active":""} onClick={()=>setView("admin")}>Administración</button>
      </nav>
    </header>

    <main>
      {view==="personal" && <PersonalView data={data} filters={filters} setFilters={setFilters} onDetail={setDetailPerson}/>}
      {view==="movimiento" && <NewMovement people={data.personas} done={async()=>{await refresh();showToast("Movimiento registrado.");setView("personal")}}/>}
      {view==="admin" && <Administration people={data.personas} done={async()=>{await refresh();showToast("Persona creada.");}}/>}
    </main>

    {detailPerson && <DetailModal person={detailPerson} data={data} filters={filters} close={()=>setDetailPerson(null)}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function NewMovement({people,done}) {
  const [query,setQuery]=useState("");
  const [activeIndex,setActiveIndex]=useState(0);
  const [f,setF]=useState({
    persona_id:"",fecha:today,tipo:"Anticipo",concepto:"",monto:"",
    medio_pago:"Transferencia",cuota_actual:"",cuotas_total:"",observacion:""
  });

  const matches=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return [];
    return people.filter(p=>`${p.nombre} ${p.rut} ${p.empresa}`.toLowerCase().includes(q)).slice(0,8);
  },[people,query]);

  const choose=p=>{
    setF({...f,persona_id:p.persona_id});
    setQuery(p.nombre);
    setActiveIndex(0);
  };

  const keyDown=e=>{
    if(query.trim().length < 1 || !matches.length) return;
    if(e.key==="ArrowDown"){e.preventDefault();setActiveIndex(i=>(i+1)%matches.length)}
    if(e.key==="ArrowUp"){e.preventDefault();setActiveIndex(i=>(i-1+matches.length)%matches.length)}
    if(e.key==="Enter"){e.preventDefault();choose(matches[activeIndex])}
  };

  const submit=async e=>{
    e.preventDefault();
    if(!f.persona_id) return alert("Selecciona una persona de la lista.");
    await api("/api/movimientos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});
    await done();
  };

  return <div className="page narrow">
    <div className="section-head"><h2>Nuevo movimiento</h2><p>Escribe el nombre y selecciona rápidamente a la persona.</p></div>
    <form className="movement-form" onSubmit={submit}>
      <div className="form-row full autocomplete">
        <label htmlFor="persona-search">Persona</label>
        <input
          id="persona-search"
          name="persona_busqueda_manual"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={query}
          placeholder="Empieza a escribir el nombre..."
          onChange={e=>{
            const value=e.target.value;
            setQuery(value);
            setF({...f,persona_id:""});
            setActiveIndex(0);
          }}
          onKeyDown={keyDown}
          aria-autocomplete="list"
          aria-expanded={query.trim().length >= 1}
        />
        {query.trim().length >= 1 && <div className="suggestions" role="listbox">
          {matches.length ? matches.map((p,i)=><button
            key={p.persona_id}
            type="button"
            tabIndex={-1}
            className={i===activeIndex?"selected":""}
            onMouseDown={e=>{e.preventDefault();choose(p)}}
          >
            <b>{p.nombre}</b><small>{p.empresa} {p.rut ? `· ${p.rut}`:""}</small>
          </button>) : <div className="no-result">No hay coincidencias</div>}
        </div>}
      </div>

      <div className="form-grid">
        <Field label="Fecha"><input type="date" value={f.fecha} onChange={e=>setF({...f,fecha:e.target.value})} required/></Field>
        <Field label="Tipo"><select value={f.tipo} onChange={e=>setF({...f,tipo:e.target.value})}><option>Anticipo</option><option>Prestamo</option><option>Descuento</option></select></Field>
        <Field label="Concepto"><input value={f.concepto} onChange={e=>setF({...f,concepto:e.target.value})} required placeholder="Ej. Anticipo de sueldo"/></Field>
        <Field label="Monto"><input type="number" min="1" value={f.monto} onChange={e=>setF({...f,monto:e.target.value})} required placeholder="$"/></Field>
        <Field label="Medio de pago"><select value={f.medio_pago} onChange={e=>setF({...f,medio_pago:e.target.value})}><option>Transferencia</option><option>Efectivo</option><option>Otro</option></select></Field>
        <Field label="Observación"><input value={f.observacion} onChange={e=>setF({...f,observacion:e.target.value})} placeholder="Opcional"/></Field>
      </div>

      {f.tipo==="Prestamo" && <div className="loan-box">
        <Field label="Cuota actual"><input value={f.cuota_actual} onChange={e=>setF({...f,cuota_actual:e.target.value})} placeholder="Ej. 4"/></Field>
        <Field label="Total cuotas"><input value={f.cuotas_total} onChange={e=>setF({...f,cuotas_total:e.target.value})} placeholder="Ej. 12"/></Field>
      </div>}

      <div className="type-preview">
        <span className={`type-chip ${typeClass(f.tipo)}`}>{labelType(f.tipo)}</span>
        <small>Todos los controles siguen un orden de Tab natural: Persona → Fecha → Tipo → Concepto → Monto → Medio → Observación → Guardar.</small>
      </div>
      <button className="save-btn" type="submit">Guardar movimiento</button>
    </form>
  </div>
}

function Field({label,children}){return <div className="form-row"><label>{label}</label>{children}</div>}

function PersonalView({data,filters,setFilters,onDetail}) {
  const peopleMap=Object.fromEntries(data.personas.map(p=>[p.persona_id,p]));
  const filtered=data.movimientos.filter(m=>
    m.estado!=="Anulado" &&
    (!filters.mes || m.periodo_descuento===filters.mes) &&
    (!filters.persona || m.persona_id===filters.persona) &&
    (!filters.tipo || m.tipo===filters.tipo)
  );

  const summary=data.personas.map(p=>{
    const ms=filtered.filter(m=>m.persona_id===p.persona_id);
    return {...p,
      anticipos:ms.filter(m=>m.tipo==="Anticipo").reduce((a,m)=>a+Number(m.monto),0),
      prestamos:ms.filter(m=>m.tipo==="Prestamo").reduce((a,m)=>a+Number(m.monto),0),
      descuentos:ms.filter(m=>m.tipo==="Descuento").reduce((a,m)=>a+Number(m.monto),0),
      total:ms.reduce((a,m)=>a+Number(m.monto),0),count:ms.length
    }
  }).filter(x=>x.count>0);

  const total=filtered.reduce((a,m)=>a+Number(m.monto),0);

  const generateReport=()=>{
    const wb=XLSX.utils.book_new();

    if(filters.persona){
      const p=peopleMap[filters.persona];
      const ms=filtered.filter(m=>m.persona_id===filters.persona);
      const info=[
        ["Sistema Préstamos/Anticipo"],
        ["Reporte individual"],
        ["Persona",p?.nombre||""],
        ["RUT",p?.rut||""],
        ["Empresa",p?.empresa||""],
        ["Período",filters.mes||"Todos"],
        ["Tipo",filters.tipo ? labelType(filters.tipo) : "Todos"],
        [],
      ];
      const ws=XLSX.utils.aoa_to_sheet(info);
      XLSX.utils.sheet_add_json(ws,detailRows(p,ms),{origin:"A9",skipHeader:false});
      fitSheet(ws);
      XLSX.utils.book_append_sheet(wb,ws,safeSheetName(p?.nombre));
      XLSX.writeFile(wb,`reporte_${safeSheetName(p?.nombre).replaceAll(" ","_")}_${filters.mes||"todos"}.xlsx`,{compression:true});
      return;
    }

    const summaryRows=summary.map(r=>({
      "Nombre":r.nombre,"RUT":r.rut,"Empresa":r.empresa,
      "Anticipos":r.anticipos,"Préstamos":r.prestamos,"Descuentos":r.descuentos,"Total":r.total
    }));
    summaryRows.push({
      "Nombre":"TOTAL","RUT":"","Empresa":"",
      "Anticipos":summary.reduce((a,r)=>a+r.anticipos,0),
      "Préstamos":summary.reduce((a,r)=>a+r.prestamos,0),
      "Descuentos":summary.reduce((a,r)=>a+r.descuentos,0),
      "Total":summary.reduce((a,r)=>a+r.total,0)
    });
    const wsSummary=XLSX.utils.json_to_sheet(summaryRows);
    fitSheet(wsSummary);
    XLSX.utils.book_append_sheet(wb,wsSummary,"Resumen");

    summary.forEach(r=>{
      const ms=filtered.filter(m=>m.persona_id===r.persona_id);
      const ws=XLSX.utils.json_to_sheet(detailRows(r,ms));
      fitSheet(ws);
      let name=safeSheetName(r.nombre), unique=name, n=2;
      while(wb.SheetNames.includes(unique)){unique=safeSheetName(`${name.slice(0,26)} ${n++}`)}
      XLSX.utils.book_append_sheet(wb,ws,unique);
    });

    XLSX.writeFile(wb,`reporte_personal_${filters.mes||"todos"}.xlsx`,{compression:true});
  };

  return <div className="page">
    <div className="filters">
      <div><label>Mes</label><input type="month" value={filters.mes} onChange={e=>setFilters({...filters,mes:e.target.value})}/></div>
      <div><label>Persona</label><select value={filters.persona} onChange={e=>setFilters({...filters,persona:e.target.value})}><option value="">Todas las personas</option>{data.personas.map(p=><option key={p.persona_id} value={p.persona_id}>{p.nombre}</option>)}</select></div>
      <div><label>Tipo</label><select value={filters.tipo} onChange={e=>setFilters({...filters,tipo:e.target.value})}><option value="">Todos los tipos</option><option>Anticipo</option><option>Prestamo</option><option>Descuento</option></select></div>
      <button className="report-btn" onClick={generateReport}>Generar reporte</button>
    </div>

    <div className="month-total">
      <div><span>{filters.persona?"TOTAL PERSONA / FILTRO":"TOTAL DEL MES / FILTRO"}</span><strong>{money(total)}</strong></div>
      <div className="legend"><span><i className="dot advance"></i>Anticipo</span><span><i className="dot loan"></i>Préstamo</span><span><i className="dot discount"></i>Descuento</span></div>
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>Personal</h2><p>Selecciona una persona para abrir el detalle.</p></div><span>{summary.length} persona(s)</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Persona</th><th>Empresa</th><th>Anticipos</th><th>Préstamos</th><th>Descuentos</th><th>Total</th><th></th></tr></thead>
        <tbody>{summary.map(r=><tr key={r.persona_id} className="clickable" onClick={()=>onDetail(r)}>
          <td><b>{r.nombre}</b><small>{r.rut}</small></td><td>{r.empresa}</td>
          <td><span className="amount-pill advance">{money(r.anticipos)}</span></td>
          <td><span className="amount-pill loan">{money(r.prestamos)}</span></td>
          <td><span className="amount-pill discount">{money(r.descuentos)}</span></td>
          <td><strong>{money(r.total)}</strong></td><td><button className="detail-btn">Detalle</button></td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </div>
}

function Administration({people,done}) {
  const [f,setF]=useState({nombre:"",rut:"",empresa:""});
  const submit=async e=>{
    e.preventDefault();
    await api("/api/personas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});
    setF({nombre:"",rut:"",empresa:""}); await done();
  };
  return <div className="page admin-grid">
    <section className="panel admin-card">
      <div className="panel-head"><div><h2>Nueva persona</h2><p>Agrega una persona al sistema.</p></div></div>
      <form onSubmit={submit} className="admin-form">
        <Field label="Nombre completo"><input autoFocus value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} required/></Field>
        <Field label="RUT"><input value={f.rut} onChange={e=>setF({...f,rut:e.target.value})}/></Field>
        <Field label="Empresa"><input value={f.empresa} onChange={e=>setF({...f,empresa:e.target.value})}/></Field>
        <button className="save-btn">Crear persona</button>
      </form>
    </section>
    <section className="panel">
      <div className="panel-head"><div><h2>Personas registradas</h2><p>Maestro actual.</p></div><span>{people.length}</span></div>
      <div className="simple-list">{people.map(p=><div key={p.persona_id}><div className="avatar">{p.nombre.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><b>{p.nombre}</b><small>{p.empresa} · {p.rut||"Sin RUT"}</small></div></div>)}</div>
    </section>
  </div>
}

function DetailModal({person,data,filters,close}) {
  const ms=data.movimientos.filter(m=>m.estado!=="Anulado"&&m.persona_id===person.persona_id&&(!filters.mes||m.periodo_descuento===filters.mes)&&(!filters.tipo||m.tipo===filters.tipo)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <div className="detail-modal" role="dialog" aria-modal="true">
      <div className="detail-title"><div><span>DETALLE</span><h2>{person.nombre}</h2><p>{person.empresa} · {person.rut||"Sin RUT"}</p></div><button autoFocus onClick={close} aria-label="Cerrar">×</button></div>
      <div className="detail-total"><span>Total del período</span><strong>{money(ms.reduce((a,m)=>a+Number(m.monto),0))}</strong></div>
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Medio</th><th>Cuota</th><th>Monto</th></tr></thead>
      <tbody>{ms.map(m=><tr key={m.movimiento_id}><td>{m.fecha}</td><td><span className={`type-chip ${typeClass(m.tipo)}`}>{labelType(m.tipo)}</span></td><td>{m.concepto}</td><td>{m.medio_pago||"—"}</td><td>{m.cuota_actual?`${m.cuota_actual}/${m.cuotas_total}`:"—"}</td><td><strong>{money(m.monto)}</strong></td></tr>)}</tbody></table></div>
    </div>
  </div>
}
