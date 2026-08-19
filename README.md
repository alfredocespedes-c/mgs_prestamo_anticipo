# Sistema Préstamos/Anticipo v0.5.0

## Arquitectura
- React + Vite
- Node.js + Express local
- CSV locales
- GitHub Pages compatible mediante localStorage
- Sin PostgreSQL/MySQL

## Modelo
- personas.csv
- movimientos.csv
- prestamos.csv
- auditoria.csv

## Funcionalidades v0.5.0
### Personal
- Página inicial.
- Filtro por mes, persona y tipo.
- Total mensual separado de deuda pendiente de préstamos.
- Detalle por persona.
- Generar Excel.
- Imprimir PDF global o individual.
- PDF individual con préstamos vigentes y saldo pendiente.

### Nuevo movimiento
Dos modalidades:
1. Por persona
   - Anticipo
   - Descuento
   - Préstamo nuevo
   - Cuota préstamo
2. Por tipo de movimiento
   - Carga masiva por concepto (ej. Casino)
   - Monto por persona
   - Total y cantidad antes de guardar

### Administración
- Crear persona.
- Editar persona.
- Desactivar persona.
- Si tiene crédito activo con saldo pendiente, la desactivación se bloquea y muestra el detalle del crédito.
- Si no tiene crédito pendiente, solicita confirmación y desactiva sin borrar historial.

## Ejecutar localmente
```bash
npm install
npm run dev
```

Abrir:
http://127.0.0.1:5173

API:
http://127.0.0.1:3001

## GitHub Pages
Settings → Pages → Source → GitHub Actions.

Luego:
```bash
git add .
git commit -m "v0.5.0"
git push
```

## Nota
GitHub Pages no ejecuta Node.js. En Pages la demo usa localStorage.
En la versión local, Node.js lee y escribe los CSV reales.
