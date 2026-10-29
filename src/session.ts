import { State } from 'ts-fsrs'
import { db } from './db'
import { createNewCard, toFsrs, toStored } from './srs'
import { KANA_ALL, KANA_BY_ID } from './data/kana'
import vocabData from './data/vocab.json'
import type { AppSettings, Card, VocabEntry } from './types'
import { pickRandom, startOfToday } from './util'

export const VOCAB = vocabData as unknown as VocabEntry[]
export const VOCAB_BY_ID = new Map<number, VocabEntry>(VOCAB.map((v) => [v.id, v]))

export type QuizKind =
  | 'kana_h2r_mc'
  | 'kana_r2h_mc'
  | 'kana_type'
  | 'vocab_j2z_mc'
  | 'vocab_z2j_mc'

export function pickKind(type: Card['type']): QuizKind {
  return type === 'kana'
    ? pickRandom<QuizKind>(['kana_h2r_mc', 'kana_type', 'kana_r2h_mc'])
    : pickRandom<QuizKind>(['vocab_j2z_mc', 'vocab_z2j_mc'])
}

export interface SessionItem {
  stored: Card
  kind: QuizKind
  isNew: boolean
}

export interface Availability {
  due: number
  newKana: number
  newVocab: number
  learnedKana: number
  introducedVocab: number
}

/** 目前可複習/可學的量(不寫入任何資料) */
export async function availability(settings: AppSettings): Promise<Availability> {
  const all = await db.cards.toArray()
  const now = Date.now()
  const dayStart = startOfToday()
  const haveKana = new Set(all.filter((c) => c.type === 'kana').map((c) => c.refId))
  const haveVocab = new Set(all.filter((c) => c.type === 'vocab').map((c) => c.refId))
  const kanaToday = all.filter((c) => c.type === 'kana' && c.createdAt >= dayStart).length
  const vocabToday = all.filter((c) => c.type === 'vocab' && c.createdAt >= dayStart).length
  const kanaPoolLeft = KANA_ALL.filter((k) => !haveKana.has(k.id)).length
  const vocabPoolLeft = settings.vocabUnlocked
    ? VOCAB.filter((v) => !haveVocab.has(v.id)).length
    : 0
  return {
    due: all.filter((c) => c.state !== State.New && c.due <= now).length,
    newKana:
      all.filter((c) => c.type === 'kana' && c.state === State.New).length +
      Math.max(0, Math.min(settings.kanaNewPerDay - kanaToday, kanaPoolLeft)),
    newVocab: settings.vocabUnlocked
      ? all.filter((c) => c.type === 'vocab' && c.state === State.New).length +
        Math.max(0, Math.min(settings.vocabNewPerDay - vocabToday, vocabPoolLeft))
      : 0,
    learnedKana: all.filter((c) => c.type === 'kana' && c.reps > 0).length,
    introducedVocab: all.filter((c) => c.type === 'vocab').length
  }
}

/** 建立今日複習佇列:新卡片先(建立即算引入),再接到期卡片 */
export async function buildSession(
  settings: AppSettings
): Promise<{ items: SessionItem[]; dueSoon: number }> {
  const now = Date.now()
  const dayStart = startOfToday()
  const all = await db.cards.toArray()
  const haveKana = new Set(all.filter((c) => c.type === 'kana').map((c) => c.refId))
  const haveVocab = new Set(all.filter((c) => c.type === 'vocab').map((c) => c.refId))
  const kanaToday = all.filter((c) => c.type === 'kana' && c.createdAt >= dayStart).length
  const vocabToday = all.filter((c) => c.type === 'vocab' && c.createdAt >= dayStart).length

  const kanaQuota = Math.max(0, settings.kanaNewPerDay - kanaToday)
  const vocabQuota = settings.vocabUnlocked
    ? Math.max(0, settings.vocabNewPerDay - vocabToday)
    : 0

  const kanaPool = KANA_ALL.filter((k) => !haveKana.has(k.id)).sort((a, b) => a.seq - b.seq)
  // vocab.json 建置時已排好 N5 → N4、id 升冪
  const vocabPool = (settings.vocabUnlocked ? VOCAB : []).filter(
    (v) => !haveVocab.has(v.id)
  )

  const nowDate = new Date(now)
  const newCards: Card[] = []
  for (const k of kanaPool.slice(0, kanaQuota)) {
    newCards.push(toStored(createNewCard(nowDate), 'kana', k.id, now))
  }
  for (const v of vocabPool.slice(0, vocabQuota)) {
    newCards.push(toStored(createNewCard(nowDate), 'vocab', v.id, now))
  }
  if (newCards.length > 0) {
    try {
      const ids = (await db.cards.bulkAdd(newCards, { allKeys: true })) as number[]
      newCards.forEach((c, i) => {
        c.id = ids[i]
      })
    } catch {
      // 另一個分頁可能已建立同樣的卡片;下面補齊 id
    }
    const missing = newCards.filter((c) => c.id === undefined)
    if (missing.length > 0) {
      const existing = await db.cards.toArray()
      const map = new Map(existing.map((c) => [`${c.type}:${c.refId}`, c.id!]))
      for (const c of missing) c.id = map.get(`${c.type}:${c.refId}`)
    }
  }
  const usableNew = newCards.filter((c) => c.id !== undefined)

  const dueCards = all
    .filter((c) => c.state !== State.New && c.due <= now)
    .sort((a, b) => a.due - b.due)
    .filter((c) =>
      c.type === 'kana' ? KANA_BY_ID.has(c.refId) : VOCAB_BY_ID.has(c.refId)
    )

  const items: SessionItem[] = [
    // 今天稍早建立、還沒評過分的新卡片,繼續學完
    ...all
      .filter((c) => c.state === State.New)
      .filter((c) =>
        c.type === 'kana' ? KANA_BY_ID.has(c.refId) : VOCAB_BY_ID.has(c.refId)
      )
      .map((stored) => ({ stored, kind: pickKind(stored.type), isNew: true })),
    ...usableNew.map((stored) => ({ stored, kind: pickKind(stored.type), isNew: true })),
    ...dueCards.map((stored) => ({ stored, kind: pickKind(stored.type), isNew: false }))
  ]

  const dueSoon = all.filter(
    (c) => c.state !== State.New && c.due > now && c.due <= now + 3600_000
  ).length

  return { items, dueSoon }
}
