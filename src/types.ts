import type { State } from 'ts-fsrs'

// ---------- 五十音 ----------

export type KanaType = 'hiragana' | 'katakana'
export type KanaGroup = 'gojuon' | 'dakuten' | 'yoon'

export interface Kana {
  id: number
  kana: string
  /** 可接受的羅馬字,第一個為主要顯示用 */
  romaji: string[]
  ktype: KanaType
  group: KanaGroup
  row: string
  /** 學習順序 */
  seq: number
}

// ---------- 單字(JLPT 詞庫由 scripts/build-vocab.mjs 產生;主題詞由 data/themes.ts 提供) ----------

export type JLPTLevel = 'N5' | 'N4'
export type Level = JLPTLevel | '生活'

export interface RubySegment {
  /** 基底文字 */
  s: string
  /** 上方注音,無則 null */
  r: string | null
}

export interface VocabExample {
  jp: string
  zh: string
}

export interface VocabEntry {
  /** JMdict ent_seq 或主題詞固定 id */
  id: number
  word: string
  reading: string
  level: Level
  meaningZh: string
  pos: string[]
  ruby?: RubySegment[]
  example?: VocabExample
  /** 主題詞所屬分類(月份、天氣……) */
  theme?: string
}

// ---------- 日常用語句子與短文 ----------

export type SentenceKind = 'phrase' | 'passage'

export interface SentenceEntry {
  id: number
  kind: SentenceKind
  jp: string
  zh: string
}

// ---------- 卡片與進度 ----------

export type CardType = 'kana' | 'vocab' | 'sent'

/** 存進 IndexedDB 的卡片(欄位與 ts-fsrs Card 對應,時間用 epoch ms) */
export interface Card {
  id?: number
  type: CardType
  refId: number
  createdAt: number
  due: number
  stability: number
  difficulty: number
  state: State
  step: number | null
  lastReview: number | null
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
}

export interface DailyLog {
  /** 本地日期 YYYY-MM-DD */
  date: string
  reviewed: number
  newIntro: number
}

export interface AppSettings {
  vocabNewPerDay: number
  kanaNewPerDay: number
  vocabUnlocked: boolean
  kanaGateSkipped: boolean
  /** 啟用的主題詞分類;null = 全部啟用 */
  enabledThemes: string[] | null
  lastBackupAt: number | null
  backupReminderDays: number
  ttsVoiceName: string | null
  ttsRate: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  vocabNewPerDay: 8,
  kanaNewPerDay: 12,
  vocabUnlocked: false,
  kanaGateSkipped: false,
  enabledThemes: null,
  lastBackupAt: null,
  backupReminderDays: 3,
  ttsVoiceName: null,
  ttsRate: 0.9
}

// ---------- 備份 ----------

export interface BackupFile {
  app: 'kotoba'
  schema: 1
  exportedAt: string
  settings: AppSettings | null
  cards: Card[]
  logs: DailyLog[]
}
