import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Rating, type Grade } from 'ts-fsrs'
import { getSettings } from '../db'
import { db } from '../db'
import { applyGrade, previewRepeat, toFsrs, toStored } from '../srs'
import { KANA_BY_ID } from '../data/kana'
import { SENT_BY_ID } from '../data/sentences'
import { buildSession, VOCAB_BY_ID, type SessionItem } from '../session'
import type { AppSettings, Card, Kana, SentenceEntry, VocabEntry } from '../types'
import { fmtInterval, localDateStr, shuffle as shuffleArr } from '../util'
import { speak } from '../tts'
import { RubyWord } from '../components/RubyWord'

interface McOptions {
  options: string[]
  correct: string
}

function kanaMc(correct: Kana, mode: 'h2r' | 'r2h'): McOptions {
  const pool = KANA_ALL_POOL.filter((k) => k.ktype === correct.ktype && k.id !== correct.id)
  const ordered = [
    ...shuffleArr(pool.filter((k) => k.row === correct.row)),
    ...shuffleArr(pool.filter((k) => k.row !== correct.row))
  ]
  const correctVal = mode === 'h2r' ? correct.romaji[0] : correct.kana
  const seen = new Set([correctVal])
  const distractors: string[] = []
  for (const k of ordered) {
    if (distractors.length >= 3) break
    const val = mode === 'h2r' ? k.romaji[0] : k.kana
    if (seen.has(val)) continue
    seen.add(val)
    distractors.push(val)
  }
  return { options: shuffleArr([correctVal, ...distractors]), correct: correctVal }
}

function vocabMc(correct: VocabEntry, mode: 'j2z' | 'z2j'): McOptions {
  // 主題詞的同類干擾項優先;JLPT 詞用同層級干擾
  const pool = VOCAB_POOL.filter(
    (v) =>
      v.id !== correct.id &&
      (correct.theme
        ? v.theme === correct.theme
        : v.level === correct.level && !v.theme)
  )
  const correctVal = mode === 'j2z' ? correct.meaningZh : correct.word
  const seen = new Set([correctVal])
  const distractors: string[] = []
  for (const v of shuffleArr(pool)) {
    if (distractors.length >= 3) break
    const val = mode === 'j2z' ? v.meaningZh : v.word
    if (seen.has(val)) continue
    seen.add(val)
    distractors.push(val)
  }
  return { options: shuffleArr([correctVal, ...distractors]), correct: correctVal }
}

function sentMc(correct: SentenceEntry): McOptions {
  const pool = SENT_POOL.filter((s) => s.kind === 'phrase' && s.id !== correct.id)
  const correctVal = correct.zh
  const seen = new Set([correctVal])
  const distractors: string[] = []
  for (const s of shuffleArr(pool)) {
    if (distractors.length >= 3) break
    if (seen.has(s.zh)) continue
    seen.add(s.zh)
    distractors.push(s.zh)
  }
  return { options: shuffleArr([correctVal, ...distractors]), correct: correctVal }
}

const KANA_ALL_POOL = [...KANA_BY_ID.values()].sort((a, b) => a.seq - b.seq)
const VOCAB_POOL = [...VOCAB_BY_ID.values()]
const SENT_POOL = [...SENT_BY_ID.values()]

const RATING_BTNS = [
  { grade: Rating.Again, label: '忘記', cls: 'again' },
  { grade: Rating.Hard, label: '困難', cls: 'hard' },
  { grade: Rating.Good, label: '良好', cls: 'good' },
  { grade: Rating.Easy, label: '簡單', cls: 'easy' }
] as const

export default function Review() {
  const [items, setItems] = useState<SessionItem[] | null>(null)
  const [dueSoon, setDueSoon] = useState(0)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [selected, setSelected] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [hintLen, setHintLen] = useState(0)
  const [wasCorrect, setWasCorrect] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const startedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ;(async () => {
      const s = await getSettings()
      setSettings(s)
      const r = await buildSession(s)
      setItems(r.items)
      setDueSoon(r.dueSoon)
    })()
  }, [])

  const item = items && idx < items.length ? items[idx] : null
  const entry: Kana | VocabEntry | SentenceEntry | undefined = item
    ? item.stored.type === 'kana'
      ? KANA_BY_ID.get(item.stored.refId)
      : item.stored.type === 'vocab'
        ? VOCAB_BY_ID.get(item.stored.refId)
        : SENT_BY_ID.get(item.stored.refId)
    : undefined
  const fsrsCard = useMemo(() => (item ? toFsrs(item.stored) : null), [item])

  const mc = useMemo<McOptions | null>(() => {
    if (!item || !entry) return null
    switch (item.kind) {
      case 'kana_h2r_mc':
        return kanaMc(entry as Kana, 'h2r')
      case 'kana_r2h_mc':
        return kanaMc(entry as Kana, 'r2h')
      case 'vocab_j2z_mc':
        return vocabMc(entry as VocabEntry, 'j2z')
      case 'vocab_z2j_mc':
        return vocabMc(entry as VocabEntry, 'z2j')
      case 'sent_j2z_mc':
        return sentMc(entry as SentenceEntry)
      default:
        return null
    }
  }, [item, entry])

  const ratingPreview = useMemo(() => {
    if (!item || !fsrsCard || phase !== 'back') return null
    const now = new Date()
    const log = previewRepeat(fsrsCard, now)
    return RATING_BTNS.map((r) => ({
      ...r,
      interval: fmtInterval((log[r.grade].card.due.getTime() - now.getTime()) / 1000)
    }))
  }, [item, fsrsCard, phase])

  // 假名輸入題自動聚焦;換卡時重設提示
  useEffect(() => {
    setHintLen(0)
    if (item?.kind === 'kana_type' && phase === 'front') inputRef.current?.focus()
  }, [item, phase])

  // 日→中 題目自動發音(單字與句子)
  useEffect(() => {
    if (!item || !settings || phase !== 'front') return
    if (item.kind === 'vocab_j2z_mc' && entry && 'word' in entry) {
      speak(entry.word, { voiceName: settings.ttsVoiceName, rate: settings.ttsRate })
    } else if (
      (item.kind === 'sent_j2z_mc' || item.kind === 'sent_read') &&
      entry &&
      'jp' in entry
    ) {
      speak(entry.jp, { voiceName: settings.ttsVoiceName, rate: settings.ttsRate })
    }
  }, [item, phase, settings, entry])

  function answerMc(val: string) {
    if (phase !== 'front' || !mc) return
    setSelected(val)
    setWasCorrect(val === mc.correct)
    setScore((s) => ({ correct: s.correct + (val === mc.correct ? 1 : 0), total: s.total + 1 }))
    setPhase('back')
  }

  function submitType(e: FormEvent | KeyboardEvent) {
    e.preventDefault()
    if (phase !== 'front' || !entry || !('romaji' in entry)) return
    const norm = typed.trim().toLowerCase()
    if (!norm) return
    const ok = entry.romaji.some((r) => r === norm)
    setWasCorrect(ok)
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }))
    setPhase('back')
  }

  async function rate(grade: Grade) {
    if (!item || !fsrsCard) return
    const result = applyGrade(fsrsCard, grade, new Date())
    const stored: Card = toStored(
      result.card,
      item.stored.type,
      item.stored.refId,
      item.stored.createdAt
    )
    stored.id = item.stored.id
    await db.cards.put(stored)

    const dateStr = localDateStr()
    const logRow = (await db.logs.get(dateStr)) ?? { date: dateStr, reviewed: 0, newIntro: 0 }
    logRow.reviewed++
    if (item.isNew) logRow.newIntro++
    await db.logs.put(logRow)

    setSelected(null)
    setTyped('')
    setPhase('front')
    setIdx((i) => i + 1)
  }

  if (!items) return <p className="muted">準備中…</p>

  if (items.length === 0) {
    return (
      <div className="card centerbox">
        <h2>目前沒有待複習的卡片</h2>
        <p className="muted">明天再來,或先去五十音表逛逛。</p>
        <Link className="btn primary" to="/">回主頁</Link>
      </div>
    )
  }

  if (idx >= items.length) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    return (
      <div className="card centerbox">
        <h2>今日複習完成!</h2>
        <p className="bignum">{pct}%</p>
        <p className="muted">共 {score.total} 張,答對 {score.correct} 張</p>
        {dueSoon > 0 && (
          <p className="muted">還有 {dueSoon} 張卡片會在一小時內到期,晚點再回來效果最好。</p>
        )}
        <Link className="btn primary" to="/">回主頁</Link>
      </div>
    )
  }

  if (!item) return null

  // 資料集更新後舊卡片可能找不到對應條目,提供手動跳過
  if (!entry) {
    return (
      <div className="card centerbox">
        <p className="muted">這張卡片的資料已不存在。</p>
        <button className="btn" onClick={() => setIdx((i) => i + 1)}>略過</button>
      </div>
    )
  }

  const isKana = 'romaji' in entry
  const isSent = !isKana && 'jp' in entry
  const kanaEntry = isKana ? (entry as Kana) : null
  const vocabEntry = isKana || isSent ? null : (entry as VocabEntry)
  const sentEntry = isSent ? (entry as SentenceEntry) : null

  return (
    <>
      <div className="review-head">
        <span className="pos">
          第 {idx + 1} / {items.length} 張 · {item.isNew ? '新卡片' : '複習'}
        </span>
        <Link to="/">離開</Link>
      </div>
      <div className="progressbar">
        <div style={{ width: `${(idx / items.length) * 100}%` }} />
      </div>

      <div className="card quizcard">
        {phase === 'front' && (
          <>
            {item.kind === 'kana_h2r_mc' && kanaEntry && (
              <>
                <div className="q-label">這個假名怎麼唸?</div>
                <div className="kana-big jp">{kanaEntry.kana}</div>
              </>
            )}
            {item.kind === 'kana_r2h_mc' && kanaEntry && (
              <>
                <div className="q-label">哪一個假名是這個音?</div>
                <div className="kana-big">{kanaEntry.romaji[0]}</div>
              </>
            )}
            {item.kind === 'kana_type' && kanaEntry && (
              <>
                <div className="q-label">打出這個假名的羅馬字</div>
                <div className="kana-big jp">{kanaEntry.kana}</div>
                {hintLen > 0 && (
                  <div className="hint">
                    提示:{kanaEntry.romaji[0].slice(0, hintLen).toUpperCase()}
                    {'·'.repeat(Math.max(0, kanaEntry.romaji[0].length - hintLen))}
                  </div>
                )}
                <form className="typeform" onSubmit={submitType}>
                  <input
                    ref={inputRef}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      // 不依賴瀏覽器的隱式表單送出(某些環境不會觸發)
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        submitType(e)
                      }
                    }}
                    placeholder="romaji"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <button className="btn primary" type="submit">送出</button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() =>
                      setHintLen((n) => Math.min(n + 1, kanaEntry.romaji[0].length))
                    }
                  >
                    提示
                  </button>
                </form>
              </>
            )}
            {item.kind === 'vocab_j2z_mc' && vocabEntry && (
              <>
                <div className="q-label">這個日文詞是什麼意思?</div>
                <div className="word-big jp">
                  <RubyWord entry={vocabEntry} />
                  <button
                    className="ttsbtn"
                    onClick={() =>
                      speak(vocabEntry.word, {
                        voiceName: settings?.ttsVoiceName,
                        rate: settings?.ttsRate
                      })
                    }
                    title="發音"
                  >🔊</button>
                </div>
                <div className="word-reading jp">{vocabEntry.reading}</div>
              </>
            )}
            {item.kind === 'vocab_z2j_mc' && vocabEntry && (
              <>
                <div className="q-label">「{vocabEntry.meaningZh}」的日文是?</div>
                <div className="meaning-big">{vocabEntry.meaningZh}</div>
                {vocabEntry.pos.length > 0 && (
                  <div className="pos-tags">
                    {vocabEntry.pos.map((p, i) => <span key={i}>{p}</span>)}
                  </div>
                )}
              </>
            )}

            {item.kind === 'sent_j2z_mc' && sentEntry && (
              <>
                <div className="q-label">這句話是什麼意思?</div>
                <div className="sent-jp jp">
                  {sentEntry.jp}
                  <button
                    className="ttsbtn"
                    onClick={() =>
                      speak(sentEntry.jp, {
                        voiceName: settings?.ttsVoiceName,
                        rate: settings?.ttsRate
                      })
                    }
                  >🔊</button>
                </div>
              </>
            )}
            {item.kind === 'sent_read' && sentEntry && (
              <>
                <div className="q-label">朗讀這段話,再對照中文</div>
                <div className="sent-jp jp">
                  {sentEntry.jp}
                  <button
                    className="ttsbtn"
                    onClick={() =>
                      speak(sentEntry.jp, {
                        voiceName: settings?.ttsVoiceName,
                        rate: settings?.ttsRate
                      })
                    }
                  >🔊</button>
                </div>
                <button
                  className="btn primary"
                  style={{ marginTop: 18 }}
                  onClick={() => setPhase('back')}
                >
                  顯示中文翻譯
                </button>
              </>
            )}

            {mc && (
              <div className="options">
                {mc.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => answerMc(opt)}
                    className={item.kind === 'kana_r2h_mc' ? 'jp' : ''}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {phase === 'back' && (
          <>
            {isKana && kanaEntry ? (
              <>
                <div className="kana-big jp">{kanaEntry.kana}</div>
                <div className="meaning-big">{kanaEntry.romaji.join(' / ')}</div>
                <div className="muted">{kanaEntry.row}({kanaEntry.ktype === 'hiragana' ? '平假名' : '片假名'})</div>
                <button
                  className="ttsbtn"
                  onClick={() => speak(kanaEntry.kana, { voiceName: settings?.ttsVoiceName, rate: settings?.ttsRate })}
                >🔊</button>
              </>
            ) : sentEntry ? (
              <>
                <div className="sent-jp jp">
                  {sentEntry.jp}
                  <button
                    className="ttsbtn"
                    onClick={() =>
                      speak(sentEntry.jp, {
                        voiceName: settings?.ttsVoiceName,
                        rate: settings?.ttsRate
                      })
                    }
                  >🔊</button>
                </div>
                <div className="meaning-big">{sentEntry.zh}</div>
              </>
            ) : (
              vocabEntry && (
                <>
                  <div className="word-big jp">
                    <RubyWord entry={vocabEntry} />
                    <button
                      className="ttsbtn"
                      onClick={() => speak(vocabEntry.word, { voiceName: settings?.ttsVoiceName, rate: settings?.ttsRate })}
                    >🔊</button>
                  </div>
                  <div className="word-reading jp">{vocabEntry.reading}</div>
                  <div className="meaning-big">{vocabEntry.meaningZh}</div>
                  {vocabEntry.example && (
                    <div className="example">
                      <div className="jp">{vocabEntry.example.jp}</div>
                      <div className="zh">{vocabEntry.example.zh}</div>
                    </div>
                  )}
                </>
              )
            )}
            {item.kind !== 'sent_read' && (
              <div className={`feedback ${wasCorrect ? 'ok' : 'bad'}`}>
                {wasCorrect ? '✓ 答對了' : '✗ 答錯了'}
                {!wasCorrect && mc && ` — 正確答案:${mc.correct}`}
              </div>
            )}
            {ratingPreview && (
              <div className="ratings">
                {ratingPreview.map((r) => (
                  <button key={r.grade} className={r.cls} onClick={() => rate(r.grade)}>
                    {r.label}
                    <small>{r.interval}</small>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
