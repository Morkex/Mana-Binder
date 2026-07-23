# Mana Binder

App de escritorio para gestionar tu colección de Magic: The Gathering y construir mazos Commander.

## Contenido del repo

| Ruta | Descripción |
|------|-------------|
| `app/` | App React + Vite + Electron |
| `scripts/` | Utilidades (normas, parches de cartas, etc.) |
| `rules/` | PDF de Comprehensive Rules |
| `coleccion_organizada/` | JSON maestro de la colección (sin imágenes) |
| `*.py` | Scripts para organizar y enriquecer la colección con Scryfall |

## Requisitos

- Node.js 20+
- Python 3.10+ (solo para actualizar la colección)
- Opcional: [Ollama](https://ollama.com) en local para el asistente IA del constructor

## Arranque rápido

```bash
cd app
npm install
npm run electron:dev
```

Solo navegador:

```bash
cd app
npm run dev
```

Abre http://localhost:5173

En Windows también puedes usar `app/Iniciar Mana Binder.bat`.

## Colección e imágenes

La app espera `coleccion_organizada/coleccion_maestra.json` y las imágenes en `coleccion_organizada/imagenes/`.

Las imágenes **no** se suben a Git (pesan varios GB). Tras clonar el repo:

1. Coloca tu export de ManaBox como `Colección .csv` en la raíz
2. Ejecuta:

```bash
python actualizar_coleccion.py
```

Eso regenera el JSON y descarga las imágenes desde Scryfall.

## Funciones principales

- **Colección** — galería, filtros, detalle (incluye cartas de doble cara)
- **Constructor Commander** — filtros de comandante, pool legal, auto-generar, consideraciones, export a Moxfield
- **Normas** — Comprehensive Rules indexadas y buscables
- **Asistente IA** (experimental) — Ollama local

## Licencia

Proyecto personal. Magic: The Gathering es marca de Wizards of the Coast.
