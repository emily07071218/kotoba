import { State } from 'ts-fsrs'
import { db } from './db'
import { createNewCard, toFsrs, toStored } from './srs'
import { KANA_ALL, KANA_BY_ID } from './data/kana'
import vocabData from './data/vocab.json'
import { THEME_VOCAB, THEMES } from './data/themes'
import { SENT_BY_ID } from './data/sentences'
import type { AppSettings, Card, SentenceEntry, VocabEntry } from './types'
import { pickRandom, startOfToday } from './util'

export const VOCAB = vocabData as unknown as VocabEntry[]

/** 主題詞是否啟用(null = 全部啟用) */
function themeEnabled(settings: AppSettings, theme: string): boolean {
  return settings.enabledThemes === null || settings.enabledThemes.includes(theme)
}

/** 單字引入順序:啟用的主題詞 → N5 → N4 */
export function vocabPool(settings: AppSettings): VocabEntry[] {
  const activeThemes = new Set(THEMES.filter((t) => themeEnabled(settings, t.name)).map((t) => t.name))
  return [
    ...THEME_VOCAB.filter((v) => activeThemes.has(v.theme ?? '')),
    ...VOCAB
  ]
}

export const VOCAB_BY_ID = new Map<number, VocabEntry>(
  [...THEME_VOCAB, ...VOCAB].map((v) => [v.id, v])
)

// ---------- 句子 ----------

export const SENT_PER_DAY = 3
/** 五十音練習超過這個數(加上通過檢定),日常用語解鎖 */
export const SENT_KANA_THRESHOLD = 60

export function sentUnlocked(settings: AppSettings, learnedKana: number): boolean {
  return settings.vocabUnlocked && (settings.kanaGateSkipped || learnedKana >= SENT_KANA_THRESHOLD)
}

// ---------- 測驗型態 ----------

export type QuizKind =
  | 'kana_h2r_mc'
  | 'kana_r2h_mc'
  | 'kana_type'
  | 'vocab_j2z_mc'
  | 'vocab_z2j_mc'
  | 'sent_j2z_mc'
  | 'sent_read'

export function pickKind(type: Card['type'], refId?: number): QuizKind {
  if (type === 'sent') {
    const s = refId !== undefined ? SENT_BY_ID.get(refId) : undefined
    return s?.kind === 'passage' ? 'sent_read' : 'sent_j2z_mc'
  }
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
  newSent: number
  learnedKana: number
  introducedVocab: number
  introducedSent: number
  sentUnlocked: boolean
}

function countBy<T>(arr: T[], pred: (x: T) => boolean): number {
  return arr.filter(pred).length
}

/** 目前可複習/可學的量(不寫入任何資料) */
export async function availability(settings: AppSettings): Promise<Availability> {
  const all = await db.cards.toArray()
  const now = Date.now()
  const dayStart = startOfToday()
  const haveKana = new Set(all.filter((c) => c.type === 'kana').map((c) => c.refId))
  const haveVocab = new Set(all.filter((c) => c.type === 'vocab').map((c) => c.refId))
  const kanaToday = countBy(all, (c) => c.type === 'kana' && c.createdAt >= dayStart)
  const vocabToday = countBy(all, (c) => c.type === 'vocab' && c.createdAt >= dayStart)
  const sentToday = countBy(all, (c) => c.type === 'sent' && c.createdAt >= dayStart)
  const learnedKana = countBy(all, (c) => c.type === 'kana' && c.reps > 0)
  const unlockedSent = sentUnlocked(settings, learnedKana)
  const kanaPoolLeft = KANA_ALL.filter((k) => !haveKana.has(k.id)).length
  const vocabPoolLeft = settings.vocabUnlocked
    ? vocabPool(settings).filter((v) => !haveVocab.has(v.id)).length
    : 0
  const sentPoolLeft = unlockedSent
    ? SENT_BY_ID.size - all.filter((c) => c.type === 'sent').length
    : 0
  return {
    due: countBy(all, (c) => c.state !== State.New && c.due <= now),
    newKana:
      countBy(all, (c) => c.type === 'kana' && c.state === State.New) +
      Math.max(0, Math.min(settings.kanaNewPerDay - kanaToday, kanaPoolLeft)),
    newVocab: settings.vocabUnlocked
      ? countBy(all, (c) => c.type === 'vocab' && c.state === State.New) +
        Math.max(0, Math.min(settings.vocabNewPerDay - vocabToday, vocabPoolLeft))
      : 0,
    newSent: unlockedSent
      ? countBy(all, (c) => c.type === 'sent' && c.state === State.New) +
        Math.max(0, Math.min(SENT_PER_DAY - sentToday, sentPoolLeft))
      : 0,
    learnedKana,
    introducedVocab: countBy(all, (c) => c.type === 'vocab'),
    introducedSent: countBy(all, (c) => c.type === 'sent'),
    sentUnlocked: unlockedSent
  }
}

function entryExists(c: Card): boolean {
  if (c.type === 'kana') return KANA_BY_ID.has(c.refId)
  if (c.type === 'vocab') return VOCAB_BY_ID.has(c.refId)
  return SENT_BY_ID.has(c.refId)
}

function kindOf(c: Card): QuizKind {
  return pickKind(c.type, c.refId)
}

/** 建立今日複習佇列:新卡片先(建立即算引入),再接到期卡片 */
export async function buildSession(
  settings: AppSettings
): Promise<{ items: SessionItem[]; dueSoon: number }> {
  const now = Date.now()
  const dayStart = startOfToday()
  const all = await db.cards.toArray()
  const learnedKana = countBy(all, (c) => c.type === 'kana' && c.reps > 0)
  const unlockedSent = sentUnlocked(settings, learnedKana)
  const haveKana = new Set(all.filter((c) => c.type === 'kana').map((c) => c.refId))
  const haveVocab = new Set(all.filter((c) => c.type === 'vocab').map((c) => c.refId))
  const haveSent = new Set(all.filter((c) => c.type === 'sent').map((c) => c.refId))
  const kanaToday = countBy(all, (c) => c.type === 'kana' && c.createdAt >= dayStart)
  const vocabToday = countBy(all, (c) => c.type === 'vocab' && c.createdAt >= dayStart)
  const sentToday = countBy(all, (c) => c.type === 'sent' && c.createdAt >= dayStart)

  const kanaQuota = Math.max(0, settings.kanaNewPerDay - kanaToday)
  const vocabQuota = settings.vocabUnlocked
    ? Math.max(0, settings.vocabNewPerDay - vocabToday)
    : 0
  const sentQuota = unlockedSent ? Math.max(0, SENT_PER_DAY - sentToday) : 0

  const kanaPool = KANA_ALL.filter((k) => !haveKana.has(k.id)).sort((a, b) => a.seq - b.seq)
  // vocab.json 已排好 N5 → N4;vocabPool() 已把啟用的主題詞排最前面
  const vPool = settings.vocabUnlocked ? vocabPool(settings) : []
  const vocabPoolFiltered = vPool.filter((v) => !haveVocab.has(v.id))
  const sentPoolFiltered = [...SENT_BY_ID.values()].filter((s) => !haveSent.has(s.id))

  const nowDate = new Date(now)
  const newCards: Card[] = []
  for (const k of kanaPool.slice(0, kanaQuota)) {
    newCards.push(toStored(createNewCard(nowDate), 'kana', k.id, now))
  }
  for (const v of vocabPoolFiltered.slice(0, vocabQuota)) {
    newCards.push(toStored(createNewCard(nowDate), 'vocab', v.id, now))
  }
  for (const s of sentPoolFiltered.slice(0, sentQuota)) {
    newCards.push(toStored(createNewCard(nowDate), 'sent', s.id, now))
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
    .filter(entryExists)

  const items: SessionItem[] = [
    // 今天稍早建立、還沒評過分的新卡片,繼續學完
    ...all
      .filter((c) => c.state === State.New)
      .filter(entryExists)
      .map((stored) => ({ stored, kind: kindOf(stored), isNew: true })),
    ...usableNew.map((stored) => ({ stored, kind: kindOf(stored), isNew: true })),
    ...dueCards.map((stored) => ({ stored, kind: kindOf(stored), isNew: false }))
  ]

  const dueSoon = all.filter(
    (c) => c.state !== State.New && c.due > now && c.due <= now + 3600_000
  ).length

  return { items, dueSoon }
}

export type { SentenceEntry, VocabEntry }
