import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, getSettings } from '../db'
import { availability, SENT_KANA_THRESHOLD, sentUnlocked, VOCAB } from '../session'
import { THEME_VOCAB } from '../data/themes'
import { KANA_TOTAL } from '../data/kana'
import type { AppSettings } from '../types'
import { download, localDateStr } from '../util'
import type { BackupFile } from '../types'

interface HomeData {
  due: number
  newKana: number
  newVocab: number
  newSent: number
  learnedKana: number
  introducedVocab: number
  introducedSent: number
  sentUnlocked: boolean
  streak: number
  settings: AppSettings
  cardCount: number
}

async function loadStreak(): Promise<number> {
  const logs = await db.logs.toArray()
  const active = new Set(logs.filter((l) => l.reviewed > 0).map((l) => l.date))
  const d = new Date()
  if (!active.has(localDateStr(d))) d.setDate(d.getDate() - 1)
  let s = 0
  while (active.has(localDateStr(d))) {
    s++
    d.setDate(d.getDate() - 1)
  }
  return s
}

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const settings = await getSettings()
      const avail = await availability(settings)
      const streak = await loadStreak()
      const cardCount = await db.cards.count()
      if (alive) setData({ ...avail, streak, settings, cardCount })
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!data) return <p className="muted">載入中…</p>

  const total = data.due + data.newKana + data.newVocab + data.newSent
  const neverBackedUp = data.settings.lastBackupAt === null
  const daysSinceBackup = neverBackedUp
    ? Infinity
    : (Date.now() - data.settings.lastBackupAt!) / 86_400_000
  const needBackup =
    data.cardCount > 0 &&
    ((neverBackedUp && data.cardCount >= 10) ||
      daysSinceBackup > data.settings.backupReminderDays)
  const sentWanted = sentUnlocked(data.settings, data.learnedKana)
  const kanaToGo = Math.max(0, SENT_KANA_THRESHOLD - data.learnedKana)

  async function exportBackup() {
    const settings = await getSettings()
    const backup: BackupFile = {
      app: 'kotoba',
      schema: 1,
      exportedAt: new Date().toISOString(),
      settings,
      cards: await db.cards.toArray(),
      logs: await db.logs.toArray()
    }
    const s = await getSettings()
    s.lastBackupAt = Date.now()
    await db.kv.put({ key: 'settings', value: s })
    download(`kotoba-backup-${localDateStr()}.json`, JSON.stringify(backup))
    window.location.reload()
  }

  return (
    <>
      {needBackup && (
        <div className="banner">
          <span>
            {neverBackedUp
              ? '你還沒備份過學習進度(資料只存在這個瀏覽器裡)。'
              : `已經 ${Math.floor(daysSinceBackup)} 天沒備份了。`}
          </span>
          <button className="btn" onClick={exportBackup}>匯出備份</button>
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="num">{data.due}</div>
          <div className="label">今日待複習</div>
        </div>
        <div className="stat">
          <div className="num">{data.streak}</div>
          <div className="label">連續天數</div>
        </div>
        <div className="stat">
          <div className="num">{data.introducedVocab}</div>
          <div className="label">已學詞數</div>
        </div>
      </div>

      <button
        className="cta"
        disabled={total === 0}
        onClick={() => (window.location.hash = '#/review')}
      >
        {total > 0 ? `開始複習(${total} 張)` : '今日完成!明天再來 🍡'}
      </button>
      {total === 0 && (
        <p className="muted" style={{ textAlign: 'center', marginTop: -6 }}>
          沒有到期的卡片,新卡片也達到今日上限了。
        </p>
      )}

      <div className="card module">
        <div>
          <h3>🌸 五十音</h3>
          <div className="sub">已開始練習 {data.learnedKana} / {KANA_TOTAL} 個假名</div>
        </div>
        <Link to="/kana">假名表 →</Link>
      </div>

      <div className="card module">
        <div>
          <h3>📚 單字 {data.settings.vocabUnlocked ? '' : '🔒'}</h3>
          <div className="sub">
            {data.settings.vocabUnlocked
              ? `已引入 ${data.introducedVocab} / ${VOCAB.length + THEME_VOCAB.length} 詞,今日新詞 +${data.newVocab}`
              : '通過五十音檢定後解鎖'}
          </div>
        </div>
        {data.settings.vocabUnlocked ? (
          <Link to="/vocab">詞庫進度 →</Link>
        ) : (
          <Link to="/gate" className="lock">前往檢定 →</Link>
        )}
      </div>

      <div className="card module">
        <div>
          <h3>💬 日常用語 {data.sentUnlocked ? '' : '🔒'}</h3>
          <div className="sub">
            {!data.settings.vocabUnlocked
              ? '先通過五十音檢定,解鎖單字後再來'
              : sentWanted
                ? `已引入 ${data.introducedSent} 句,每日新句 +${data.newSent}`
                : `再練 ${kanaToGo} 個假名,日常用語就會出現`}
          </div>
        </div>
        {sentWanted ? (
          <span className="lock">已融入每日複習 ✓</span>
        ) : (
          <Link to="/kana" className="lock">練假名 →</Link>
        )}
      </div>
    </>
  )
}
