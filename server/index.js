import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const csvFiles = {
  personas: path.join(DATA, "personas.csv"),
  movimientos: path.join(DATA, "movimientos.csv"),
  auditoria: path.join(DATA, "auditoria.csv")
};

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (ch === '"' && quoted && nx === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ";" && !quoted) { row.push(cell); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && nx === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(";"), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(";"))].join("\r\n") + "\r\n";
}

async function readTable(name) {
  return parseCSV(await fs.readFile(csvFiles[name], "utf8"));
}

async function writeTable(name, rows) {
  await fs.writeFile(csvFiles[name], toCSV(rows), "utf8");
}

async function audit(action, entity, entityId, detail) {
  const rows = await readTable("auditoria");
  rows.push({
    auditoria_id: "A" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
    fecha_hora: new Date().toISOString(),
    usuario: "local",
    accion: action,
    entidad: entity,
    entidad_id: entityId,
    detalle: detail
  });
  await writeTable("auditoria", rows);
}

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: "local-csv" }));

app.get("/api/bootstrap", async (_req, res) => {
  try {
    res.json({
      personas: await readTable("personas"),
      movimientos: await readTable("movimientos"),
      auditoria: await readTable("auditoria")
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/personas", async (req, res) => {
  try {
    const rows = await readTable("personas");
    const persona = {
      persona_id: "P" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
      rut: req.body.rut || "",
      nombre: req.body.nombre || "",
      empresa: req.body.empresa || "",
      estado: req.body.estado || "Activo",
      fecha_alta: req.body.fecha_alta || new Date().toISOString().slice(0, 10)
    };
    if (!persona.nombre.trim()) return res.status(400).json({ error: "El nombre es obligatorio." });
    rows.push(persona);
    await writeTable("personas", rows);
    await audit("CREACION", "persona", persona.persona_id, `Creación de ${persona.nombre}`);
    res.status(201).json(persona);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/movimientos", async (req, res) => {
  try {
    const rows = await readTable("movimientos");
    const fecha = req.body.fecha || new Date().toISOString().slice(0, 10);
    const monto = Number(req.body.monto || 0);
    if (!req.body.persona_id) return res.status(400).json({ error: "Debe seleccionar una persona." });
    if (!req.body.concepto?.trim()) return res.status(400).json({ error: "El concepto es obligatorio." });
    if (!(monto > 0)) return res.status(400).json({ error: "El monto debe ser mayor que cero." });

    const ts = new Date().toISOString();
    const movimiento = {
      movimiento_id: "M" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
      persona_id: req.body.persona_id,
      fecha,
      tipo: req.body.tipo || "Anticipo",
      concepto: req.body.concepto,
      monto: String(monto),
      medio_pago: req.body.medio_pago || "",
      cuota_actual: req.body.cuota_actual || "",
      cuotas_total: req.body.cuotas_total || "",
      periodo_descuento: fecha.slice(0, 7),
      observacion: req.body.observacion || "",
      estado: "Vigente",
      creado_en: ts,
      actualizado_en: ts
    };
    rows.push(movimiento);
    await writeTable("movimientos", rows);
    await audit("CREACION", "movimiento", movimiento.movimiento_id, `Nuevo movimiento ${movimiento.concepto} por ${monto}`);
    res.status(201).json(movimiento);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/movimientos/:id/anular", async (req, res) => {
  try {
    const rows = await readTable("movimientos");
    const item = rows.find(x => x.movimiento_id === req.params.id);
    if (!item) return res.status(404).json({ error: "Movimiento no encontrado." });
    item.estado = "Anulado";
    item.actualizado_en = new Date().toISOString();
    await writeTable("movimientos", rows);
    await audit("ANULACION", "movimiento", item.movimiento_id, `Movimiento anulado: ${item.concepto}`);
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/export/:table", async (req, res) => {
  try {
    const name = req.params.table;
    if (!csvFiles[name]) return res.status(404).end();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
    res.send(await fs.readFile(csvFiles[name], "utf8"));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Cuenta Corriente Local API: http://127.0.0.1:${PORT}`);
});