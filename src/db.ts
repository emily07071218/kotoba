import Dexie, { type Table } from 'dexie'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type Card,
  type DailyLog
} from './types'

export interface KvRow {
  key: string
  value: unknown
}

export class KotobaDB extends Dexie {
  cards!: Table<Card, number>
  logs!: Table<DailyLog, string>
  kv!: Table<KvRow, string>

  constructor() {
    super('kotoba')
    this.version(1).stores({
      cards: '++id, &[type+refId], type, due, state, createdAt',
      logs: 'date',
      kv: 'key'
    })
  }
}

export const db = new KotobaDB()

export async function getSettings(): Promise<AppSettings> {
  const row = await db.kv.get('settings')
  const value = (row?.value ?? {}) as Partial<AppSettings>
  return { ...DEFAULT_SETTINGS, ...value }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await db.kv.put({ key: 'settings', value: s })
}
