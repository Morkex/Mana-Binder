# Roadmap — Mana Binder

**Principio rector:** reducir el tiempo desde “tengo una colección” hasta “tengo un mazo Commander sólido construido mayoritariamente con mis cartas”.

El motor goldfish (stack, triggers, costes, combate, SBA, tokens) ya está cubierto a nivel práctico. Lo siguiente prioriza **deckbuilding con colección propia**, no fidelidad de reglas.

Orden = dependencias (hacer antes lo que desbloquea lo de después). Las casillas se irán marcando al completar.

Dudas / supuestos abiertos: [`ROADMAP_DUDAS.md`](./ROADMAP_DUDAS.md).

---

## Hecho (2026-07)

- Import/export Moxfield · Archidekt · lista simple
- Sugerencias EDHREC cruzadas con la colección
- Auto-generador potenciado con meta EDHREC (si hay red)
- Probador goldfish (zonas, maná, vida, tokens, contadores)
- **Partida solitaria jugable**
  - Arrastrar cartas mano → battlefield (y entre zonas)
  - Doble clic para jugar desde la mano / comandante
  - Layout: command · campo · piles · mano inferior
  - Tap lands / mana rocks para maná
  - Attack / untap / +1/+1
  - Mulligan · fases visibles · auto-guardado mid-game
- **Stack y prioridades (MVP)**
  - Tierras → battlefield (acción especial)
  - Hechizos/permanentes → zona stack (LIFO)
  - Pass / Resolver top · Resolver todo
  - Instant/sorcery → cementerio; permanentes → campo
- **Triggers (subconjunto)**
  - ETB / dies / combat damage → stack como habilidades
  - Auto: draw, gain life, damage dummy, create tokens; resto manual (log)
- **Costes**
  - Validar y gastar pool al lanzar (maná + tax de comandante)
- **Combat vs dummy**
  - Daño libre al oponente · o cada atacante vs bloqueador 2/2
- **State-based actions**
  - 0 toughness · legend rule (auto + botón SBA)
- **Tokens oficiales**
  - Parse oracle “create … token” + arte vía Scryfall (`/api/scryfall`)
- Persistencia de partida (localStorage)

---

## Próximo — deckbuilding con colección

### Bloque A — Cimientos (desbloquean casi todo)

1. [x] **Auto-tags / roles de carta** *(base de casi todos los análisis)*  
   Clasificar cartas con reglas sobre Oracle (ramp, draw, removal, wipe, protection, tutor, tokens, sac outlet, blink, reanimacion, anthem, wincon, land…; ~15–20 roles). Sin IA.  
   → DoD: cada carta del pool puede exponer sus tags. · Módulo `app/src/lib/cardRoles.ts` · visible en detalle, analyzer y filtros del viewer.

2. [x] **Ownership unificado** *(API/vista compartida)*  
   Saber en cualquier sitio: tengo N / tengo 1 pero en otro mazo / no tengo.  
   → DoD: constructor, sugerencias y colección usan la misma fuente de verdad. · `ownership.ts` · preview constructor + detalle colección.

3. [x] **Commander Suitability Score** *(depende de A1; EDHREC opcional para boost)*  
   Ranking de comandantes de la colección según soporte real (cartas owned, núcleo, huecos).  
   → DoD: lista ordenable con % / explicación breve. · `commanderSuitability.ts` (EDHREC boost pendiente — ver dudas).

4. [x] **Página / modo “Descubrir comandantes”** *(depende de A3)*  
   UI navegable del ranking (“Modo Consultor de Colección” — empieza por el inventario).  
   → DoD: elegir comandante viable en &lt;2 min sin explorar a mano. · `DiscoverCommanders` en constructor.

### Bloque B — Construcción guiada (necesita tags)

5. [x] **Dashboard de salud del mazo (roles)** *(depende de A1)*  
   Contadores: ramp / draw / removal / wipes / protection / lands / curva, con umbrales y avisos.  
   → DoD: de un vistazo se ven déficits y excesos. · `deckHealth.ts` + `DeckAnalyzer`.

6. [x] **Gap analysis** *(depende de B5)*  
   Texto accionable: “te faltan X draw / Y interacción / Z tierras”.  
   → DoD: sugerencias concretas ligadas a roles, no solo números.

7. [x] **Curva de maná visual** *(puede ir con B5)*  
   Histograma claro en el constructor.  
   → DoD: curva visible y usable al armar el mazo.

8. [x] **Manabase wizard** *(depende de A2 + curva/colores del mazo)*  
   Propuesta de lands (básicas + nonbasics owned) según pips y curva.  
   → DoD: rellenar/ajustar manabase solo con colección (+ básicas virtuales). · `manabaseWizard.ts`.

### Bloque C — Recomendaciones inteligentes (necesita tags + ownership)

9. [x] **EDHREC híbrido** *(depende de A2; mejora con A1)*  
   Ordenar meta por: owned → missing → replacement → impacto.  
   → DoD: “qué juega la gente **y** qué tienes tú”. · `prioritizeOwned` en `edhrec.ts`.

10. [x] **Sinergia explicada con el comandante** *(depende de A1; mejora con EDHREC)*  
    Por qué encaja una carta (tags + razones cortas), no solo “sale mucho”.  
    → DoD: cada recomendación top lleva 1–3 razones.

11. [x] **Sustitutos inteligentes** *(depende de A1 + A2; mejora con EDHREC)*  
    Si falta una staple, alternativas owned ordenadas por calidad/función.  
    → DoD: ante un missing crítico siempre hay sustituto útil o “no hay en colección”. · `cardSubstitutes.ts` (matching por roles; ver dudas).

12. [x] **Priorización de recomendaciones por colección** *(depende de C9–C11)*  
    Preferir mejoras con cartas que ya tienes antes que wishlist.  
    → DoD: el flujo “añadir a mazo” prioriza owned.

### Bloque D — Iteración y compras (necesita gaps + recomendaciones)

13. [x] **Versionado / historial de mazos**  
    Guardar snapshots al guardar o bajo demanda.  
    → DoD: recuperar versiones anteriores de un mazo. · `deckVersions.ts` + panel UI.

14. [x] **Comparador de versiones** *(depende de D13)*  
    Diff de roles, curva, owned%; opcional métricas goldfish más adelante.  
    → DoD: ver qué cambió entre vN y vN+1. · Diff + batch manos A vs B.

15. [x] **Wishlist priorizada** *(depende de B6 + C11)*  
    Lista corta de compras de alto impacto + qué reemplazan + justificación.  
    → DoD: pocas cartas, claramente priorizadas (no dump de EDHREC).

16. [x] **Impacto esperado de una compra** *(depende de D15; mejora con D14)*  
    Estimar cuánto mejora salud/score del mazo al añadir X.  
    → DoD: “esta carta ≈ +N al dashboard / suitability”. · `estimatePurchaseImpact` (heurístico; sin precios).

### Bloque E — Goldfish cuantitativo (evaluar mazos, no más reglas)

17. [x] **Métricas por partida**  
    Registrar: mulligan, turno 1er ramp, turno comandante, 1er removal/amenaza, screw/flood.  
    → DoD: resumen tras cada partida + acumulado por mazo. · Botón “Guardar métricas” en probador (removal/amenaza aún no).

18. [x] **Análisis de mulligans** *(depende de E17)*  
    Tasa y calidad de manos iniciales.  
    → DoD: ver si el mazo mulliganea demasiado. · Batch + media en métricas guardadas.

19. [x] **Lote de simulaciones (p. ej. 100 manos / goldfish ligero)** *(depende de E17)*  
    Batch sin UI de mesa completa.  
    → DoD: promedios en segundos para comparar listas. · `goldfishSim.ts` + botón constructor.

20. [x] **Informe comparativo goldfish** *(depende de E19 + D14)*  
    Dos versiones del mazo lado a lado con métricas.  
    → DoD: decidir qué lista va mejor con datos. · En panel de versiones (80 manos A vs B).

### Bloque F — Flujo y pulido de producto

21. [x] **Quick Build Mode (wizard)** *(depende de A–C básicos)*  
    Flujo: comandante → core → owned → huecos → lands → listo.  
    → DoD: mazo jugable guiado de punta a punta. · `QuickBuildBar` (pasos en el constructor).

22. [x] **Deck goals / power profile** *(S; puede ir pronto pero no bloquea)*  
    Casual / Power 7 / tribal / combo / budget → cambia umbrales del dashboard y recomendaciones.  
    → DoD: cambiar goal recalcula avisos. · Select en `DeckAnalyzer`.

23. [x] **UX constructor (menos clics)**  
    Hotkeys, Enter para añadir, Backspace quitar, atajos claros.  
    → DoD: armar mazo notablemente más rápido.

24. [x] **Búsqueda avanzada tipo VSCode**  
    Queries: `t:ramp`, `ci<=gw`, `owned`, `mv<=3`, etc.  
    → DoD: filtrar pool/colección con sintaxis compacta. · `cardQuery.ts` en pool + colección.

25. [x] **Vistas de colección “oportunidades”**  
    Más usadas / nunca usadas / solo en un mazo / staples / comandantes disponibles.  
    → DoD: descubrir valor dormido en el inventario. · `collectionInsights.ts`.

26. [x] **Onboarding primera vez** (sin imágenes / colección vacía)  
    → DoD: mensaje claro + pasos para generar JSON/imágenes.

27. [x] **Offline / arranque sin depender solo de Vite**  
    → DoD: app usable tras build o con fallback documentado. · Electron → `dist/` + README.

28. [x] **Icono en topbar de la UI** (assets ya en `public/`)  
    → DoD: brand mark con el icono de la app.

29. [x] **Empaquetado instalable (.exe)**  
    → DoD: instalador/portable con icono embebido.  
    → `npm run dist` · loader Electron (`electron/localServer.cjs`) · colección junto al .exe.

---

## Mejoras menores del goldfish (baja prioridad vs deckbuilding)

Solo si aportan a **evaluar** el mazo; no antes de los bloques A–E.

- [ ] Sacrifice / discard como costes al lanzar
- [ ] Más efectos auto-resueltos en triggers frecuentes
- [ ] Asignación de bloqueadores personalizada
- [ ] Reinicio rápido / repetir N manos (atajo UX; encaja con E17–E19)

---

## Fuera de alcance (anti-objetivos)

No hacer ahora (retorno bajo para el principio rector):

- Motor de reglas tipo Magic Arena
- Multijugador online
- Pila / triggers raros / reglas exhaustivas
- Chat IA omnipresente (solo ayudas puntuales explicativas)
- Animaciones decorativas
- Otros formatos antes de consolidar Commander
- Reescribir el stack o migrar storage “por higiene” mientras el producto evoluciona

---

## Referencia

Plan y razonamiento detallados: [`PROMPT_MEJORAS.md`](./PROMPT_MEJORAS.md) (respuesta ChatGPT).  
Visión de producto: [`README.md`](./README.md).
