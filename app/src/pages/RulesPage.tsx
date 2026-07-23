import { useEffect, useMemo, useState } from 'react'
import type { ComprehensiveRules, RuleSearchHit, RuleSection } from '../types/rules'
import { RuleText } from '../components/RuleText'

const RULES_URL = `${import.meta.env.BASE_URL}rules/comprehensive-rules.json`
const PDF_URL = `${import.meta.env.BASE_URL}rules/MagicCompRules 20260619.pdf`

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

function buildSearchIndex(data: ComprehensiveRules): RuleSearchHit[] {
  const hits: RuleSearchHit[] = []

  for (const part of data.parts) {
    for (const section of part.sections) {
      for (const rule of section.rules) {
        hits.push({
          kind: 'rule',
          partNumber: part.number,
          partTitle: part.title,
          sectionNumber: section.number,
          sectionTitle: section.title,
          number: rule.number,
          text: rule.text,
        })
        for (const sub of rule.subrules) {
          hits.push({
            kind: 'subrule',
            partNumber: part.number,
            partTitle: part.title,
            sectionNumber: section.number,
            sectionTitle: section.title,
            number: sub.number,
            text: sub.text,
          })
        }
      }
    }
  }

  for (const entry of data.glossary) {
    hits.push({
      kind: 'glossary',
      term: entry.term,
      text: entry.definition,
    })
  }

  return hits
}

function sectionId(section: RuleSection): string {
  return `section-${section.number}`
}

export function RulesPage() {
  const [data, setData] = useState<ComprehensiveRules | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'rules' | 'glossary'>('rules')
  const [query, setQuery] = useState('')
  const [expandedParts, setExpandedParts] = useState<Set<number>>(() => new Set([1]))
  const [activeSection, setActiveSection] = useState<string>('100')

  useEffect(() => {
    fetch(RULES_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudieron cargar las normas (${r.status})`)
        return r.json() as Promise<ComprehensiveRules>
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const searchIndex = useMemo(() => (data ? buildSearchIndex(data) : []), [data])

  const searchResults = useMemo(() => {
    const q = normalize(query.trim())
    if (!q || q.length < 2) return []
    return searchIndex
      .filter((hit) => {
        const haystack = normalize(
          [hit.number, hit.term, hit.text, hit.sectionTitle, hit.partTitle].filter(Boolean).join(' '),
        )
        return haystack.includes(q)
      })
      .slice(0, 40)
  }, [query, searchIndex])

  const activeSectionData = useMemo(() => {
    if (!data) return null
    for (const part of data.parts) {
      const section = part.sections.find((s) => s.number === activeSection)
      if (section) return { part, section }
    }
    return null
  }, [data, activeSection])

  const filteredGlossary = useMemo(() => {
    if (!data) return []
    const q = normalize(query.trim())
    if (!q) return data.glossary
    return data.glossary.filter(
      (entry) =>
        normalize(entry.term).includes(q) || normalize(entry.definition).includes(q),
    )
  }, [data, query])

  function togglePart(partNumber: number) {
    setExpandedParts((prev) => {
      const next = new Set(prev)
      if (next.has(partNumber)) next.delete(partNumber)
      else next.add(partNumber)
      return next
    })
  }

  function goToSection(sectionNumber: string) {
    setTab('rules')
    setActiveSection(sectionNumber)
    setExpandedParts((prev) => {
      const next = new Set(prev)
      next.add(Math.floor(Number(sectionNumber) / 100))
      return next
    })
    requestAnimationFrame(() => {
      document.getElementById(sectionId({ number: sectionNumber, title: '', rules: [] }))?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  function openSearchHit(hit: RuleSearchHit) {
    if (hit.kind === 'glossary') {
      setTab('glossary')
      setQuery(hit.term ?? '')
      return
    }
    if (hit.sectionNumber) goToSection(hit.sectionNumber)
  }

  if (loading) return <div className="state">Cargando normas de Magic…</div>
  if (error) return <div className="state state--error">{error}</div>
  if (!data) return <div className="state">Sin datos de normas.</div>

  return (
    <div className="rules-layout">
      <aside className="rules-sidebar">
        <header className="rules-sidebar__head">
          <h2>Índice</h2>
          <p>Vigentes desde {data.version}</p>
        </header>

        <div className="rules-tabs">
          <button
            type="button"
            className={tab === 'rules' ? 'rules-tabs__btn is-active' : 'rules-tabs__btn'}
            onClick={() => setTab('rules')}
          >
            Reglas
          </button>
          <button
            type="button"
            className={tab === 'glossary' ? 'rules-tabs__btn is-active' : 'rules-tabs__btn'}
            onClick={() => setTab('glossary')}
          >
            Glosario
          </button>
        </div>

        {tab === 'rules' && (
          <nav className="rules-nav">
            {data.parts.map((part) => {
              const open = expandedParts.has(part.number)
              return (
                <div key={part.number} className="rules-nav__part">
                  <button
                    type="button"
                    className="rules-nav__part-btn"
                    onClick={() => togglePart(part.number)}
                    aria-expanded={open}
                  >
                    <span className="rules-nav__chevron">{open ? '▾' : '▸'}</span>
                    <span>
                      {part.number}. {part.title}
                    </span>
                  </button>
                  {open && (
                    <ul className="rules-nav__sections">
                      {part.sections.map((section) => (
                        <li key={section.number}>
                          <button
                            type="button"
                            className={
                              activeSection === section.number
                                ? 'rules-nav__section is-active'
                                : 'rules-nav__section'
                            }
                            onClick={() => goToSection(section.number)}
                          >
                            {section.number}. {section.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </nav>
        )}

        {tab === 'glossary' && (
          <p className="rules-sidebar__hint">
            {data.glossary.length} términos. Usa la búsqueda para filtrar.
          </p>
        )}

        <a className="rules-download" href={PDF_URL} download>
          Descargar PDF original
        </a>
      </aside>

      <section className="rules-main">
        <header className="section-head rules-main__head">
          <div>
            <h1>Normas de Magic</h1>
            <p>{data.title} · {data.source}</p>
          </div>
        </header>

        <div className="rules-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar reglas, subreglas o términos del glosario…"
            className="rules-search__input"
          />
          {query.trim().length >= 2 && (
            <div className="rules-search__results">
              {searchResults.length ? (
                searchResults.map((hit, idx) => (
                  <button
                    key={`${hit.kind}-${hit.number ?? hit.term}-${idx}`}
                    type="button"
                    className="rules-search__hit"
                    onClick={() => openSearchHit(hit)}
                  >
                    <span className="rules-search__hit-label">
                      {hit.kind === 'glossary'
                        ? hit.term
                        : `${hit.number} · ${hit.sectionTitle}`}
                    </span>
                    <span className="rules-search__hit-text">
                      {hit.text.slice(0, 140)}
                      {hit.text.length > 140 ? '…' : ''}
                    </span>
                  </button>
                ))
              ) : (
                <p className="rules-search__empty">Sin coincidencias.</p>
              )}
            </div>
          )}
        </div>

        {tab === 'rules' && activeSectionData && (
          <article className="rules-section" id={sectionId(activeSectionData.section)}>
            <header className="rules-section__head">
              <p className="rules-section__part">
                Parte {activeSectionData.part.number}: {activeSectionData.part.title}
              </p>
              <h2>
                {activeSectionData.section.number}. {activeSectionData.section.title}
              </h2>
            </header>

            <ol className="rules-list">
              {activeSectionData.section.rules.map((rule) => (
                <li key={rule.number} className="rules-list__item">
                  <p className="rules-list__rule">
                    <strong>{rule.number}.</strong> <RuleText text={rule.text} />
                  </p>
                  {rule.subrules.length > 0 && (
                    <ul className="rules-list__subrules">
                      {rule.subrules.map((sub) => (
                        <li key={sub.number}>
                          <strong>{sub.number}</strong> <RuleText text={sub.text} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </article>
        )}

        {tab === 'glossary' && (
          <div className="glossary-list">
            {filteredGlossary.map((entry) => (
              <article key={entry.term} className="glossary-entry">
                <h3>{entry.term}</h3>
                <p>{entry.definition}</p>
              </article>
            ))}
            {!filteredGlossary.length && (
              <p className="empty">Ningún término coincide con la búsqueda.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
