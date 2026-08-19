import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app=express();
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const DATA=path.join(ROOT,"data");
app.use(cors());
app.use(express.json());

const files={
  personas:path.join(DATA,"personas.csv"),
  movimientos:path.join(DATA,"movimientos.csv"),
  prestamos:path.join(DATA,"prestamos.csv"),
  auditoria:path.join(DATA,"auditoria.csv")
};

function parse(text){
  if(!text.trim()) return [];
  const lines=text.trim().split(/\r?\n/), h=lines.shift().split(";");
  return lines.filter(Boolean).map(line=>{
    const vals=[]; let cell="",quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i],nx=line[i+1];
      if(ch==='"'&&quoted&&nx==='"'){cell+='"';i++;continue}
      if(ch==='"'){quoted=!quoted;continue}
      if(ch===';'&&!quoted){vals.push(cell);cell="";continue}
      cell+=ch;
    }
    vals.push(cell);
    return Object.fromEntries(h.map((k,i)=>[k,vals[i]??""]));
  });
}
function q(v){const s=String(v??"");return /[;"\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s}
function csv(rows){
  if(!rows.length)return"";
  const h=Object.keys(rows[0]);
  return[h.join(";"),...rows.map(r=>h.map(k=>q(r[k])).join(";"))].join("\r\n")+"\r\n";
}
async function read(name){return parse(await fs.readFile(files[name],"utf8"))}
async function write(name,rows){await fs.writeFile(files[name],csv(rows),"utf8")}
async function audit(accion,entidad,id,detalle){
  const rows=await read("auditoria");
  rows.push({auditoria_id:"A"+Date.now()+Math.floor(Math.random()*1000),fecha_hora:new Date().toISOString(),usuario:"local",accion,entidad,entidad_id:id,detalle});
  await write("auditoria",rows);
}

app.get("/api/bootstrap",async(_q,r)=>{
  r.json({personas:await read("personas"),movimientos:await read("movimientos"),prestamos:await read("prestamos"),auditoria:await read("auditoria")});
});

app.post("/api/personas",async(qr,r)=>{
  const rows=await read("personas");
  const x={persona_id:"P"+Date.now(),rut:qr.body.rut||"",nombre:qr.body.nombre||"",empresa:qr.body.empresa||"",estado:"Activo",fecha_alta:new Date().toISOString().slice(0,10),fecha_modificacion:new Date().toISOString().slice(0,10)};
  if(!x.nombre.trim())return r.status(400).json({error:"El nombre es obligatorio."});
  rows.push(x);await write("personas",rows);await audit("CREAR_PERSONA","persona",x.persona_id,x.nombre);r.status(201).json(x);
});

app.put("/api/personas/:id",async(qr,r)=>{
  const rows=await read("personas"),p=rows.find(x=>x.persona_id===qr.params.id);
  if(!p)return r.status(404).json({error:"Persona no encontrada."});
  p.nombre=qr.body.nombre||p.nombre;p.rut=qr.body.rut||"";p.empresa=qr.body.empresa||"";p.fecha_modificacion=new Date().toISOString().slice(0,10);
  await write("personas",rows);await audit("EDITAR_PERSONA","persona",p.persona_id,p.nombre);r.json(p);
});

app.patch("/api/personas/:id/desactivar",async(qr,r)=>{
  const people=await read("personas"),p=people.find(x=>x.persona_id===qr.params.id);
  if(!p)return r.status(404).json({error:"Persona no encontrada."});
  const loans=(await read("prestamos")).filter(l=>l.persona_id===p.persona_id&&l.estado==="Activo"&&Number(l.saldo_pendiente)>0);
  if(loans.length)return r.status(409).json({error:"Esta persona tiene un crédito pendiente.",code:"CREDITO_PENDIENTE",loans});
  p.estado="Inactivo";p.fecha_modificacion=new Date().toISOString().slice(0,10);
  await write("personas",people);await audit("DESACTIVAR_PERSONA","persona",p.persona_id,p.nombre);r.json(p);
});

app.post("/api/movimientos",async(qr,r)=>{
  const rows=await read("movimientos"),fecha=qr.body.fecha||new Date().toISOString().slice(0,10);
  const x={movimiento_id:"M"+Date.now(),persona_id:qr.body.persona_id,fecha,periodo:fecha.slice(0,7),tipo:qr.body.tipo,concepto:qr.body.concepto,monto:String(Number(qr.body.monto||0)),medio_pago:qr.body.medio_pago||"",prestamo_id:qr.body.prestamo_id||"",observacion:qr.body.observacion||"",estado:"Vigente",creado_en:new Date().toISOString()};
  if(!x.persona_id||!x.concepto||Number(x.monto)<=0)return r.status(400).json({error:"Revisa persona, concepto y monto."});
  rows.push(x);await write("movimientos",rows);await audit("CREAR_MOVIMIENTO","movimiento",x.movimiento_id,x.concepto);r.status(201).json(x);
});

app.post("/api/movimientos/bulk",async(qr,r)=>{
  const rows=await read("movimientos"),fecha=qr.body.fecha||new Date().toISOString().slice(0,10),created=[];
  for(const [i,it] of (qr.body.items||[]).entries()){
    if(Number(it.monto)<=0)continue;
    const x={movimiento_id:"M"+Date.now()+i,persona_id:it.persona_id,fecha,periodo:fecha.slice(0,7),tipo:qr.body.tipo,concepto:qr.body.concepto,monto:String(Number(it.monto)),medio_pago:qr.body.medio_pago||"",prestamo_id:"",observacion:qr.body.observacion||"",estado:"Vigente",creado_en:new Date().toISOString()};
    rows.push(x);created.push(x);
  }
  await write("movimientos",rows);await audit("CREAR_MOVIMIENTOS_MASIVOS","movimiento","BULK",`${created.length} movimientos`);r.status(201).json(created);
});

app.post("/api/prestamos",async(qr,r)=>{
  const rows=await read("prestamos"),monto=Number(qr.body.monto_original||0),cuotas=Number(qr.body.numero_cuotas||0),valor=Number(qr.body.valor_cuota||0)||(cuotas?Math.round(monto/cuotas):0);
  const x={prestamo_id:"PR"+Date.now(),persona_id:qr.body.persona_id,fecha_inicio:qr.body.fecha_inicio,concepto:qr.body.concepto,monto_original:String(monto),numero_cuotas:String(cuotas),valor_cuota:String(valor),cuotas_pagadas:"0",saldo_pendiente:String(monto),primer_periodo:qr.body.primer_periodo||qr.body.fecha_inicio.slice(0,7),estado:"Activo",observacion:qr.body.observacion||"",creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString()};
  if(!x.persona_id||!x.concepto||monto<=0||cuotas<=0)return r.status(400).json({error:"Revisa persona, concepto, monto y cuotas."});
  rows.push(x);await write("prestamos",rows);await audit("CREAR_PRESTAMO","prestamo",x.prestamo_id,x.concepto);r.status(201).json(x);
});

app.post("/api/prestamos/:id/cuota",async(qr,r)=>{
  const loans=await read("prestamos"),loan=loans.find(x=>x.prestamo_id===qr.params.id);
  if(!loan)return r.status(404).json({error:"Préstamo no encontrado."});
  const pago=Math.min(Number(qr.body.monto||loan.valor_cuota),Number(loan.saldo_pendiente)),nuevaCuota=Number(loan.cuotas_pagadas)+1;
  loan.cuotas_pagadas=String(nuevaCuota);loan.saldo_pendiente=String(Math.max(0,Number(loan.saldo_pendiente)-pago));loan.estado=Number(loan.saldo_pendiente)<=0?"Pagado":"Activo";loan.actualizado_en=new Date().toISOString();
  await write("prestamos",loans);

  const movimientos=await read("movimientos"),fecha=qr.body.fecha||new Date().toISOString().slice(0,10);
  const mov={movimiento_id:"M"+Date.now(),persona_id:loan.persona_id,fecha,periodo:fecha.slice(0,7),tipo:"CuotaPrestamo",concepto:`${loan.concepto} cuota ${nuevaCuota}/${loan.numero_cuotas}`,monto:String(pago),medio_pago:qr.body.medio_pago||"",prestamo_id:loan.prestamo_id,observacion:qr.body.observacion||"",estado:"Vigente",creado_en:new Date().toISOString()};
  movimientos.push(mov);await write("movimientos",movimientos);await audit("PAGAR_CUOTA","prestamo",loan.prestamo_id,mov.concepto);r.status(201).json({prestamo:loan,movimiento:mov});
});

app.listen(3001,"127.0.0.1",()=>console.log("Sistema Prestamos/Anticipo API: http://127.0.0.1:3001"));
