import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
  type IPreview,
  type RecordLogItem
} from 'ts-fsrs'
import type { Card, CardType } from './types'

const params = generatorParameters({ enable_fuzz: true })
export const scheduler = fsrs(params)

export function createNewCard(now: Date = new Date()): FsrsCard {
  return createEmptyCard(now)
}

/** 用既有卡片狀態跑一次排程,取得四個評分的結果(以 Grade 為鍵的物件) */
export function previewRepeat(card: FsrsCard, now: Date = new Date()): IPreview {
  return scheduler.repeat(card, now)
}

export function applyGrade(
  card: FsrsCard,
  grade: Grade,
  now: Date = new Date()
): RecordLogItem {
  return scheduler.repeat(card, now)[grade]
}

// ---- Card(儲存格式) <-> ts-fsrs Card 轉換 ----

export function toStored(fsrs: FsrsCard, type: CardType, refId: number, createdAt: number): Card {
  return {
    type,
    refId,
    createdAt,
    due: fsrs.due.getTime(),
    stability: fsrs.stability,
    difficulty: fsrs.difficulty,
    state: fsrs.state,
    step: fsrs.learning_steps ?? 0,
    lastReview: fsrs.last_review ? fsrs.last_review.getTime() : null,
    elapsedDays: fsrs.elapsed_days,
    scheduledDays: fsrs.scheduled_days,
    reps: fsrs.reps,
    lapses: fsrs.lapses
  }
}

export function toFsrs(c: Card): FsrsCard {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    learning_steps: c.step ?? 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.lastReview ? new Date(c.lastReview) : undefined
  }
}
