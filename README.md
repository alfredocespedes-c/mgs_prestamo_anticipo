# Cuenta Corriente Local v0.2.1

## Local
`npm install` y luego `npm run dev`.
Frontend: http://127.0.0.1:5173
API: http://127.0.0.1:3001

## GitHub Pages
Incluye `.github/workflows/deploy-pages.yml`.
En GitHub: Settings > Pages > Source > GitHub Actions.

Al hacer push a `main` se compila y publica automáticamente.

IMPORTANTE: GitHub Pages no ejecuta Node/Express ni escribe los CSV. En local se usa Node + CSV; en Pages la demo usa localStorage del navegador.
