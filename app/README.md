# Mana Binder

App de escritorio para ver tu colección de Magic y construir mazos Commander.

## Requisitos

- Node.js 20+
- La carpeta `../coleccion_organizada` con `coleccion_maestra.json` e `imagenes/`

## Arranque

```bash
cd app
npm install
npm run electron:dev
```

Solo navegador (sin Electron):

```bash
npm run dev
```

Abre http://localhost:5173

## Funciones

### Colección
- Galería con fotos locales
- Filtros: texto, color, tipo, rareza, idioma, foil, set, legalidad Commander
- Detalle de carta al hacer clic

### Constructor Commander
1. Elige un comandante (criaturas legendales de tu colección)
2. Ve el pool legal según identidad de color
3. Cartas agrupadas por **color → tipo → subtipo**
4. Añade cartas a mano o pulsa **Auto-generar mazo**
5. Guarda mazos en el navegador (localStorage)

## Imágenes

Modo híbrido (Scryfall):

| Uso | Calidad | Carpeta |
|---|---|---|
| Grid / miniaturas | `normal` | `coleccion_organizada/imagenes/normal/` |
| Detalle ampliado | `png` (máxima) | `coleccion_organizada/imagenes/hq/` |

Tras actualizar la colección CSV:

```bash
python ../enriquecer_coleccion.py
```

