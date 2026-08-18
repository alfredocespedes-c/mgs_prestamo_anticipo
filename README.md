# Sistema Préstamos/Anticipo v0.4

## Cambios principales
- Página inicial: Personal.
- Navegación: Personal → Nuevo movimiento → Administración.
- Autocompletado de persona al registrar movimiento.
  - Escribir filtra la lista.
  - Flecha arriba/abajo navega.
  - Enter selecciona.
  - Escape cierra.
- Flujo de teclado optimizado con Tab en el formulario.
- Reportes XLSX:
  - Con persona filtrada: detalle individual.
  - Sin persona: hoja Resumen + una hoja de detalle por cada persona del resultado.
  - Respeta mes y tipo de movimiento filtrados.
- Anticipo, Préstamo y Descuento mantienen colores distintos.
- GitHub Pages: usa localStorage.
- Local: usa Node.js + CSV.

## Por qué XLSX y no CSV para el reporte
CSV solo puede representar una tabla y no soporta múltiples hojas. XLSX permite crear una hoja Resumen y una hoja independiente por persona.

## Ejecutar local
```bash
npm install
npm run dev
```

Abrir http://127.0.0.1:5173

## GitHub Pages
Settings → Pages → Source → GitHub Actions.
Luego hacer push a main.

## Fix v0.4.2 — búsqueda de persona
- La lista NO se muestra al cargar la vista.
- La lista NO se muestra solo por hacer foco en el campo.
- Solo se renderiza cuando `query.trim().length >= 1`.
- Se eliminó el autofoco inicial del campo Persona.
- Se reforzó la prevención del autocompletado propio del navegador.
- Si se borra todo el texto, la lista desaparece inmediatamente.

## Fix v0.4.3 — desplegable Persona
Se agregó una segunda condición independiente (`hasTyped`).

La lista solo se crea cuando:
1. el usuario realmente escribió en el campo; y
2. existe al menos 1 carácter no vacío.

Al cargar Nuevo movimiento:
- `query = ""`
- `hasTyped = false`
- no existe lista en el DOM.

Al seleccionar una persona:
- se completa el nombre;
- `hasTyped` vuelve a `false`;
- la lista se cierra.

La interfaz muestra `v0.4.3` debajo de la navegación para comprobar que GitHub Pages publicó la versión correcta.
