// 日期與雜項工具

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** 秒數轉人類可讀的中文區間 */
export function fmtInterval(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} 秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分鐘`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小時`
  if (seconds < 86400 * 30) return `${Math.round(seconds / 86400)} 天`
  if (seconds < 86400 * 365) return `${(seconds / (86400 * 30)).toFixed(1)} 個月`
  return `${(seconds / (86400 * 365)).toFixed(1)} 年`
}

export function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
