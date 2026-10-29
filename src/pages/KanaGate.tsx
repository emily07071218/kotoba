import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSettings, saveSettings } from '../db'
import { KANA_ALL } from '../data/kana'
import type { AppSettings, Kana } from '../types'
import { shuffle as shuffleArr } from '../util'

const QUESTIONS = 20
const PASS = 16

interface GateQuestion {
  kana: Kana
  mode: 'h2r' | 'r2h'
  options: string[]
  correct: string
}

function buildQuestions(): GateQuestion[] {
  return shuffleArr(KANA_ALL)
    .slice(0, QUESTIONS)
    .map((kana) => {
      const mode = Math.random() < 0.5 ? 'h2r' : 'r2h'
      const pool = KANA_ALL.filter((k) => k.ktype === kana.ktype && k.id !== kana.id)
      const correct = mode === 'h2r' ? kana.romaji[0] : kana.kana
      const seen = new Set([correct])
      const distractors: string[] = []
      for (const k of shuffleArr(pool)) {
        if (distractors.length >= 3) break
        const val = mode === 'h2r' ? k.romaji[0] : k.kana
        if (seen.has(val)) continue
        seen.add(val)
        distractors.push(val)
      }
      return { kana, mode, correct, options: shuffleArr([correct, ...distractors]) }
    })
}

export default function KanaGate() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [questions, setQuestions] = useState<GateQuestion[] | null>(null)
  const [qidx, setQidx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    ;(async () => {
      const s = await getSettings()
      setSettings(s)
    })()
  }, [])

  const unlocked = settings?.vocabUnlocked ?? false

  function start() {
    setQuestions(buildQuestions())
    setQidx(0)
    setScore(0)
    setDone(false)
    setPicked(null)
  }

  async function answer(val: string) {
    if (picked !== null || !questions) return
    setPicked(val)
    const ok = val === questions[qidx].correct
    const newScore = score + (ok ? 1 : 0)
    setScore(newScore)
    setTimeout(async () => {
      if (qidx + 1 >= questions.length) {
        setDone(true)
        if (newScore >= PASS) {
          const s = await getSettings()
          s.vocabUnlocked = true
          await saveSettings(s)
          setSettings(s)
        }
      } else {
        setQidx((i) => i + 1)
        setPicked(null)
      }
    }, 380)
  }

  async function skipGate() {
    const s = await getSettings()
    s.vocabUnlocked = true
    s.kanaGateSkipped = true
    await saveSettings(s)
    setSettings(s)
  }

  const current = questions && qidx < questions.length ? questions[qidx] : null
  const passed = score >= PASS

  return (
    <>
      <h1>五十音檢定</h1>
      {settings === null ? (
        <p className="muted">載入中…</p>
      ) : unlocked && !done ? (
        <div className="card centerbox">
          <h2>單字功能已解鎖</h2>
          <p className="muted">
            {settings.kanaGateSkipped
              ? '你是用「跳過」解鎖的。假名還不熟的話,建議還是考一次。'
              : '你已通過檢定。'}
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn primary" to="/">回主頁</Link>
            <button className="btn ghost" onClick={start}>再考一次</button>
          </div>
        </div>
      ) : !questions ? (
        <div className="card centerbox">
          <p>
            共 {QUESTIONS} 題,答對 {PASS} 題以上即通過,通過後解鎖單字功能。
            題目從整個假名表隨機出。
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={start}>開始檢定</button>
            <button className="btn ghost" onClick={skipGate}>跳過,直接解鎖</button>
          </div>
        </div>
      ) : done ? (
        <div className="card centerbox">
          <h2>{passed ? '通過!' : '差一點'}</h2>
          <p className="bignum">{score} / {QUESTIONS}</p>
          {passed ? (
            <>
              <p className="muted">單字功能已解鎖,新詞會從明天(或下次複習)開始加入。</p>
              <Link className="btn primary" to="/">回主頁</Link>
            </>
          ) : (
            <>
              <p className="muted">再多練幾輪假名,熟悉後再來。</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn primary" onClick={start}>再考一次</button>
                <Link className="btn ghost" to="/kana">看假名表</Link>
              </div>
            </>
          )}
        </div>
      ) : (
        current && (
          <>
            <div className="review-head">
              <span className="pos">第 {qidx + 1} / {questions.length} 題 · 目前 {score} 分</span>
            </div>
            <div className="card quizcard">
              <div className="q-label">
                {current.mode === 'h2r' ? '這個假名怎麼唸?' : '哪一個假名是這個音?'}
              </div>
              <div className={`kana-big ${current.mode === 'h2r' ? 'jp' : ''}`}>
                {current.mode === 'h2r' ? current.kana.kana : current.kana.romaji[0]}
              </div>
              <div className="options">
                {current.options.map((opt, i) => (
                  <button
                    key={i}
                    disabled={picked !== null}
                    className={[
                      picked !== null && opt === current.correct ? 'correct' : '',
                      picked === opt && opt !== current.correct ? 'wrong' : '',
                      current.mode === 'r2h' ? 'jp' : ''
                    ].join(' ')}
                    onClick={() => answer(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </>
        )
      )}
    </>
  )
}
