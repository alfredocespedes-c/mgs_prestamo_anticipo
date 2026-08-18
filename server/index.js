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

function parse(text){
  const lines=text.trim().split(/\r?\n/);
  if(!lines.length||!lines[0])return[];
  const h=lines.shift().split(";");
  return lines.filter(Boolean).map(line=>Object.fromEntries(line.split(";").map((v,i)=>[h[i],v])));
}
function csv(rows){
  if(!rows.length)return"";
  const h=Object.keys(rows[0]);
  const q=v=>{const s=String(v??"");return /[;"\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};
  return[h.join(";"),...rows.map(r=>h.map(k=>q(r[k])).join(";"))].join("\r\n")+"\r\n";
}
async function read(n){return parse(await fs.readFile(path.join(DATA,n+".csv"),"utf8"))}
async function write(n,rows){await fs.writeFile(path.join(DATA,n+".csv"),csv(rows),"utf8")}

app.get("/api/bootstrap",async(_q,r)=>r.json({personas:await read("personas"),movimientos:await read("movimientos")}));

app.post("/api/personas",async(q,r)=>{
  const rows=await read("personas");
  const x={persona_id:"P"+Date.now(),rut:q.body.rut||"",nombre:q.body.nombre||"",empresa:q.body.empresa||"",estado:"Activo",fecha_alta:new Date().toISOString().slice(0,10)};
  if(!x.nombre.trim())return r.status(400).json({error:"El nombre es obligatorio."});
  rows.push(x);await write("personas",rows);r.status(201).json(x);
});

app.post("/api/movimientos",async(q,r)=>{
  const rows=await read("movimientos"),fecha=q.body.fecha||new Date().toISOString().slice(0,10);
  const x={movimiento_id:"M"+Date.now(),persona_id:q.body.persona_id||"",fecha,tipo:q.body.tipo||"Anticipo",concepto:q.body.concepto||"",monto:String(Number(q.body.monto||0)),medio_pago:q.body.medio_pago||"",cuota_actual:q.body.cuota_actual||"",cuotas_total:q.body.cuotas_total||"",periodo_descuento:fecha.slice(0,7),observacion:q.body.observacion||"",estado:"Vigente"};
  if(!x.persona_id)return r.status(400).json({error:"Debe seleccionar una persona."});
  if(!x.concepto.trim())return r.status(400).json({error:"El concepto es obligatorio."});
  if(Number(x.monto)<=0)return r.status(400).json({error:"El monto debe ser mayor que cero."});
  rows.push(x);await write("movimientos",rows);r.status(201).json(x);
});

app.listen(3001,"127.0.0.1",()=>console.log("Sistema Prestamos/Anticipo API: http://127.0.0.1:3001"));
