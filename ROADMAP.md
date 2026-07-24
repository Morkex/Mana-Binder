# Roadmap — Mana Binder

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

## Próximo

El bloque “motor de reglas (versión C)” del roadmap está cubierto a nivel goldfish.

Mejoras opcionales futuras (fuera de este roadmap):
- Sacrifice / discard como costes adicionales al lanzar
- Más efectos auto-resueltos en triggers
- Asignación de bloqueadores personalizada
- Motor de reglas completo tipo Arena (no priorizado)

No es un cliente de Magic Arena: se prioriza utilidad para practicar el mazo propio.
