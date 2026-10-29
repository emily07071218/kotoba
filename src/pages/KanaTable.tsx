import { useEffect, useState } from 'react'
import { db } from '../db'
import { HIRAGANA, KATAKANA } from '../data/kana'
import type { KanaType } from '../types'

const GROUPS: { key: 'gojuon' | 'dakuten' | 'yoon'; title: string }[] = [
  { key: 'gojuon', title: '五十音(清音)' },
  { key: 'dakuten', title: '濁音・半濁音' },
  { key: 'yoon', title: '拗音' }
]

export default function KanaTable() {
  const [ktype, setKtype] = useState<KanaType>('hiragana')
  const [learned, setLearned] = useState<Set<number>>(new Set())

  useEffect(() => {
    let alive = true
    ;(async () => {
      const cards = await db.cards.where('type').equals('kana').toArray()
      if (alive) setLearned(new Set(cards.filter((c) => c.reps > 0).map((c) => c.refId)))
    })()
    return () => {
      alive = false
    }
  }, [])

  const list = ktype === 'hiragana' ? HIRAGANA : KATAKANA

  return (
    <>
      <h1>五十音表</h1>
      <p className="muted">底色標記的是你已經練習過的假名。</p>
      <div className="row">
        <div>
          <button className={`btn ${ktype === 'hiragana' ? 'primary' : 'ghost'}`} onClick={() => setKtype('hiragana')}>平假名</button>{' '}
          <button className={`btn ${ktype === 'katakana' ? 'primary' : 'ghost'}`} onClick={() => setKtype('katakana')}>片假名</button>
        </div>
      </div>
      {GROUPS.map((g) => {
        const rows = [...new Set(list.filter((k) => k.group === g.key).map((k) => k.row))]
        return (
          <section key={g.key}>
            <div className="group-title">{g.title}</div>
            {rows.map((row) => (
              <div className="kanatable" key={row} style={{ marginBottom: 6 }}>
                {list
                  .filter((k) => k.row === row)
                  .map((k) => (
                    <div key={k.id} className={`kanacell ${learned.has(k.id) ? 'learned' : ''}`}>
                      <div className="k jp">{k.kana}</div>
                      <div className="r">{k.romaji[0]}</div>
                    </div>
                  ))}
              </div>
            ))}
          </section>
        )
      })}
    </>
  )
}
