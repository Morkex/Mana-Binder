# Prompt para ChatGPT — Mana Binder (mejoras y plan de acción)

Copia **todo el bloque** de abajo y pégalo en ChatGPT (idealmente GPT-4o / o1 / modelo con buen razonamiento).  
Si quieres iterar después, responde con: *“Dame el siguiente lote de 3 tareas listas para Cursor”*.

---

```text
Actúa como product manager + diseñador de UX de herramientas Magic: The Gathering + tech lead pragmático de una app desktop (React + Vite + Electron).

Tu objetivo NO es convertirme en Magic Arena. Tu objetivo es ayudarme a tener la herramienta MÁS ÚTIL posible para:
1) Elegir un comandante a partir de MI colección.
2) Construir un mazo Commander 100 (o casi) usando SOLO (o priorizando) cartas que ya tengo.
3) Entender huecos del mazo (manabase, ramp, draw, interacción, wincons, sinergia).
4) Decidir qué comprar / intercambiar SOLO cuando aporte mucho.
5) Probar el mazo en goldfish de forma práctica (no reglas perfectas).

Responde SIEMPRE en español. Sé concreto, priorizado y accionable. Evita relleno y “sería interesante”. Cada idea debe decir: por qué importa para construir mazos con colección propia, esfuerzo estimado (S/M/L), e impacto (alto/medio/bajo).

════════════════════════════════════
CONTEXTO DEL PRODUCTO (Mana Binder)
════════════════════════════════════

Mana Binder es una app de escritorio personal para:
- Gestionar colección MTG local (JSON + imágenes; export ManaBox → scripts Python + Scryfall).
- Construir mazos Commander con cartas de la colección.
- Probar el mazo en goldfish solitario.
- Consultar Comprehensive Rules indexadas.

Stack: React + Vite + Electron. Datos locales. Proxies a EDHREC y Scryfall. Mazos y playtest en localStorage. Ollama opcional para asistente IA.

YA EXISTE:
• Colección: galería, filtros, detalle, DFC.
• Constructor: comandante, pool por color identity, auto-generador (opcional EDHREC), sugerencias EDHREC cruzadas con colección, import/export Moxfield·Archidekt·lista, básicas virtuales, mazos guardados, Ollama opcional.
• Probador goldfish: zonas, stack LIFO, maná/costes/tax, triggers parciales, combate vs dummy, SBA básicas, tokens oracle/Scryfall, auto-save.
• Normas buscables.
• Roadmap de motor de reglas “versión C” goldfish: ya cubierto a nivel práctico.

PENDIENTE YA IDENTIFICADO (no te limites a esto; priorízalo o descártalo con razón):
• Sacrifice/discard como costes al lanzar.
• Más triggers auto-resueltos.
• Bloqueadores personalizados.
• Motor Arena completo = NO priorizar.
• Empaquetado .exe, icono en topbar, offline sin Vite, UX playtester.
• Onboarding primera vez sin imágenes; sync incremental de colección.

RESTRICCIONES:
• No proponer reescribir todo el stack.
• No priorizar multijugador online ni reglas perfectas.
• Priorizar valor semanal para “hacer un mazo bueno con lo que tengo”.
• Las mejoras del goldfish solo entran si ayudan a EVALUAR el mazo (consistencia, curva, mulligans, plan de juego), no por fidelidad CR.
• Considera que trabajo con un agente de código (Cursor): las tareas deben ser implementables en PRs pequeños.

════════════════════════════════════
LO QUE QUIERO QUE ENTREGUES
════════════════════════════════════

## 1) Diagnóstico (máx. 10 viñetas)
Qué le falta a Mana Binder hoy para ser “super útil” en el flujo real:
colección → elegir comandante → armar mazo → validar → wishlist mínima → goldfish → iterar.

## 2) Ideas: AÑADIR / MEJORAR / QUITAR O NO HACER
Tres listas separadas. En cada ítem:
- Nombre corto
- Descripción (2–4 líneas)
- Impacto (alto/medio/bajo) + esfuerzo (S/M/L)
- Cómo encaja en “mazo con mi colección”

Incluye al menos ideas en estas áreas (si encajan):
A. Descubrimiento de comandantes (winrate de “qué puedo pilotar bien con lo que tengo”)
B. Construcción guiada (roles: ramp/draw/removal/protection/wincon/lands)
C. Sinergia / tags / “esta carta es buena CON este comandante”
D. Gap analysis: “te faltan X tierras / Y draw / Z interacción”
E. EDHREC inteligente (tengo / no tengo / sustitutos de la colección)
F. Manabase helper (básicas + nonbasics que poseo)
G. Presupuesto / wishlist priorizada (solo huecos críticos)
H. Comparar versiones del mazo / historial
I. Flujo goldfish orientado a métricas (mulligan, turnos a primer spell, mana screw/flood)
J. UX del constructor (menos clics, mejor feedback)
K. Datos/colección (actualizar, buscar rápido, ownership clear)

## 3) Plan de acción CONTINUO (lo más importante)
Diseña un plan para trabajar “casi sin parar” durante 4–6 semanas, en lotes pequeños diarios/semanales.

Formato obligatorio:

### Principio rector
1 frase: qué optimizamos (ej. “tiempo de mazo jugable con colección ≥80% owned”).

### Fases (Semana 1…N)
Para cada semana:
- Objetivo de la semana (medible)
- 3–5 tareas concretas (checkbox), cada una:
  - Qué hacer
  - Dónde tocar (páginas/módulos orientativos: Colección / Constructor / Probador / lib / scripts)
  - Definition of Done
  - Dependencias
- “Demo al final de la semana”: qué puedo probar yo con un comandante real

### Backlog priorizado (Top 20)
Tabla o lista ordenada 1→20 con: prioridad, esfuerzo, semana sugerida.

### Anti-objetivos
Lista de cosas que NO debemos hacer ahora (y por qué).

### Ritmo de trabajo sugerido
Cómo partir el día/sesión con Cursor (ej. 1 feature vertical / sesión, commit, probar con un comandante).

## 4) Primer sprint inmediato (48–72 h)
Exactamente 5 tareas ordenadas, cada una en este formato:

**Tarea N — título**
- Por qué ahora
- Pasos de implementación (bullet técnicos, no código largo)
- Cómo probarlo manualmente
- Criterio de éxito

## 5) Preguntas que me harías
Máximo 8 preguntas para afinar el plan (nivel de colección, presupuesto, brackets, si uso Ollama, si priorizo cEDH o casual, etc.). Si no tengo respuesta, asume defaults razonables y decláralos.

════════════════════════════════════
CRITERIOS DE CALIDAD DE TU RESPUESTA
════════════════════════════════════
- Prioriza features que reduzcan fricción: “tengo 2000 cartas y no sé por dónde empezar”.
- Prefiere utilidades de deckbuilding sobre fidelidad del rules engine.
- Cada semana debe dejar la app MÁS útil para construir un mazo, no solo “más código”.
- Si algo del pendiente actual es baja prioridad vs. deckbuilding, dilo claramente.
- No inventes que ya existen features que no están en el contexto.
- Sé opinado: elige un camino y defiéndelo.

Empieza por el diagnóstico y termina con el sprint de 48–72 h.
```

---

## Cómo usarlo

1. Pega el prompt en ChatGPT.
2. Cuando responda, puedes seguir con:
   - `Convierte la Semana 1 en issues/tickets para Cursor (una tarea = un PR).`
   - `Reordena el Top 20 asumiendo colección casual ~1500–3000 cartas, sin cEDH.`
   - `Dame solo el siguiente lote de 3 tareas con Definition of Done.`
3. Cuando implementes cosas, actualiza `README.md` / `ROADMAP.md` y vuelve a pegar el prompt con un apartado extra: **“Estado actualizado: …”**.


Respuesta ChatGPT:
# 1) Diagnóstico

Mana Binder ya tiene una base muy potente. El cuello de botella ya **no es el motor de juego**, sino la **toma de decisiones**.

1. **No responde a la pregunta principal:** "¿Cuál es el mejor comandante que puedo construir con mi colección?"
2. **El constructor no guía.** Construyes mirando cartas, no objetivos (ramp, draw, removal, curva...).
3. **No existe un "score" del mazo.** El usuario termina con 100 cartas sin saber si el resultado es bueno.
4. **EDHREC ayuda a añadir cartas, pero no a decidir entre alternativas propias.**
5. **No existe análisis de sustituciones.** Si no tienes una staple, no sabes cuál de tus cartas hace un 80% del trabajo.
6. **El goldfish sirve para jugar, pero genera pocas métricas para mejorar el mazo.**
7. **La colección es pasiva.** No descubre oportunidades ("podrías montar estos 12 comandantes").
8. **No hay historial de evolución del mazo**, por lo que iterar es difícil.
9. **La wishlist no está ligada al impacto real en ese mazo.**
10. **Hay demasiadas decisiones manuales donde la aplicación podría sugerir la siguiente acción.**

---

# 2) Ideas

---

# AÑADIR

---

## 1. Commander Suitability Score

Escanea toda la colección y genera un ranking de comandantes según lo bien soportados que están por las cartas que ya posees.

Ejemplo:

```
Meren .......... 92%
Wilhelt ........ 89%
Giada .......... 86%
Brago .......... 82%
```

Incluye explicación:

* tienes 27 cartas sinérgicas
* posees 82% del core
* sólo faltarían 4 compras

**Impacto:** Alto

**Esfuerzo:** M

**Por qué importa**

Ésta debería ser literalmente la primera pantalla que vea el usuario.

---

## 2. Deck Health Dashboard

En vez de enseñar solo 100 cartas:

```
Ramp ............ 8 ✔
Draw ............ 11 ✔
Removal ......... 4 ⚠
Boardwipe ....... 1 ⚠
Protection ...... 2 ✔
Lands ........... 34 ⚠
Curva media ..... 3.9
```

Todo visual.

**Impacto:** Alto

**Esfuerzo:** M

Hace que el constructor deje de ser una lista de cartas.

---

## 3. Auto Roles

Cada carta obtiene automáticamente varios tags:

```
Ramp
Draw
Tutor
Protection
Token
Sac outlet
Blink
Treasure
Reanimation
Anthem
```

Basado en Oracle + reglas sencillas.

No IA.

**Impacto:** Alto

**Esfuerzo:** M

Sin esto, el resto de análisis es mucho peor.

---

## 4. Sinergia por comandante

No solo:

> "Esta carta aparece mucho."

Sino:

```
Muy buena con Meren

porque:

✔ sacrifica criaturas

✔ vuelve del cementerio

✔ genera ventaja cada turno
```

**Impacto:** Alto

**Esfuerzo:** M

Hace mucho más útil EDHREC.

---

## 5. Sustitutos inteligentes

Si falta:

```
Demonic Tutor
```

Mostrar:

```
Tienes:

Diabolic Tutor
Profane Tutor
Beseech the Queen
```

Ordenados por calidad.

**Impacto:** Alto

**Esfuerzo:** M

Muchísimo más útil que decir "no la tienes".

---

## 6. Wishlist priorizada

No una lista enorme.

Solo:

```
Comprar esto mejora muchísimo el mazo.

Smothering Tithe

Impacto: +9

Precio: €

Reemplaza:
Marble Diamond
```

**Impacto:** Alto

**Esfuerzo:** M

---

## 7. Manabase Wizard

Según:

* curva
* colores
* símbolos dobles
* tierras disponibles

Sugiere:

```
36 tierras

10 Plains

9 Forest

Temple Garden

Canopy Vista

...
```

Usando únicamente tu colección.

**Impacto:** Alto

**Esfuerzo:** M

---

## 8. Compare Deck Versions

```
v4

+3 ramp

-2 draw

Curva baja 0.3

Winrate goldfish +8%
```

**Impacto:** Medio

**Esfuerzo:** S

---

## 9. Goldfish Metrics

No mejorar reglas.

Mejorar datos.

Guardar automáticamente:

```
Turno primer ramp

Turno comandante

Mana screw

Mana flood

Mulligan

Turno primer removal

Turno primera amenaza
```

Tras 30 partidas:

```
Promedio comandante: turno 4.1

Mana screw: 17%

Mana flood: 5%
```

**Impacto:** Alto

**Esfuerzo:** M

Esto sí mejora el deckbuilding.

---

## 10. Quick Build Mode

Workflow:

```
Elegir comandante

↓

Añadir core

↓

Añadir cartas de colección

↓

Resolver huecos

↓

Añadir básicas

↓

Deck listo
```

Tipo wizard.

**Impacto:** Alto

**Esfuerzo:** M

---

## 11. Deck Goals

Seleccionar:

```
Casual

Power 7

High Power

Tribal

Combo

Budget

Temático
```

Las recomendaciones cambian.

**Impacto:** Medio

**Esfuerzo:** S

---

## 12. Ownership Everywhere

Siempre visible:

```
✔ Tengo 3

⚠ Tengo 1 en otro mazo

✘ No tengo
```

**Impacto:** Alto

**Esfuerzo:** S

---

# MEJORAR

---

## Constructor → menos clics

Arrastrar.

Doble click.

Hotkeys.

Añadir con Enter.

Eliminar con Backspace.

**Impacto:** Alto

**Esfuerzo:** S

---

## EDHREC

Actualmente responde:

```
qué juega la gente
```

Debe responder:

```
qué juega la gente Y ya tienes tú
```

Ordenado por:

```
Owned

Missing

Replacement

Impact
```

**Impacto:** Alto

**Esfuerzo:** M

---

## Búsqueda

Tipo VSCode.

```
t:ramp

ci<=gw

owned

mv<=3

draw
```

**Impacto:** Alto

**Esfuerzo:** M

---

## Colección

Mostrar:

```
Más usadas

Nunca usadas

Sólo en un mazo

Staples

Comandantes disponibles
```

**Impacto:** Medio

**Esfuerzo:** S

---

## Playtester

No invertir más tiempo en reglas.

Invertirlo en:

* reiniciar rápido
* guardar métricas
* repetir 100 manos

**Impacto:** Alto

**Esfuerzo:** S

---

# QUITAR / NO HACER

---

## Motor tipo Arena

No.

Impacto en deckbuilding prácticamente nulo.

---

## Pila perfecta

No.

---

## Priorizar triggers raros

Solo implementar los que aparecen muchísimo.

---

## Multiplayer online

No.

---

## Animaciones

No.

---

## Chat IA omnipresente

Solo úsalo donde aporta:

```
¿Por qué esta carta es mala aquí?
```

No como chatbot general.

---

## Reglas exhaustivas

Ya tienes suficiente para goldfish.

Todo lo demás tiene retorno decreciente.

---

# 3) Plan de acción continuo

## Principio rector

> **Reducir el tiempo desde "tengo una colección" hasta "tengo un mazo Commander sólido construido mayoritariamente con mis cartas".**

---

# Semana 1

## Objetivo

Poder descubrir automáticamente los mejores comandantes.

### Tareas

* [ ] Commander Suitability Score

  * **Dónde:** Constructor + lib
  * **DoD:** ranking generado para toda la colección
  * **Dependencias:** ninguna

* [ ] Auto tags básicos

  * **Dónde:** scripts/lib
  * **DoD:** 15–20 roles por carta

* [ ] Ownership API unificada

  * **Dónde:** colección
  * **DoD:** cualquier vista sabe si tienes la carta

* [ ] Página "Descubrir comandantes"

  * **Dónde:** Constructor
  * **DoD:** ranking navegable

### Demo

Elegir entre 20 comandantes sugeridos sin abrir EDHREC.

---

# Semana 2

## Objetivo

Construcción guiada.

### Tareas

* [ ] Dashboard de roles
* [ ] Gap Analysis
* [ ] Wizard de básicas
* [ ] Curva de maná

### Demo

Construir un mazo y saber qué falta sin pensar.

---

# Semana 3

## Objetivo

Sinergia.

### Tareas

* [ ] Explicación de recomendaciones
* [ ] Sustitutos
* [ ] EDHREC híbrido
* [ ] Priorización por colección

### Demo

Cada recomendación explica el porqué.

---

# Semana 4

## Objetivo

Iteración.

### Tareas

* [ ] Historial
* [ ] Comparación
* [ ] Wishlist
* [ ] Impacto esperado

### Demo

Ver que una compra mejora un 10% el mazo.

---

# Semana 5

## Objetivo

Goldfish cuantitativo.

### Tareas

* [ ] Métricas
* [ ] 100 simulaciones
* [ ] Informe
* [ ] Mulligans

### Demo

Comparar dos versiones objetivamente.

---

# Semana 6

## Objetivo

Pulido.

### Tareas

* [ ] UX
* [ ] Onboarding
* [ ] Offline
* [ ] Empaquetado

### Demo

Versión lista para usar diariamente.

---

# Backlog priorizado (Top 20)

| #  | Feature                     | Impacto | Esfuerzo | Semana |
| -- | --------------------------- | ------- | -------- | ------ |
| 1  | Commander Suitability Score | Alto    | M        | 1      |
| 2  | Auto tags                   | Alto    | M        | 1      |
| 3  | Ownership unificado         | Alto    | S        | 1      |
| 4  | Dashboard del mazo          | Alto    | M        | 2      |
| 5  | Gap Analysis                | Alto    | M        | 2      |
| 6  | Manabase Wizard             | Alto    | M        | 2      |
| 7  | Curva visual                | Alto    | S        | 2      |
| 8  | Sinergia explicada          | Alto    | M        | 3      |
| 9  | Sustitutos inteligentes     | Alto    | M        | 3      |
| 10 | EDHREC híbrido              | Alto    | M        | 3      |
| 11 | Wishlist priorizada         | Alto    | M        | 4      |
| 12 | Versionado de mazos         | Medio   | S        | 4      |
| 13 | Comparador de versiones     | Medio   | S        | 4      |
| 14 | Métricas de goldfish        | Alto    | M        | 5      |
| 15 | Lote de 100 simulaciones    | Alto    | M        | 5      |
| 16 | Análisis de mulligans       | Medio   | S        | 5      |
| 17 | Quick Build Mode            | Alto    | M        | 6      |
| 18 | Búsqueda avanzada           | Medio   | M        | 6      |
| 19 | Onboarding inicial          | Medio   | S        | 6      |
| 20 | Empaquetado e instalador    | Medio   | S        | 6      |

---

# Anti-objetivos

* Motor de reglas estilo Arena.
* Multiplayer.
* IA que construya todo el mazo sin explicar decisiones.
* Animaciones y efectos visuales.
* Soporte para formatos distintos de Commander antes de consolidar el flujo principal.
* Triggers extremadamente raros o interacciones que apenas aparecen en goldfish.
* Reescribir el stack o migrar de almacenamiento local mientras el producto aún está evolucionando.

---

# Ritmo de trabajo sugerido

Una sesión = **una feature vertical**.

1. Crear issue.
2. Implementar.
3. Commit.
4. Probar con **un comandante real** (por ejemplo, uno de tu colección).
5. Corregir UX.
6. Merge.

Nunca mezclar cinco features pequeñas en el mismo PR. Si una tarea supera un día de trabajo, probablemente está demasiado grande.

---

# 4) Primer sprint inmediato (48–72 h)

## Tarea 1 — Commander Suitability Score

**Por qué ahora**

Resuelve el mayor problema del producto: no saber qué construir.

**Pasos de implementación**

* Crear servicio que puntúe comandantes.
* Combinar identidad de color, cartas poseídas y presencia en EDHREC.
* Generar puntuación y explicación ("27 cartas sinérgicas", "84% del núcleo", etc.).
* Añadir vista ordenable por puntuación.

**Cómo probarlo**

Importar tu colección actual y comprobar que el top incluye comandantes que intuitivamente ya parecen viables.

**Criterio de éxito**

Puedes elegir un comandante en menos de 2 minutos sin explorar manualmente la colección.

---

## Tarea 2 — Dashboard del mazo

**Por qué ahora**

Permite saber inmediatamente si el mazo está equilibrado.

**Pasos de implementación**

* Clasificar cartas por roles usando los tags.
* Mostrar contadores con objetivos configurables.
* Resaltar déficits y excesos.

**Cómo probarlo**

Abrir varios mazos y verificar que los huecos coinciden con una revisión manual.

**Criterio de éxito**

Con un vistazo sabes qué categorías necesitan atención.

---

## Tarea 3 — Sustitutos inteligentes

**Por qué ahora**

Reduce la frustración de no tener staples.

**Pasos de implementación**

* Relacionar cartas funcionalmente similares mediante reglas y datos de EDHREC/Scryfall.
* Filtrar por cartas poseídas.
* Mostrar sustitutos directamente en las recomendaciones.

**Cómo probarlo**

Buscar varias staples ausentes y confirmar que aparecen alternativas de tu colección.

**Criterio de éxito**

Siempre existe una recomendación útil cuando falta una carta importante.

---

## Tarea 4 — Métricas de goldfish

**Por qué ahora**

Convierte el probador en una herramienta de evaluación, no solo de juego.

**Pasos de implementación**

* Registrar eventos clave (mulligan, primer ramp, comandante, primer removal, screw/flood).
* Persistir resultados por partida.
* Mostrar resumen acumulado.

**Cómo probarlo**

Jugar 10–20 partidas y verificar que las métricas reflejan lo sucedido.

**Criterio de éxito**

Puedes comparar dos listas con datos objetivos.

---

## Tarea 5 — Wishlist priorizada

**Por qué ahora**

Cierra el ciclo completo colección → mazo → mejora.

**Pasos de implementación**

* Detectar los huecos críticos del mazo.
* Asignar impacto estimado a posibles incorporaciones.
* Generar lista corta de compras con la carta que sustituirían.

**Cómo probarlo**

Abrir varios mazos incompletos y comprobar que las sugerencias son razonables y limitadas.

**Criterio de éxito**

La wishlist contiene pocas cartas, claramente justificadas y con alto retorno.

---

# 5) Preguntas que te haría

Voy a asumir por defecto que juegas **Commander casual/alto poder (Power 7–8)**, presupuesto moderado, colección de unas pocas miles de cartas y que **Ollama es opcional**. Para afinar el plan, estas serían mis preguntas:

1. ¿Cuántas cartas únicas tiene aproximadamente tu colección? (1.000, 5.000, 15.000...)
2. ¿Sueles construir mazos desde cero o partir de una lista de EDHREC/Moxfield?
3. ¿Cuál es tu presupuesto mensual aproximado para compras de Magic? (0 €, 20 €, 50 €, 100 €...)
4. ¿Quieres optimizar para mesas casuales, High Power o cEDH?
5. ¿Te interesa construir muchos mazos distintos o mantener pocos mazos muy refinados?
6. ¿Aceptas mover cartas entre mazos o prefieres respetar el inventario físico (una copia, un mazo)?
7. ¿Qué importancia das a la explicación de las recomendaciones frente a la rapidez? (¿prefieres entender el "por qué" o llegar antes al mazo?)
8. ¿Estarías dispuesto a hacer un pequeño preprocesado offline de la colección (índices de sinergias y tags) para que toda la experiencia posterior sea prácticamente instantánea?

## Una recomendación estratégica adicional

Hay una única funcionalidad que **subiría incluso por encima del resto** y que no suele existir ni en Moxfield, ni Archidekt, ni ManaBox:

> **"Modo Consultor de Colección"**.

No empieza desde un comandante, sino desde **tu colección**. Analiza todo tu inventario y responde preguntas como:

* *"Con lo que tienes puedes montar 14 comandantes sólidos."*
* *"Tu colección favorece claramente Aristocrats, Blink y +1/+1 Counters."*
* *"Tienes un 93% del núcleo de Meren, un 88% de Giada y un 84% de Brago."*
* *"Con dos compras (18 €) tu mazo de Giada subiría más que gastando 80 € en Atraxa."*
* *"Hay 126 cartas de tu colección que nunca has usado y 41 son muy buenas en comandantes que ya puedes construir."*

Eso convierte Mana Binder en una herramienta que **piensa sobre tu colección**, no solo en otro constructor de mazos. Es una propuesta muy alineada con el objetivo del producto y, en mi opinión, sería su principal factor diferenciador.
