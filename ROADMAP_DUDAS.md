# Dudas del roadmap — resueltas

| # | Decisión | Estado |
|---|----------|--------|
| 1 | Ownership: `owned_elsewhere` solo si mazos ≥ quantity | Hecho |
| 2 | Cachear top 20 EDHREC al demandar | Hecho |
| 3 | Sustitutos por roles | Confirmado |
| 4 | Precios EUR/USD Scryfall | Hecho |
| 5 | Comparador roles/% owned | Hecho (criterio por defecto) |
| 6 | Métricas removal/amenaza + screw/flood | Hecho |
| 7 | Quick Build fullscreen | Hecho |
| 8 | Empaquetado .exe | **Hecho** — NSIS + portable; colección al lado del exe |
| 9 | Build offline + colección | **Hecho** — `electron/localServer.cjs` |
| 10 | Staples oportunidades | Hecho |

---

## Empaquetado (referencia rápida)

```bash
cd app
npm run dist
```

Artefactos en `app/release/`. Copia `coleccion_organizada/` junto al `.exe`.  
Variable opcional: `MANA_BINDER_COLLECTION=C:\ruta\coleccion_organizada`.
