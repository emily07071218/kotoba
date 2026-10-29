import { useEffect, useState } from 'react'
import { db, getSettings, saveSettings } from '../db'
import { jaVoices, onVoicesChanged, speak } from '../tts'
import type { AppSettings, BackupFile } from '../types'
import { download, localDateStr } from '../util'

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getSettings().then(setSettings)
    const off = onVoicesChanged(() => setVoices(jaVoices()))
    setVoices(jaVoices())
    return off
  }, [])

  async function update(patch: Partial<AppSettings>) {
    if (!settings) return
    const next = { ...settings, ...patch }
    setSettings(next)
    await saveSettings(next)
  }

  async function exportBackup() {
    if (!settings) return
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
    await saveSettings(s)
    setSettings(s)
    download(`kotoba-backup-${localDateStr()}.json`, JSON.stringify(backup))
    setMsg('已匯出備份檔。')
  }

  async function importBackup(file: File) {
    if (!window.confirm('匯入會覆蓋目前的全部進度,確定嗎?')) return
    const text = await file.text()
    let data: BackupFile
    try {
      data = JSON.parse(text) as BackupFile
    } catch {
      alert('檔案格式錯誤:不是合法的 JSON。')
      return
    }
    if (data.app !== 'kotoba' || data.schema !== 1) {
      alert('這不是言葉 Kotoba 的備份檔(或版本不符)。')
      return
    }
    await db.transaction('rw', db.cards, db.logs, db.kv, async () => {
      await db.cards.clear()
      await db.logs.clear()
      await db.cards.bulkPut(data.cards)
      await db.logs.bulkPut(data.logs)
      if (data.settings) await db.kv.put({ key: 'settings', value: data.settings })
    })
    alert('匯入完成,頁面即將重新載入。')
    window.location.reload()
  }

  async function resetAll() {
    if (!window.confirm('這會刪除所有卡片、進度與設定,確定嗎?')) return
    if (!window.confirm('再次確認:真的要全部重設嗎?此動作無法復原(除非你有備份檔)。')) return
    await db.transaction('rw', db.cards, db.logs, db.kv, async () => {
      await db.cards.clear()
      await db.logs.clear()
      await db.kv.clear()
    })
    window.location.reload()
  }

  if (!settings) return <p className="muted">載入中…</p>

  return (
    <>
      <h1>設定</h1>

      <div className="card">
        <h2>每日新卡片</h2>
        <div className="settings-row">
          <label>假名(每日上限)</label>
          <input
            type="range" min={1} max={30} step={1}
            value={settings.kanaNewPerDay}
            onChange={(e) => update({ kanaNewPerDay: Number(e.target.value) })}
          />
          <span className="val">{settings.kanaNewPerDay}</span>
        </div>
        <div className="settings-row">
          <label>單字(每日新詞)</label>
          <input
            type="range" min={1} max={20} step={1}
            value={settings.vocabNewPerDay}
            onChange={(e) => update({ vocabNewPerDay: Number(e.target.value) })}
          />
          <span className="val">{settings.vocabNewPerDay}</span>
        </div>
      </div>

      <div className="card">
        <h2>發音</h2>
        <div className="settings-row">
          <label>日文語音</label>
          <select
            value={settings.ttsVoiceName ?? ''}
            onChange={(e) => update({ ttsVoiceName: e.target.value || null })}
          >
            <option value="">(自動選擇)</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label>語速</label>
          <input
            type="range" min={0.5} max={1.2} step={0.05}
            value={settings.ttsRate}
            onChange={(e) => update({ ttsRate: Number(e.target.value) })}
          />
          <span className="val">{settings.ttsRate.toFixed(2)}</span>
        </div>
        <button
          className="btn"
          onClick={() => speak('こんにちは、言葉へようこそ', { voiceName: settings.ttsVoiceName, rate: settings.ttsRate })}
        >
          測試發音
        </button>
        {voices.length === 0 && (
          <p className="muted" style={{ marginTop: 8 }}>
            找不到日文語音。建議用 Microsoft Edge 開啟本程式(Windows 內建高品質日文線上語音)。
          </p>
        )}
      </div>

      <div className="card">
        <h2>備份</h2>
        <p className="muted">
          所有進度只存在這台電腦的瀏覽器裡。清瀏覽器資料 = 進度歸零,請定期匯出備份檔。
          超過 {settings.backupReminderDays} 天未備份,主頁會提醒你。
        </p>
        <div className="row">
          <button className="btn primary" onClick={exportBackup}>匯出備份(JSON)</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            匯入備份
            <input
              type="file" accept="application/json" style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>

      <div className="card">
        <h2>解鎖與重設</h2>
        <div className="row">
          <span>單字功能狀態:{settings.vocabUnlocked ? '已解鎖' : '未解鎖(通過檢定即解鎖)'}</span>
          {!settings.vocabUnlocked && (
            <button className="btn" onClick={() => update({ vocabUnlocked: true, kanaGateSkipped: true })}>
              直接解鎖
            </button>
          )}
        </div>
        <hr className="divider" />
        <button className="btn danger" onClick={resetAll}>重設所有進度</button>
      </div>

      <div className="card">
        <h2>關於</h2>
        <p className="muted">
          言葉 Kotoba v0.1 — 自用日文初學工具。排程演算法:FSRS(ts-fsrs)。
        </p>
        <p className="muted">
          內容來源與授權:
          <br />・ 詞條/釋義:JMDict — Electronic Dictionary Research and Development Group,CC BY-SA 4.0
          <br />・ 假名注音:JmdictFurigana(EDRDG 資料),CC BY-SA 4.0
          <br />・ 例句:Tatoeba,CC BY 2.0 FR(例句僅收錄附中文翻譯者)
          <br />・ JLPT 分級:依據 Wiktionary 難度分類(CC BY-SA 4.0)
        </p>
      </div>
    </>
  )
}
