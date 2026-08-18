# Sistema Préstamos/Anticipo v0.3.1

## Navegación
- Nuevo movimiento
- Personal
- Administración

## Ejecutar localmente
```bash
npm install
npm run dev
```

Abrir `http://127.0.0.1:5173`.

En local, React consume Node/Express en `127.0.0.1:3001` y Node escribe los CSV de `data/`.

## GitHub Pages
La versión incluye `.github/workflows/deploy-pages.yml` y el script:

```bash
npm run build:pages
```

En GitHub: **Settings → Pages → Source → GitHub Actions**. Cada push a `main` compila y publica la interfaz.

### Modo Pages
GitHub Pages no ejecuta Node. Para que la maqueta siga siendo funcional, cuando detecta `github.io` utiliza `localStorage` del navegador. Esto es solo para demo. La arquitectura definitiva mantendrá los datos reales en el PC local mediante el servicio Node.

## Correcciones v0.3.1
- Agregado `build:pages` al `package.json`.
- `vite.config.js` preparado para rutas relativas de GitHub Pages.
- Workflow alineado con `npm run build:pages`.
- Eliminado `cache: npm` para no depender de un `package-lock.json` previo.
- Modo GitHub Pages funcional sin llamadas fallidas a `/api`.
- Modo local mantiene Node + CSV.
