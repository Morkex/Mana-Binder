# Roadmap — Mana Binder

## Hecho (2026-07)

- Import/export Moxfield · Archidekt · lista simple
- Sugerencias EDHREC cruzadas con la colección
- Auto-generador potenciado con meta EDHREC (si hay red)
- Probador goldfish (zonas, maná, vida, tokens, contadores)

## Próximo — motor de reglas (versión C)

Objetivo: partida solitaria (y luego vs dummies) con más fidelidad.

1. **Stack y prioridades** — hechizos/habilidades en cola, pass priority
2. **Triggers** — ETB, death, combat damage (subconjunto frecuente)
3. **Costes** — pagar maná / sacrifice / discard al lanzar
4. **Combat** — declare attackers/blockers, damage assignment
5. **State-based actions** — 0 toughness, legend rule, etc.
6. **Tokens oficiales** — crear desde texto oracle (Scryfall token endpoints)
7. **Persistencia de partida** — guardar/cargar goldfish mid-game

No es un cliente de Magic Arena: se prioriza utilidad para practicar el mazo propio.
