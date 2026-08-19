import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const money = n => new Intl.NumberFormat("es-CL", {
  style: "currency", currency: "CLP", maximumFractionDigits: 0
}).format(Number(n) || 0);

const today = new Date().toISOString().slice(0,10);
const IS_PAGES = window.location.hostname.endsWith("github.io");
const LS_KEY = "sistema-prestamos-anticipo-v050";

const seed = {
  personas: [
    {persona_id:"P001",rut:"13.066.599-3",nombre:"Paulina Acuña Campos",empresa:"MGS Repuestos",estado:"Activo",fecha_alta:"2026-08-01",fecha_modificacion:"2026-08-01"},
    {persona_id:"P002",rut:"",nombre:"Mauricio Alvear Alfaro",empresa:"MGS Repuestos",estado:"Activo",fecha_alta:"2026-08-01",fecha_modificacion:"2026-08-01"},
    {persona_id:"P003",rut:"",nombre:"Luis Alarcon Gutierrez",empresa:"MGS Repuestos",estado:"Activo",fecha_alta:"2026-08-01",fecha_modificacion:"2026-08-01"},
    {persona_id:"P004",rut:"",nombre:"Cesar Gonzalez Lopez",empresa:"Floma SPA",estado:"Activo",fecha_alta:"2026-08-01",fecha_modificacion:"2026-08-01"}
  ],
  movimientos: [
    {movimiento_id:"M001",persona_id:"P001",fecha:"2026-08-03",periodo:"2026-08",tipo:"Anticipo",concepto:"Anticipo sueldo",monto:"400000",medio_pago:"Transferencia",prestamo_id:"",observacion:"",estado:"Vigente",creado_en:"2026-08-03T10:00:00"},
    {movimiento_id:"M002",persona_id:"P001",fecha:"2026-08-04",periodo:"2026-08",tipo:"Anticipo",concepto:"Anticipo sueldo ayuda",monto:"150000",medio_pago:"Transferencia",prestamo_id:"",observacion:"Ayuda",estado:"Vigente",creado_en:"2026-08-04T09:00:00"},
    {movimiento_id:"M003",persona_id:"P001",fecha:"2026-08-17",periodo:"2026-08",tipo:"Descuento",concepto:"Seguro MetLife",monto:"16547",medio_pago:"",prestamo_id:"",observacion:"",estado:"Vigente",creado_en:"2026-08-17T09:00:00"},
    {movimiento_id:"M004",persona_id:"P002",fecha:"2026-08-12",periodo:"2026-08",tipo:"Anticipo",concepto:"Anticipo sueldo",monto:"530000",medio_pago:"Transferencia",prestamo_id:"",observacion:"",estado:"Vigente",creado_en:"2026-08-12T09:00:00"},
    {movimiento_id:"M005",persona_id:"P004",fecha:"2026-08-03",periodo:"2026-08",tipo:"Anticipo",concepto:"Anticipo sueldo",monto:"850000",medio_pago:"Transferencia",prestamo_id:"",observacion:"",estado:"Vigente",creado_en:"2026-08-03T09:00:00"},
    {movimiento_id:"M006",persona_id:"P001",fecha:"2026-08-31",periodo:"2026-08",tipo:"CuotaPrestamo",concepto:"Préstamo empresa cuota 4/12",monto:"100000",medio_pago:"",prestamo_id:"PR001",observacion:"",estado:"Vigente",creado_en:"2026-08-31T09:00:00"}
  ],
  prestamos: [
    {prestamo_id:"PR001",persona_id:"P001",fecha_inicio:"2026-05-01",concepto:"Préstamo empresa",monto_original:"1200000",numero_cuotas:"12",valor_cuota:"100000",cuotas_pagadas:"4",saldo_pendiente:"800000",primer_periodo:"2026-05",estado:"Activo",observacion:"",creado_en:"2026-05-01T09:00:00",actualizado_en:"2026-08-31T09:00:00"}
  ],
  auditoria: []
};

function pageData(){
  if(!localStorage.getItem(LS_KEY)) localStorage.setItem(LS_KEY, JSON.stringify(seed));
  return JSON.parse(localStorage.getItem(LS_KEY));
}
function savePageData(d){ localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function auditLocal(d, accion, entidad, entidadId, detalle){
  d.auditoria.push({
    auditoria_id:"A"+Date.now()+Math.floor(Math.random()*1000),
    fecha_hora:new Date().toISOString(), usuario:"pages-local",
    accion, entidad, entidad_id:entidadId, detalle
  });
}

async function api(url, options={}) {
  if (!IS_PAGES) {
    const r = await fetch(url, options);
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || "No se pudo completar la operación.");
    return data;
  }

  const d = pageData();
  const method = options.method || "GET";
  const body = options.body ? JSON.parse(options.body) : {};

  if (url === "/api/bootstrap") return d;

  if (url === "/api/personas" && method === "POST") {
    const item={persona_id:"P"+Date.now(),rut:body.rut||"",nombre:body.nombre||"",empresa:body.empresa||"",estado:"Activo",fecha_alta:today,fecha_modificacion:today};
    d.personas.push(item); auditLocal(d,"CREAR_PERSONA","persona",item.persona_id,item.nombre); savePageData(d); return item;
  }

  const editMatch=url.match(/^\/api\/personas\/(.+)$/);
  if(editMatch && method==="PUT"){
    const p=d.personas.find(x=>x.persona_id===editMatch[1]);
    if(!p) throw new Error("Persona no encontrada.");
    Object.assign(p,{rut:body.rut||"",nombre:body.nombre||"",empresa:body.empresa||"",fecha_modificacion:today});
    auditLocal(d,"EDITAR_PERSONA","persona",p.persona_id,p.nombre); savePageData(d); return p;
  }

  const deactivateMatch=url.match(/^\/api\/personas\/(.+)\/desactivar$/);
  if(deactivateMatch && method==="PATCH"){
    const p=d.personas.find(x=>x.persona_id===deactivateMatch[1]);
    const activeLoans=d.prestamos.filter(x=>x.persona_id===p.persona_id && x.estado==="Activo" && Number(x.saldo_pendiente)>0);
    if(activeLoans.length){
      const err=new Error("Esta persona tiene un crédito pendiente.");
      err.code="CREDITO_PENDIENTE"; err.loans=activeLoans; throw err;
    }
    p.estado="Inactivo"; p.fecha_modificacion=today;
    auditLocal(d,"DESACTIVAR_PERSONA","persona",p.persona_id,p.nombre); savePageData(d); return p;
  }

  if(url==="/api/movimientos" && method==="POST"){
    const item={...body,movimiento_id:"M"+Date.now(),periodo:body.fecha.slice(0,7),estado:"Vigente",creado_en:new Date().toISOString()};
    d.movimientos.push(item); auditLocal(d,"CREAR_MOVIMIENTO","movimiento",item.movimiento_id,item.concepto); savePageData(d); return item;
  }

  if(url==="/api/movimientos/bulk" && method==="POST"){
    const created=[];
    (body.items||[]).forEach((it,i)=>{
      if(Number(it.monto)<=0) return;
      const item={
        movimiento_id:"M"+Date.now()+i,persona_id:it.persona_id,fecha:body.fecha,periodo:body.fecha.slice(0,7),
        tipo:body.tipo,concepto:body.concepto,monto:String(Number(it.monto)),medio_pago:body.medio_pago||"",
        prestamo_id:"",observacion:body.observacion||"",estado:"Vigente",creado_en:new Date().toISOString()
      };
      d.movimientos.push(item); created.push(item);
    });
    auditLocal(d,"CREAR_MOVIMIENTOS_MASIVOS","movimiento","BULK",`${created.length} movimientos`);
    savePageData(d); return created;
  }

  if(url==="/api/prestamos" && method==="POST"){
    const monto=Number(body.monto_original||0), cuotas=Number(body.numero_cuotas||0);
    const valor=Number(body.valor_cuota||0) || (cuotas ? Math.round(monto/cuotas) : 0);
    const item={
      prestamo_id:"PR"+Date.now(),persona_id:body.persona_id,fecha_inicio:body.fecha_inicio,
      concepto:body.concepto,monto_original:String(monto),numero_cuotas:String(cuotas),valor_cuota:String(valor),
      cuotas_pagadas:"0",saldo_pendiente:String(monto),primer_periodo:body.primer_periodo||body.fecha_inicio.slice(0,7),
      estado:"Activo",observacion:body.observacion||"",creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString()
    };
    d.prestamos.push(item); auditLocal(d,"CREAR_PRESTAMO","prestamo",item.prestamo_id,item.concepto); savePageData(d); return item;
  }

  const cuotaMatch=url.match(/^\/api\/prestamos\/(.+)\/cuota$/);
  if(cuotaMatch && method==="POST"){
    const loan=d.prestamos.find(x=>x.prestamo_id===cuotaMatch[1]);
    if(!loan) throw new Error("Préstamo no encontrado.");
    const pago=Math.min(Number(body.monto||loan.valor_cuota),Number(loan.saldo_pendiente));
    const nuevaCuota=Number(loan.cuotas_pagadas)+1;
    loan.cuotas_pagadas=String(nuevaCuota);
    loan.saldo_pendiente=String(Math.max(0,Number(loan.saldo_pendiente)-pago));
    loan.estado=Number(loan.saldo_pendiente)<=0 ? "Pagado" : "Activo";
    loan.actualizado_en=new Date().toISOString();
    const mov={
      movimiento_id:"M"+Date.now(),persona_id:loan.persona_id,fecha:body.fecha,periodo:body.fecha.slice(0,7),
      tipo:"CuotaPrestamo",concepto:`${loan.concepto} cuota ${nuevaCuota}/${loan.numero_cuotas}`,monto:String(pago),
      medio_pago:body.medio_pago||"",prestamo_id:loan.prestamo_id,observacion:body.observacion||"",
      estado:"Vigente",creado_en:new Date().toISOString()
    };
    d.movimientos.push(mov); auditLocal(d,"PAGAR_CUOTA","prestamo",loan.prestamo_id,mov.concepto); savePageData(d); return {prestamo:loan,movimiento:mov};
  }

  throw new Error("Operación no disponible.");
}

const typeLabel=t=>({
  Anticipo:"Anticipo", Descuento:"Descuento", CuotaPrestamo:"Cuota préstamo", PrestamoNuevo:"Préstamo nuevo"
}[t]||t);
const typeClass=t=>t==="Anticipo"?"advance":t==="Descuento"?"discount":t==="CuotaPrestamo"?"loan":"newloan";

function safeSheetName(name){return String(name||"Persona").replace(/[\\/?*\[\]:]/g," ").trim().slice(0,31)||"Persona"}
function fitSheet(ws){
  if(!ws["!ref"]) return;
  const range=XLSX.utils.decode_range(ws["!ref"]), cols=[];
  for(let c=range.s.c;c<=range.e.c;c++){
    let max=10;
    for(let r=range.s.r;r<=range.e.r;r++){
      const cell=ws[XLSX.utils.encode_cell({r,c})], val=cell?.v==null?"":String(cell.v);
      max=Math.max(max,Math.min(val.length+2,35));
    }
    cols.push({wch:max});
  }
  ws["!cols"]=cols;
}

function buildPdfTitle(doc,title,subtitle){
  doc.setFontSize(17); doc.text("Sistema Préstamos/Anticipo",14,16);
  doc.setFontSize(12); doc.text(title,14,25);
  doc.setFontSize(9); doc.setTextColor(90); doc.text(subtitle,14,31);
  doc.setTextColor(0);
}

function personPdf(person,movements,loans,period){
  const doc=new jsPDF();
  buildPdfTitle(doc,person.nombre,`${person.rut||"Sin RUT"} · ${person.empresa||""} · Período ${period||"Todos"}`);
  const total=movements.reduce((a,m)=>a+Number(m.monto),0);
  doc.setFontSize(11); doc.text(`Total del período: ${money(total)}`,14,40);

  autoTable(doc,{
    startY:46,
    head:[["Fecha","Tipo","Concepto","Monto"]],
    body:movements.map(m=>[m.fecha,typeLabel(m.tipo),m.concepto,money(m.monto)]),
    styles:{fontSize:8}
  });

  let y=(doc.lastAutoTable?.finalY||55)+10;
  doc.setFontSize(11); doc.text("Préstamos vigentes",14,y);
  const active=loans.filter(l=>l.estado==="Activo"&&Number(l.saldo_pendiente)>0);
  if(active.length){
    autoTable(doc,{
      startY:y+5,
      head:[["Crédito","Cuota","Monto original","Saldo pendiente"]],
      body:active.map(l=>[
        l.concepto,
        `${l.cuotas_pagadas}/${l.numero_cuotas}`,
        money(l.monto_original),
        money(l.saldo_pendiente)
      ]),
      styles:{fontSize:8}
    });
  } else {
    doc.setFontSize(9); doc.text("Sin préstamos vigentes.",14,y+7);
  }
  doc.save(`reporte_${safeSheetName(person.nombre).replaceAll(" ","_")}_${period||"todos"}.pdf`);
}

function globalPdf(summary,period){
  const doc=new jsPDF();
  buildPdfTitle(doc,"Resumen general",`Período ${period||"Todos"}`);
  autoTable(doc,{
    startY:38,
    head:[["Persona","Anticipos","Cuotas préstamo","Descuentos","Total mes","Deuda préstamos"]],
    body:summary.map(r=>[
      r.nombre,money(r.anticipos),money(r.cuotas),money(r.descuentos),money(r.total),money(r.deuda)
    ]),
    styles:{fontSize:7}
  });
  const total=summary.reduce((a,r)=>a+r.total,0);
  const deuda=summary.reduce((a,r)=>a+r.deuda,0);
  let y=(doc.lastAutoTable?.finalY||45)+10;
  doc.setFontSize(10);
  doc.text(`Total del período: ${money(total)}`,14,y);
  doc.text(`Deuda total de préstamos vigentes: ${money(deuda)}`,14,y+6);
  doc.save(`reporte_general_${period||"todos"}.pdf`);
}

export default function App(){
  const [data,setData]=useState({personas:[],movimientos:[],prestamos:[],auditoria:[]});
  const [view,setView]=useState("personal");
  const [filters,setFilters]=useState({mes:"2026-08",persona:"",tipo:""});
  const [detailPerson,setDetailPerson]=useState(null);
  const [toast,setToast]=useState("");

  const refresh=async()=>setData(await api("/api/bootstrap"));
  useEffect(()=>{refresh().catch(e=>showToast(e.message))},[]);
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2800)};

  return <div className="app-shell">
    <header className="header">
      <div className="eyebrow">GESTIÓN LOCAL DE PERSONAL</div>
      <h1>Sistema Préstamos/Anticipo</h1>
      <nav className="top-nav">
        <button className={view==="personal"?"active":""} onClick={()=>setView("personal")}>Personal</button>
        <button className={view==="movimiento"?"active":""} onClick={()=>setView("movimiento")}>Nuevo movimiento</button>
        <button className={view==="admin"?"active":""} onClick={()=>setView("admin")}>Administración</button>
      </nav>
      <div className="version-mark">v0.5.0</div>
    </header>

    <main>
      {view==="personal" && <PersonalView data={data} filters={filters} setFilters={setFilters} onDetail={setDetailPerson}/>}
      {view==="movimiento" && <MovementView data={data} done={async()=>{await refresh();showToast("Información registrada.");setView("personal")}}/>}
      {view==="admin" && <Administration data={data} refresh={refresh} notify={showToast}/>}
    </main>

    {detailPerson && <DetailModal person={detailPerson} data={data} filters={filters} close={()=>setDetailPerson(null)}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function PersonalView({data,filters,setFilters,onDetail}){
  const peopleMap=Object.fromEntries(data.personas.map(p=>[p.persona_id,p]));
  const valid=data.movimientos.filter(m=>
    m.estado!=="Anulado" &&
    (!filters.mes || m.periodo===filters.mes) &&
    (!filters.persona || m.persona_id===filters.persona) &&
    (!filters.tipo || m.tipo===filters.tipo)
  );

  const summary=data.personas.filter(p=>p.estado==="Activo"||valid.some(m=>m.persona_id===p.persona_id)).map(p=>{
    const ms=valid.filter(m=>m.persona_id===p.persona_id);
    const loans=data.prestamos.filter(l=>l.persona_id===p.persona_id&&l.estado==="Activo");
    return {
      ...p,count:ms.length,
      anticipos:ms.filter(m=>m.tipo==="Anticipo").reduce((a,m)=>a+Number(m.monto),0),
      cuotas:ms.filter(m=>m.tipo==="CuotaPrestamo").reduce((a,m)=>a+Number(m.monto),0),
      descuentos:ms.filter(m=>m.tipo==="Descuento").reduce((a,m)=>a+Number(m.monto),0),
      total:ms.reduce((a,m)=>a+Number(m.monto),0),
      deuda:loans.reduce((a,l)=>a+Number(l.saldo_pendiente),0)
    }
  }).filter(r=>r.count>0 || (filters.persona&&r.persona_id===filters.persona));

  const generateExcel=()=>{
    const wb=XLSX.utils.book_new();
    if(filters.persona){
      const p=peopleMap[filters.persona];
      const ms=valid.filter(m=>m.persona_id===p.persona_id);
      const loans=data.prestamos.filter(l=>l.persona_id===p.persona_id);
      const rows=[
        ["Sistema Préstamos/Anticipo"],
        ["Reporte individual"],
        ["Persona",p.nombre],["RUT",p.rut||""],["Empresa",p.empresa||""],["Período",filters.mes||"Todos"],[],
        ["MOVIMIENTOS"]
      ];
      const ws=XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.sheet_add_json(ws,ms.map(m=>({
        Fecha:m.fecha,Tipo:typeLabel(m.tipo),Concepto:m.concepto,Monto:Number(m.monto),"Medio pago":m.medio_pago||""
      })),{origin:"A9"});
      XLSX.utils.sheet_add_aoa(ws,[[],["PRÉSTAMOS"],["Concepto","Cuotas pagadas","Total cuotas","Monto original","Saldo pendiente"]],{origin:`A${12+ms.length}`});
      XLSX.utils.sheet_add_aoa(ws,loans.map(l=>[l.concepto,Number(l.cuotas_pagadas),Number(l.numero_cuotas),Number(l.monto_original),Number(l.saldo_pendiente)]),{origin:`A${15+ms.length}`});
      fitSheet(ws); XLSX.utils.book_append_sheet(wb,ws,safeSheetName(p.nombre));
      XLSX.writeFile(wb,`reporte_${safeSheetName(p.nombre).replaceAll(" ","_")}_${filters.mes||"todos"}.xlsx`);
      return;
    }

    const wsSummary=XLSX.utils.json_to_sheet(summary.map(r=>({
      Nombre:r.nombre,RUT:r.rut,Empresa:r.empresa,Anticipos:r.anticipos,
      "Cuotas préstamo":r.cuotas,Descuentos:r.descuentos,"Total mes":r.total,"Deuda préstamos":r.deuda
    })));
    fitSheet(wsSummary); XLSX.utils.book_append_sheet(wb,wsSummary,"Resumen");
    summary.forEach(r=>{
      const ms=valid.filter(m=>m.persona_id===r.persona_id);
      const ws=XLSX.utils.json_to_sheet(ms.map(m=>({
        Fecha:m.fecha,Tipo:typeLabel(m.tipo),Concepto:m.concepto,Monto:Number(m.monto),"Medio pago":m.medio_pago||""
      })));
      fitSheet(ws);
      let name=safeSheetName(r.nombre),unique=name,n=2;
      while(wb.SheetNames.includes(unique)) unique=safeSheetName(`${name.slice(0,26)} ${n++}`);
      XLSX.utils.book_append_sheet(wb,ws,unique);
    });
    XLSX.writeFile(wb,`reporte_personal_${filters.mes||"todos"}.xlsx`);
  };

  const printPdf=()=>{
    if(filters.persona){
      const p=peopleMap[filters.persona];
      const ms=valid.filter(m=>m.persona_id===p.persona_id);
      const loans=data.prestamos.filter(l=>l.persona_id===p.persona_id);
      personPdf(p,ms,loans,filters.mes);
    } else globalPdf(summary,filters.mes);
  };

  const total=valid.reduce((a,m)=>a+Number(m.monto),0);

  return <div className="page">
    <div className="filters">
      <div><label>Mes</label><input type="month" value={filters.mes} onChange={e=>setFilters({...filters,mes:e.target.value})}/></div>
      <div><label>Persona</label><select value={filters.persona} onChange={e=>setFilters({...filters,persona:e.target.value})}><option value="">Todas las personas</option>{data.personas.map(p=><option key={p.persona_id} value={p.persona_id}>{p.nombre}</option>)}</select></div>
      <div><label>Tipo</label><select value={filters.tipo} onChange={e=>setFilters({...filters,tipo:e.target.value})}><option value="">Todos</option><option value="Anticipo">Anticipo</option><option value="CuotaPrestamo">Cuota préstamo</option><option value="Descuento">Descuento</option></select></div>
      <div className="filter-actions"><button onClick={generateExcel}>Generar Excel</button><button className="pdf" onClick={printPdf}>Imprimir PDF</button></div>
    </div>

    <div className="month-total"><div><span>{filters.persona?"TOTAL PERSONA / FILTRO":"TOTAL DEL MES / FILTRO"}</span><strong>{money(total)}</strong></div></div>

    <section className="panel">
      <div className="panel-head"><div><h2>Personal</h2><p>Total del mes separado de deuda futura de préstamos.</p></div><span>{summary.length} persona(s)</span></div>
      <div className="table-wrap"><table><thead><tr><th>Persona</th><th>Empresa</th><th>Anticipos</th><th>Cuotas préstamo</th><th>Descuentos</th><th>Total mes</th><th>Deuda préstamos</th><th></th></tr></thead>
      <tbody>{summary.map(r=><tr key={r.persona_id} className="clickable" onClick={()=>onDetail(r)}>
        <td><b>{r.nombre}</b><small>{r.rut}</small></td><td>{r.empresa}</td>
        <td><span className="amount-pill advance">{money(r.anticipos)}</span></td>
        <td><span className="amount-pill loan">{money(r.cuotas)}</span></td>
        <td><span className="amount-pill discount">{money(r.descuentos)}</span></td>
        <td><strong>{money(r.total)}</strong></td><td><strong>{money(r.deuda)}</strong></td>
        <td><button className="detail-btn">Detalle</button></td>
      </tr>)}</tbody></table></div>
    </section>
  </div>
}

function MovementView({data,done}){
  const [mode,setMode]=useState("persona");
  return <div className="page narrow">
    <div className="subtabs"><button className={mode==="persona"?"active":""} onClick={()=>setMode("persona")}>Por persona</button><button className={mode==="tipo"?"active":""} onClick={()=>setMode("tipo")}>Por tipo de movimiento</button></div>
    {mode==="persona" ? <MovementByPerson data={data} done={done}/> : <MovementByType data={data} done={done}/>}
  </div>
}

function PersonSearch({people,value,onChoose}){
  const [query,setQuery]=useState(value||"");
  const [hasTyped,setHasTyped]=useState(false);
  const [active,setActive]=useState(0);
  useEffect(()=>{setQuery(value||"");setHasTyped(false)},[value]);
  const matches=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return [];
    return people.filter(p=>p.estado==="Activo"&&`${p.nombre} ${p.rut} ${p.empresa}`.toLowerCase().includes(q)).slice(0,8);
  },[people,query]);
  const choose=p=>{onChoose(p);setQuery(p.nombre);setHasTyped(false);setActive(0)};
  return <div className="autocomplete">
    <input
      name="persona_busqueda"
      autoComplete="new-password"
      value={query}
      placeholder="Empieza a escribir el nombre..."
      onChange={e=>{const v=e.target.value;setQuery(v);setHasTyped(v.trim().length>=1);onChoose(null);setActive(0)}}
      onKeyDown={e=>{
        if(!hasTyped||!matches.length)return;
        if(e.key==="ArrowDown"){e.preventDefault();setActive(i=>(i+1)%matches.length)}
        if(e.key==="ArrowUp"){e.preventDefault();setActive(i=>(i-1+matches.length)%matches.length)}
        if(e.key==="Enter"){e.preventDefault();choose(matches[active])}
        if(e.key==="Escape"){setHasTyped(false)}
      }}
    />
    {hasTyped && query.trim().length>=1 && <div className="suggestions">
      {matches.length?matches.map((p,i)=><button type="button" tabIndex={-1} key={p.persona_id} className={i===active?"selected":""} onMouseDown={e=>{e.preventDefault();choose(p)}}><b>{p.nombre}</b><small>{p.empresa}{p.rut?` · ${p.rut}`:""}</small></button>):<div className="no-result">No hay coincidencias</div>}
    </div>}
  </div>
}

function MovementByPerson({data,done}){
  const [person,setPerson]=useState(null);
  const [type,setType]=useState("Anticipo");
  const [f,setF]=useState({fecha:today,concepto:"",monto:"",medio_pago:"Transferencia",observacion:"",numero_cuotas:"",valor_cuota:"",primer_periodo:today.slice(0,7),prestamo_id:""});
  const loans=data.prestamos.filter(l=>person&&l.persona_id===person.persona_id&&l.estado==="Activo"&&Number(l.saldo_pendiente)>0);

  const submit=async e=>{
    e.preventDefault();
    if(!person) return alert("Selecciona una persona.");
    if(type==="PrestamoNuevo"){
      await api("/api/prestamos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        persona_id:person.persona_id,fecha_inicio:f.fecha,concepto:f.concepto,monto_original:f.monto,
        numero_cuotas:f.numero_cuotas,valor_cuota:f.valor_cuota,primer_periodo:f.primer_periodo,observacion:f.observacion
      })});
    } else if(type==="CuotaPrestamo"){
      if(!f.prestamo_id) return alert("Selecciona un préstamo.");
      await api(`/api/prestamos/${f.prestamo_id}/cuota`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fecha:f.fecha,monto:f.monto,medio_pago:f.medio_pago,observacion:f.observacion})});
    } else {
      await api("/api/movimientos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        persona_id:person.persona_id,fecha:f.fecha,tipo:type,concepto:f.concepto,monto:f.monto,
        medio_pago:f.medio_pago,prestamo_id:"",observacion:f.observacion
      })});
    }
    await done();
  };

  const selectedLoan=loans.find(l=>l.prestamo_id===f.prestamo_id);
  useEffect(()=>{
    if(type==="CuotaPrestamo"&&selectedLoan){
      setF(x=>({...x,monto:selectedLoan.valor_cuota,concepto:selectedLoan.concepto}));
    }
  },[type,f.prestamo_id]);

  return <form className="movement-form" onSubmit={submit}>
    <div className="section-head"><h2>Nuevo movimiento por persona</h2><p>Busca a la persona y registra el movimiento.</p></div>
    <div className="form-row full"><label>Persona</label><PersonSearch people={data.personas} value={person?.nombre||""} onChoose={setPerson}/></div>
    <div className="form-grid">
      <Field label="Fecha"><input type="date" value={f.fecha} onChange={e=>setF({...f,fecha:e.target.value})}/></Field>
      <Field label="Tipo"><select value={type} onChange={e=>{setType(e.target.value);setF({...f,prestamo_id:"",concepto:"",monto:""})}}><option value="Anticipo">Anticipo</option><option value="Descuento">Descuento</option><option value="PrestamoNuevo">Préstamo nuevo</option><option value="CuotaPrestamo">Cuota préstamo</option></select></Field>

      {type==="CuotaPrestamo" ? <>
        <Field label="Préstamo"><select value={f.prestamo_id} onChange={e=>setF({...f,prestamo_id:e.target.value})}><option value="">Seleccionar préstamo</option>{loans.map(l=><option key={l.prestamo_id} value={l.prestamo_id}>{l.concepto} · saldo {money(l.saldo_pendiente)}</option>)}</select></Field>
        <Field label="Monto cuota"><input type="number" value={f.monto} onChange={e=>setF({...f,monto:e.target.value})}/></Field>
      </> : <>
        <Field label="Concepto"><input value={f.concepto} onChange={e=>setF({...f,concepto:e.target.value})} required/></Field>
        <Field label={type==="PrestamoNuevo"?"Monto total préstamo":"Monto"}><input type="number" min="1" value={f.monto} onChange={e=>setF({...f,monto:e.target.value})} required/></Field>
      </>}

      {type==="PrestamoNuevo" && <>
        <Field label="Número de cuotas"><input type="number" min="1" value={f.numero_cuotas} onChange={e=>setF({...f,numero_cuotas:e.target.value})} required/></Field>
        <Field label="Valor cuota"><input type="number" min="1" value={f.valor_cuota} onChange={e=>setF({...f,valor_cuota:e.target.value})} placeholder="Opcional: se calcula si queda vacío"/></Field>
        <Field label="Primera cuota"><input type="month" value={f.primer_periodo} onChange={e=>setF({...f,primer_periodo:e.target.value})}/></Field>
      </>}

      {type!=="PrestamoNuevo" && <Field label="Medio de pago"><select value={f.medio_pago} onChange={e=>setF({...f,medio_pago:e.target.value})}><option>Transferencia</option><option>Efectivo</option><option>Otro</option></select></Field>}
      <Field label="Observación"><input value={f.observacion} onChange={e=>setF({...f,observacion:e.target.value})}/></Field>
    </div>
    {type==="CuotaPrestamo"&&selectedLoan&&<div className="loan-summary"><b>{selectedLoan.concepto}</b><span>Cuota actual: {Number(selectedLoan.cuotas_pagadas)+1}/{selectedLoan.numero_cuotas}</span><span>Saldo pendiente: {money(selectedLoan.saldo_pendiente)}</span></div>}
    <button className="save-btn">Guardar</button>
  </form>
}

function MovementByType({data,done}){
  const activePeople=data.personas.filter(p=>p.estado==="Activo");
  const [f,setF]=useState({fecha:today,tipo:"Descuento",concepto:"Casino",medio_pago:"",observacion:""});
  const [amounts,setAmounts]=useState({});
  const [search,setSearch]=useState("");
  const people=activePeople.filter(p=>`${p.nombre} ${p.rut}`.toLowerCase().includes(search.toLowerCase()));
  const items=Object.entries(amounts).filter(([,v])=>Number(v)>0).map(([persona_id,monto])=>({persona_id,monto}));
  const total=items.reduce((a,x)=>a+Number(x.monto),0);

  const submit=async e=>{
    e.preventDefault();
    if(!items.length) return alert("Ingresa al menos un monto.");
    await api("/api/movimientos/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...f,items})});
    await done();
  };

  return <form className="movement-form wide" onSubmit={submit}>
    <div className="section-head"><h2>Nuevo movimiento por tipo</h2><p>Ideal para Casino, seguros u otros listados de varias personas.</p></div>
    <div className="form-grid">
      <Field label="Fecha"><input type="date" value={f.fecha} onChange={e=>setF({...f,fecha:e.target.value})}/></Field>
      <Field label="Tipo"><select value={f.tipo} onChange={e=>setF({...f,tipo:e.target.value})}><option value="Descuento">Descuento</option><option value="Anticipo">Anticipo</option></select></Field>
      <Field label="Concepto"><input value={f.concepto} onChange={e=>setF({...f,concepto:e.target.value})} required/></Field>
      <Field label="Medio de pago"><select value={f.medio_pago} onChange={e=>setF({...f,medio_pago:e.target.value})}><option value="">No aplica</option><option>Transferencia</option><option>Efectivo</option></select></Field>
    </div>
    <div className="bulk-toolbar"><input placeholder="Buscar persona..." value={search} onChange={e=>setSearch(e.target.value)}/><span>{items.length} con monto · Total {money(total)}</span></div>
    <div className="bulk-list">{people.map(p=><div key={p.persona_id}><span>{p.nombre}<small>{p.empresa}</small></span><input type="number" min="0" placeholder="$ 0" value={amounts[p.persona_id]||""} onChange={e=>setAmounts({...amounts,[p.persona_id]:e.target.value})}/></div>)}</div>
    <button className="save-btn">Guardar {items.length} movimiento(s)</button>
  </form>
}

function Administration({data,refresh,notify}){
  const [editing,setEditing]=useState(null);
  const [creditModal,setCreditModal]=useState(null);
  const [confirmDeactivate,setConfirmDeactivate]=useState(null);

  const deactivate=async p=>{
    const loans=data.prestamos.filter(l=>l.persona_id===p.persona_id&&l.estado==="Activo"&&Number(l.saldo_pendiente)>0);
    if(loans.length){setCreditModal({person:p,loans});return}
    setConfirmDeactivate(p);
  };

  const doDeactivate=async()=>{
    try{
      await api(`/api/personas/${confirmDeactivate.persona_id}/desactivar`,{method:"PATCH",headers:{"Content-Type":"application/json"}});
      setConfirmDeactivate(null); await refresh(); notify("Persona desactivada.");
    }catch(e){
      if(e.code==="CREDITO_PENDIENTE") setCreditModal({person:confirmDeactivate,loans:e.loans||[]});
      else notify(e.message);
    }
  };

  return <div className="page admin-grid">
    <PersonForm editing={editing} clear={()=>setEditing(null)} refresh={refresh} notify={notify}/>
    <section className="panel">
      <div className="panel-head"><div><h2>Personas registradas</h2><p>Editar o desactivar sin perder historial.</p></div><span>{data.personas.length}</span></div>
      <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>RUT</th><th>Empresa</th><th>Estado</th><th></th></tr></thead><tbody>{data.personas.map(p=><tr key={p.persona_id}><td><b>{p.nombre}</b></td><td>{p.rut||"—"}</td><td>{p.empresa||"—"}</td><td>{p.estado}</td><td><div className="row-actions"><button onClick={()=>setEditing(p)}>Editar</button>{p.estado==="Activo"&&<button className="danger" onClick={()=>deactivate(p)}>Desactivar</button>}</div></td></tr>)}</tbody></table></div>
    </section>

    {creditModal&&<Modal close={()=>setCreditModal(null)} title="Esta persona tiene un crédito pendiente">
      <p>No se puede desactivar a <b>{creditModal.person.nombre}</b> mientras tenga préstamos con saldo pendiente.</p>
      {creditModal.loans.map(l=><div className="credit-warning" key={l.prestamo_id}><b>{l.concepto}</b><span>Cuotas: {l.cuotas_pagadas}/{l.numero_cuotas}</span><span>Saldo pendiente: {money(l.saldo_pendiente)}</span></div>)}
      <div className="modal-actions"><button className="save-btn" onClick={()=>setCreditModal(null)}>Cerrar</button></div>
    </Modal>}

    {confirmDeactivate&&<Modal close={()=>setConfirmDeactivate(null)} title="Confirmar desactivación">
      <p>¿Deseas desactivar a <b>{confirmDeactivate.nombre}</b>?</p>
      <p>Dejará de aparecer para nuevos movimientos, pero se conservará todo su historial.</p>
      <div className="modal-actions"><button onClick={()=>setConfirmDeactivate(null)}>Cancelar</button><button className="danger solid" onClick={doDeactivate}>Desactivar</button></div>
    </Modal>}
  </div>
}

function PersonForm({editing,clear,refresh,notify}){
  const [f,setF]=useState({nombre:"",rut:"",empresa:""});
  useEffect(()=>{setF(editing?{nombre:editing.nombre,rut:editing.rut||"",empresa:editing.empresa||""}:{nombre:"",rut:"",empresa:""})},[editing]);
  const submit=async e=>{
    e.preventDefault();
    if(editing){
      await api(`/api/personas/${editing.persona_id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});
      notify("Persona actualizada.");
    } else {
      await api("/api/personas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});
      notify("Persona creada.");
    }
    setF({nombre:"",rut:"",empresa:""}); clear(); await refresh();
  };
  return <section className="panel admin-card">
    <div className="panel-head"><div><h2>{editing?"Editar persona":"Nueva persona"}</h2><p>{editing?"Corrige los datos sin alterar su historial.":"Agrega una persona al sistema."}</p></div></div>
    <form onSubmit={submit} className="admin-form">
      <Field label="Nombre completo"><input value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} required/></Field>
      <Field label="RUT"><input value={f.rut} onChange={e=>setF({...f,rut:e.target.value})}/></Field>
      <Field label="Empresa"><input value={f.empresa} onChange={e=>setF({...f,empresa:e.target.value})}/></Field>
      <div className="admin-buttons">{editing&&<button type="button" onClick={clear}>Cancelar</button>}<button className="save-btn">{editing?"Guardar cambios":"Crear persona"}</button></div>
    </form>
  </section>
}

function DetailModal({person,data,filters,close}){
  const ms=data.movimientos.filter(m=>m.estado!=="Anulado"&&m.persona_id===person.persona_id&&(!filters.mes||m.periodo===filters.mes)&&(!filters.tipo||m.tipo===filters.tipo)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const loans=data.prestamos.filter(l=>l.persona_id===person.persona_id&&l.estado==="Activo"&&Number(l.saldo_pendiente)>0);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <div className="detail-modal">
      <div className="detail-title"><div><span>DETALLE</span><h2>{person.nombre}</h2><p>{person.empresa} · {person.rut||"Sin RUT"}</p></div><div className="detail-actions"><button onClick={()=>personPdf(person,ms,loans,filters.mes)}>Imprimir PDF</button><button onClick={close}>×</button></div></div>
      <div className="detail-total"><span>Total del período</span><strong>{money(ms.reduce((a,m)=>a+Number(m.monto),0))}</strong></div>
      <div className="detail-section"><h3>Movimientos</h3><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Medio</th><th>Monto</th></tr></thead><tbody>{ms.map(m=><tr key={m.movimiento_id}><td>{m.fecha}</td><td><span className={`type-chip ${typeClass(m.tipo)}`}>{typeLabel(m.tipo)}</span></td><td>{m.concepto}</td><td>{m.medio_pago||"—"}</td><td><strong>{money(m.monto)}</strong></td></tr>)}</tbody></table></div></div>
      <div className="detail-section"><h3>Préstamos vigentes</h3>{loans.length?loans.map(l=><div className="loan-card" key={l.prestamo_id}><b>{l.concepto}</b><span>Monto original {money(l.monto_original)}</span><span>Cuota {l.cuotas_pagadas}/{l.numero_cuotas}</span><span>Valor cuota {money(l.valor_cuota)}</span><strong>Saldo pendiente {money(l.saldo_pendiente)}</strong></div>):<p className="muted">Sin préstamos vigentes.</p>}</div>
    </div>
  </div>
}

function Modal({title,close,children}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal small"><div className="detail-title"><h2>{title}</h2><button onClick={close}>×</button></div><div className="modal-body">{children}</div></div>}
function Field({label,children}){return <div className="form-row"><label>{label}</label>{children}</div>}
