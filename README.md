# Sistema Préstamos/Anticipo v0.4.1

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

## Ajuste v0.4.1
- El desplegable de búsqueda de personas no aparece al entrar al campo.
- Solo se muestra después de escribir al menos 1 carácter.
- Si se borra todo el texto, el listado desaparece automáticamente.
