# Mana Binder

App de escritorio para **gestionar tu colección de Magic: The Gathering** y **construir y practicar mazos Commander** (EDH), usando tus cartas reales.

No es un cliente tipo Magic Arena: prioriza utilidad local (colección, constructor, goldfish) sobre un motor de reglas completo.

---

## Qué hace

| Sección | Ruta | Qué ofrece |
|---------|------|------------|
| **Colección** | `/` | Galería de tu colección, filtros, detalle de carta (incl. doble cara) |
| **Constructor Commander** | `/mazos` | Elige comandante, arma el mazo desde el pool legal, auto-genera, importa/exporta |
| **Probador** | `/probar` | Partida solitaria (goldfish) para probar el mazo |
| **Normas** | `/normas` | Comprehensive Rules indexadas y buscables |

### Colección
- Lee `coleccion_organizada/coleccion_maestra.json` e imágenes locales
- Filtros por texto, color, tipo, rareza, idioma, foil, set, legalidad Commander
- Cartas de doble cara con volteo de cara

### Constructor
- Comandantes legales de tu colección (identidad de color)
- Pool filtrado al color identity del comandante
- Auto-generador de mazo (opcionalmente potenciado con meta EDHREC)
- Sugerencias EDHREC cruzadas con lo que tienes
- Import / export: Moxfield, Archidekt, lista simple
- Tierras básicas virtuales ilimitadas (arte correcto)
- Mazos guardados en el navegador (`localStorage`)
- Asistente IA opcional vía [Ollama](https://ollama.com) en local

### Probador (goldfish)
- Zonas: biblioteca, mano, campo, cementerio, exilio, command, **stack**
- Arrastrar / doble clic para jugar; tap lands → maná; fases; mulligan
- **Stack LIFO** + Pass / Resolver; tierras van directo al campo
- Costes de maná (y tax de comandante) al lanzar
- Triggers frecuentes (ETB / dies / daño de combate) — subconjunto auto + resto en log
- Combate vs dummy (daño libre o bloqueadores 2/2)
- State-based actions: 0 toughness, legend rule
- Tokens desde texto oracle (+ arte Scryfall si hay red)
- Auto-guardado de partida mid-game

### Normas
- Comprehensive Rules en JSON buscable (y PDF de referencia en el repo)

---

## Cómo funciona (arquitectura)

```
Mana Binder/
├── app/                      # React + Vite + Electron
│   ├── electron/main.cjs     # Ventana, icono, espera a Vite en dev
│   ├── src/pages/            # Colección, Constructor, Probador, Normas
│   ├── src/components/       # UI compartida (Layout, filtros, EDHREC…)
│   ├── src/lib/              # Lógica MTG, mazos, playtest, EDHREC…
│   ├── src/context/          # Colección + mazos (CollectionContext)
│   ├── public/               # Favicon, iconos, rules JSON
│   └── build/                # Icono .ico / .png para Electron
├── coleccion_organizada/     # JSON maestro (+ imágenes locales, no en Git)
├── scripts/                  # Utilidades (normas, parches…)
├── rules/                    # PDF Comprehensive Rules
└── *.py                      # Actualizar / enriquecer colección con Scryfall
```

### Arranque
1. **Vite** sirve la UI en `http://127.0.0.1:5173` y la carpeta de colección vía `/collection/*`
2. **Electron** abre esa URL (en desarrollo espera a que Vite responda)
3. En Windows: acceso directo / `app/Abrir Mana Binder.cmd` o:

```bash
cd app
npm install
npm run electron:dev   # o: npm run app
```

Solo navegador: `npm run dev` → http://127.0.0.1:5173

### Build sin Vite / empaquetado Windows (.exe)

Electron incluye un **servidor local** que sirve la UI, la carpeta `coleccion_organizada` y los proxies EDHREC/Scryfall (sin depender de Vite).

```bash
cd app
npm run build          # genera app/dist
npm start              # Electron + loader local (busca la colección en disco)
```

**Generar instalador + portable:**

```bash
cd app
npm run dist           # → app/release/*.exe
```

Salida típica:
- `Mana Binder-1.0.0-win-x64.exe` — instalador NSIS
- `Mana Binder-1.0.0-portable.exe` — portable

**Colección junto al .exe** (no va dentro del instalador; pesa mucho):

1. Genera `coleccion_organizada/` con `python actualizar_coleccion.py`
2. Copia esa carpeta **al lado** del ejecutable, p. ej.:
   - Portable: `...\Mana Binder-1.0.0-portable.exe` + `...\coleccion_organizada\`
   - Instalado: `...\Mana Binder\Mana Binder.exe` + `...\Mana Binder\coleccion_organizada\`

También puedes definir `MANA_BINDER_COLLECTION` con la ruta absoluta a esa carpeta.

### Datos
| Origen | Uso |
|--------|-----|
| `GET /collection/coleccion_maestra.json` | Colección (Vite en dev · loader Electron en prod) |
| `/collection/imagenes/...` | Arte local de cartas |
| Proxy `/api/edhrec` | Meta EDHREC (`json.edhrec.com`) |
| Proxy `/api/scryfall` | Arte de tokens oficiales |
| `localStorage` `mana-binder-decks` | Mazos guardados |
| `localStorage` `mana-binder-playtest` | Partida del probador |
| Ollama `127.0.0.1:11434` | Asistente del constructor (opcional) |

### Flujo típico
1. Actualizas tu CSV de ManaBox y regeneras la colección con los scripts Python
2. Abres la app → ves la colección
3. En Constructor eliges comandante, armas / auto-generas / importas el mazo y lo guardas
4. Desde el constructor saltas al **Probador** con ese mazo para goldfish
5. Consultas dudas de reglas en **Normas**

### Colección e imágenes
Las imágenes **no** van a Git (~GB). Tras clonar:

1. Pon tu export ManaBox como `Colección .csv` en la raíz del repo  
2. Ejecuta:

```bash
python actualizar_coleccion.py
```

(o el flujo `organizar` / `enriquecer` según tu hábito). Eso regenera el JSON y descarga arte desde Scryfall.

---

## Requisitos

- **Node.js 20+**
- **Python 3.10+** (solo para actualizar la colección)
- Opcional: **Ollama** en local para el asistente IA

---

## Cambios pendientes / mejoras futuras

El roadmap del motor goldfish (stack, triggers, costes, combate, SBA, tokens) está **cubierto a nivel práctico**. Quedan mejoras opcionales:

### Probador / reglas
- [ ] Sacrifice / discard como costes adicionales al lanzar
- [ ] Más efectos auto-resueltos en triggers (hoy muchos quedan como “manual” en el log)
- [ ] Asignación de bloqueadores personalizada (hoy: libre o dummy 2/2 fijo)
- [ ] Motor de reglas completo tipo Arena — **no priorizado**

### Producto / app
- [ ] Empaquetado instalable (electron-builder / .exe con icono embebido)
- [ ] Icono también en la topbar de la UI (assets ya están en `public/`)
- [ ] Mejor manejo offline de la colección cuando se abre solo `dist/` sin Vite
- [ ] Pulir UX del probador (atajos, claridad de stack/prioridades)

### Colección / datos
- [ ] Flujo más guiado de “primera vez” tras clonar (sin imágenes)
- [ ] Sincronización / actualización incremental de la colección más cómoda

Detalle vivo del estado del roadmap: [`ROADMAP.md`](./ROADMAP.md).

---

## Scripts útiles (`app/`)

| Comando | Qué hace |
|---------|----------|
| `npm run electron:dev` / `npm run app` | Vite + Electron juntos |
| `npm run dev` | Solo Vite |
| `npm start` | Solo Electron (necesita Vite o `dist/`) |
| `npm run build` | Build de producción en `app/dist/` |
| `npm run lint` | Oxlint |

---

## Licencia y marcas

Proyecto personal. **Magic: The Gathering** es marca de Wizards of the Coast. EDHREC y Scryfall se usan como APIs/datos de terceros; respeta sus términos de uso.
