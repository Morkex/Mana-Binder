import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CollectionProvider } from './context/CollectionContext'
import { Layout } from './components/Layout'
import { CollectionPage } from './pages/CollectionPage'
import { DeckBuilderPage } from './pages/DeckBuilderPage'
import { RulesPage } from './pages/RulesPage'
import './index.css'

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

export default function App() {
  return (
    <CollectionProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<CollectionPage />} />
            <Route path="/mazos" element={<DeckBuilderPage />} />
            <Route path="/normas" element={<RulesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </CollectionProvider>
  )
}
