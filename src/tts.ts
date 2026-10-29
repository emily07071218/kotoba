// 日文語音(Web Speech API)。Windows + Edge 有高品質的日文線上語音。

export function jaVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('ja'))
}

export function speak(
  text: string,
  opts?: { voiceName?: string | null; rate?: number }
): void {
  if (!('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = opts?.rate ?? 0.9
  if (opts?.voiceName) {
    const v = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.name === opts.voiceName)
    if (v) u.voice = v
  }
  window.speechSynthesis.speak(u)
}

/** 語音清單是非同步載入的;掛一次 listener,有任何變化就通知 */
export function onVoicesChanged(cb: () => void): () => void {
  if (!('speechSynthesis' in window)) return () => {}
  const handler = () => cb()
  window.speechSynthesis.addEventListener('voiceschanged', handler)
  // 觸發一次載入
  window.speechSynthesis.getVoices()
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler)
}
