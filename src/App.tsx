import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Review from './pages/Review'
import KanaTable from './pages/KanaTable'
import KanaGate from './pages/KanaGate'
import VocabPage from './pages/VocabPage'
import Settings from './pages/Settings'

export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <header className="topbar">
          <NavLink to="/" className="brand jp">言葉 Kotoba</NavLink>
          <nav className="tabs">
            <NavLink to="/" end>主頁</NavLink>
            <NavLink to="/kana">五十音</NavLink>
            <NavLink to="/vocab">單字</NavLink>
            <NavLink to="/settings">設定</NavLink>
          </nav>
        </header>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/review" element={<Review />} />
          <Route path="/kana" element={<KanaTable />} />
          <Route path="/gate" element={<KanaGate />} />
          <Route path="/vocab" element={<VocabPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
