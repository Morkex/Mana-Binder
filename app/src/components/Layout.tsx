import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useCollection } from '../context/CollectionContext'

export function Layout({ children }: { children: ReactNode }) {
  const { master, loading } = useCollection()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand__mark"
            src={`${import.meta.env.BASE_URL}icon-128.png`}
            alt=""
            width={44}
            height={44}
            decoding="async"
          />
          <div>
            <p className="brand__name">Mana Binder</p>
            <p className="brand__tag">
              {loading
                ? 'Cargando colección…'
                : master
                  ? `${master.totalQuantity} cartas · ${master.uniqueCards} únicas`
                  : 'Sin datos'}
            </p>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav__link is-active' : 'nav__link')}>
            Colección
          </NavLink>
          <NavLink
            to="/mazos"
            className={({ isActive }) => (isActive ? 'nav__link is-active' : 'nav__link')}
          >
            Constructor Commander
          </NavLink>
          <NavLink
            to="/probar"
            className={({ isActive }) => (isActive ? 'nav__link is-active' : 'nav__link')}
          >
            Probador
          </NavLink>
          <NavLink
            to="/normas"
            className={({ isActive }) => (isActive ? 'nav__link is-active' : 'nav__link')}
          >
            Normas
          </NavLink>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  )
}
