import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, getSettings } from '../db'
import { VOCAB } from '../session'
import type { AppSettings, JLPTLevel } from '../types'

interface LevelStat {
  level: JLPTLevel
  total: number
  introduced: number
  practiced: number
  withExample: number
}

export default function VocabPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [stats, setStats] = useState<LevelStat[] | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const s = await getSettings()
      const cards = await db.cards.where('type').equals('vocab').toArray()
      if (!alive) return
      const levels: JLPTLevel[] = ['N5', 'N4']
      setStats(
        levels.map((level) => {
          const pool = VOCAB.filter((v) => v.level === level)
          const ids = new Set(pool.map((v) => v.id))
          const mine = cards.filter((c) => ids.has(c.refId))
          return {
            level,
            total: pool.length,
            introduced: mine.length,
            practiced: mine.filter((c) => c.reps > 0).length,
            withExample: pool.filter((v) => v.example).length
          }
        })
      )
      setSettings(s)
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!settings || !stats) return <p className="muted">載入中…</p>

  if (!settings.vocabUnlocked) {
    return (
      <div className="card centerbox">
        <h2>單字功能尚未解鎖 🔒</h2>
        <p className="muted">
          先把假名立好,單字的讀音才有意義。通過五十音檢定後,系統會每天自動把新詞放進你的複習佇列。
        </p>
        <Link className="btn primary" to="/gate">前往五十音檢定</Link>
      </div>
    )
  }

  return (
    <>
      <h1>詞庫進度</h1>
      <p className="muted">
        新詞會依詞表順序、每天 {settings.vocabNewPerDay} 個,自動出現在「開始複習」裡,不需要手動選詞。
      </p>
      {stats.map((s) => (
        <div className="card" key={s.level}>
          <div className="module">
            <div>
              <h3>{s.level}({s.level === 'N5' ? '入門' : '初級'})</h3>
              <div className="sub">
                已引入 {s.introduced} / {s.total} 詞・練習過 {s.practiced} 詞・附例句 {s.withExample} 詞
              </div>
            </div>
          </div>
          <div className="progressbar" style={{ marginTop: 10 }}>
            <div style={{ width: `${s.total ? (s.introduced / s.total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
      <p className="muted">
        詞條與釋義來自 JMDict(CC BY-SA 4.0),例句來自 Tatoeba(CC BY 2.0 FR),詳見設定頁。
      </p>
    </>
  )
}
