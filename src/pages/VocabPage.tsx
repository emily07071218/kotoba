import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, getSettings, saveSettings } from '../db'
import { THEMES, THEME_VOCAB } from '../data/themes'
import { PHRASES, PASSAGES } from '../data/sentences'
import { VOCAB, sentUnlocked, SENT_KANA_THRESHOLD } from '../session'
import type { AppSettings, Card, JLPTLevel } from '../types'

export default function VocabPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [cards, setCards] = useState<Card[] | null>(null)
  const [learnedKana, setLearnedKana] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const s = await getSettings()
      const all = await db.cards.toArray()
      if (!alive) return
      setCards(all)
      setLearnedKana(all.filter((c) => c.type === 'kana' && c.reps > 0).length)
      setSettings(s)
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!settings || !cards) return <p className="muted">載入中…</p>

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

  const vocabCards = cards.filter((c) => c.type === 'vocab')
  const introducedIds = new Set(vocabCards.map((c) => c.refId))
  const practicedIds = new Set(vocabCards.filter((c) => c.reps > 0).map((c) => c.refId))
  const sentCards = cards.filter((c) => c.type === 'sent')
  const sentIntroduced = sentCards.length
  const sentTotal = PHRASES.length + PASSAGES.length

  function isThemeOn(name: string): boolean {
    return settings!.enabledThemes === null || settings!.enabledThemes.includes(name)
  }

  async function toggleTheme(name: string) {
    const all = THEMES.map((t) => t.name)
    const current = settings!.enabledThemes ?? all
    const next = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name]
    const s = { ...settings!, enabledThemes: next.length === all.length ? null : next }
    setSettings(s)
    await saveSettings(s)
  }

  const levels: JLPTLevel[] = ['N5', 'N4']

  return (
    <>
      <h1>詞庫進度</h1>
      <p className="muted">
        新詞會自動出現在「開始複習」裡:主題單字最優先,接著 N5 → N4。
        每日上限可在設定頁調整(目前 {settings.vocabNewPerDay} 詞/天)。
      </p>

      {levels.map((level) => {
        const pool = VOCAB.filter((v) => v.level === level)
        const introduced = pool.filter((v) => introducedIds.has(v.id)).length
        const practiced = pool.filter((v) => practicedIds.has(v.id)).length
        return (
          <div className="card" key={level}>
            <div className="module">
              <div>
                <h3>{level}({level === 'N5' ? '入門' : '初級'})</h3>
                <div className="sub">
                  已引入 {introduced} / {pool.length} 詞・練習過 {practiced} 詞
                </div>
              </div>
            </div>
            <div className="progressbar" style={{ marginTop: 10 }}>
              <div style={{ width: `${pool.length ? (introduced / pool.length) * 100 : 0}%` }} />
            </div>
          </div>
        )
      })}

      <h2 style={{ marginTop: 20 }}>🌸 主題單字</h2>
      <p className="muted">勾選想學的主題,這些單字會優先出現在每日新詞(全部附發音)。</p>
      <div className="card">
        {THEMES.map((theme) => {
          const words = THEME_VOCAB.filter((v) => v.theme === theme.name)
          const introduced = words.filter((v) => introducedIds.has(v.id)).length
          return (
            <label className="theme-row" key={theme.name}>
              <input
                type="checkbox"
                checked={isThemeOn(theme.name)}
                onChange={() => toggleTheme(theme.name)}
              />
              <span className="theme-emoji">{theme.emoji}</span>
              <span className="theme-name">{theme.name}</span>
              <span className="muted">{introduced} / {words.length} 詞</span>
            </label>
          )
        })}
      </div>

      <h2 style={{ marginTop: 20 }}>💬 日常用語</h2>
      {!sentUnlocked(settings, learnedKana) ? (
        <p className="muted">
          再練 {Math.max(0, SENT_KANA_THRESHOLD - learnedKana)} 個假名,常用語就會自動融入每日複習。
        </p>
      ) : (
        <div className="card">
          <div className="module">
            <div>
              <h3>已引入 {sentIntroduced} / {sentTotal} 句</h3>
              <div className="sub">
                {PHRASES.length} 句常用語 + {PASSAGES.length} 篇短文,每天自動加入 3 句
              </div>
            </div>
          </div>
          <div className="progressbar" style={{ marginTop: 10 }}>
            <div
              style={{
                width: `${sentTotal ? (sentIntroduced / sentTotal) * 100 : 0}%`
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
