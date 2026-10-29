// 內容管線(定案版)
// - 詞形/讀音/詞性:JMdict(EDRDG,CC BY-SA 4.0)https://www.edrdg.org/pub/Nihongo/JMdict.gz
// - JLPT 分級:tanos.co.uk 詞表(Jonathan Waller,CC BY 4.0),經 Bluskyo/JLPT_Vocabulary 轉檔
// - 中文釋義:中文維基詞典(zh.wiktionary.org,CC BY-SA 4.0)日語章節
// - 例句:Tatoeba 日↔中(https://tatoeba.org,CC BY 2.0 FR)
// - 假名注音:JmdictFurigana(Doublevil 維護,EDRDG 資料)
// 產出 src/data/vocab.json;原始檔快取在 .data-cache/(不入 git)。執行:npm run data

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import readline from 'node:readline'
import bz2 from 'unbzip2-stream'
import OpenCC from 'opencc-js'

// 簡體 → 台灣正體(機械字元轉換,不改變內容)
const toTw = OpenCC.Converter({ from: 'cn', to: 'twp' })

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..'
)
const CACHE = path.join(ROOT, '.data-cache')
const OUT = path.join(ROOT, 'src', 'data', 'vocab.json')

const UA = {
  'User-Agent': 'kotoba-app/0.1 (personal Japanese-learning tool; contact: local user)'
}

const JMDICT_URL = 'https://www.edrdg.org/pub/Nihongo/JMdict.gz'
const JLPT_URL =
  'https://raw.githubusercontent.com/Bluskyo/JLPT_Vocabulary/main/data/vocab/results/JLPT_vocab_ALL.json'
const FURIGANA_URL =
  'https://github.com/Doublevil/JmdictFurigana/releases/download/2.3.1%2B2026-10-25/JmdictFurigana.json'
const TATOEBA_BASE = 'https://downloads.tatoeba.org/exports/per_language'

fs.mkdirSync(CACHE, { recursive: true })
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const log = (...a) => console.log(...a)
const warn = (...a) => console.warn('⚠', ...a)

async function download(url, dest, label) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    log(`[cache] ${label} 已存在,跳過下載`)
    return dest
  }
  log(`[下載] ${label} …`)
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${label} 下載失敗:HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
  log(`[下載] ${label} 完成(${(buf.length / 1e6).toFixed(1)} MB)`)
  return dest
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// ---------- 1. JMdict:詞形/讀音/詞性 ----------

const POS_MAP = {
  n: '名詞', 'n-adv': '副詞的名詞', 'n-t': '名詞(時間)', pn: '代名詞',
  'adj-i': 'い形容詞', 'adj-na': 'な形容詞', 'adj-no': 'の形容詞', 'adj-pn': '連体詞',
  adv: '副詞', 'adv-to': '副詞(と)', conj: '接續詞', cop: '繫詞', ctr: '助數詞',
  exp: '表達', int: '感嘆詞', prt: '助詞', pref: '前綴', suf: '後綴',
  aux: '助動詞', 'aux-v': '助動詞', 'aux-adj': '助形容詞',
  v1: '動詞(一段)', v1s: '動詞(一段)', vk: '動詞(カ変)', vz: '動詞(ザ変)',
  'vs-i': 'サ變動詞', 'vs-s': 'サ變動詞'
}
function mapPos(raw) {
  const codes = [...raw.matchAll(/&([A-Za-z0-9-]+);/g)].map((m) => m[1])
  const list = codes.length ? codes : [raw.trim()]
  const zh = []
  for (const c of list) {
    const label =
      POS_MAP[c] ??
      (c.startsWith('v5') ? '動詞(五段)' : c.startsWith('v') ? '動詞' : c.startsWith('adj') ? '形容詞' : null)
    if (label && !zh.includes(label)) zh.push(label)
  }
  return zh
}

const PRI_SCORE = { news1: 5, ichi1: 5, spec1: 4, news2: 3, ichi2: 3, spec2: 2, gai1: 2 }
function priScore(pris) {
  let s = 0
  for (const p of pris) {
    if (p.startsWith('nf')) s = Math.max(s, 6)
    else s = Math.max(s, PRI_SCORE[p] ?? 0)
  }
  return s
}

async function parseJMdict() {
  const gzPath = await download(JMDICT_URL, path.join(CACHE, 'JMdict.gz'), 'JMDict')
  const entries = new Map()
  log('[JMDict] 解析中(約 1-2 分鐘)…')
  await new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(gzPath).pipe(zlib.createGunzip()),
      crlfDelay: Infinity
    })
    let buf = ''
    rl.on('line', (line) => {
      if (buf === '') {
        const start = line.indexOf('<entry>')
        if (start === -1) return
        line = line.slice(start)
      }
      buf += line + '\n'
      if (line.includes('</entry>')) {
        processEntryXml(buf, entries)
        buf = ''
      }
    })
    rl.on('close', resolve)
    rl.on('error', reject)
  })
  log(`[JMDict] 詞條總數:${entries.size}`)
  return entries
}

function processEntryXml(xml, out) {
  const seq = xml.match(/<ent_seq>(\d+)<\/ent_seq>/)?.[1]
  if (!seq) return
  const rebs = [...xml.matchAll(/<reb>([^<]+)<\/reb>/g)].map((m) => decodeXml(m[1]))
  if (rebs.length === 0) return
  // 依 ke_pri 選出最常用的漢字表記(避免顯示罕用形,如「彼処」而非「あそこ」)
  const keles = [...xml.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)].map((m) => {
    const keb = decodeXml(m[1].match(/<keb>([^<]+)<\/keb>/)?.[1] ?? '')
    const pris = [...m[1].matchAll(/<ke_pri>([^<]+)<\/ke_pri>/g)].map((x) => x[1])
    return { keb, score: priScore(pris) }
  }).filter((k) => k.keb)
  keles.sort((a, b) => b.score - a.score)
  const kebs = keles.map((k) => k.keb)
  const pos = [
    ...new Set(
      [...xml.matchAll(/<pos>([^<]+)<\/pos>/g)]
        .flatMap((m) => mapPos(m[1]))
        .filter(Boolean)
    )
  ]
  out.set(Number(seq), { seq: Number(seq), kebs, rebs, pos })
}

// ---------- 2. tanos JLPT 詞表 ----------

const KANJI_RE = /[\u4e00-\u9faf\u3400-\u4dbf]/
const KANA_RE = /^[\u3040-\u30ff]+$/

async function fetchJLPTTuples() {
  const res = await fetch(JLPT_URL, { headers: UA })
  if (!res.ok) throw new Error(`tanos JLPT 詞表下載失敗:HTTP ${res.status}`)
  const raw = JSON.parse(await res.text())
  const tuples = []
  for (const [word, readings] of Object.entries(raw)) {
    const w = word.trim()
    if (!w || w.includes(' ') || w.includes('(') || w.includes(')')) continue
    for (const r of readings) {
      const level = r.level === 5 ? 'N5' : r.level === 4 ? 'N4' : null
      if (level) tuples.push({ word: w, reading: (r.reading || '').trim(), level })
    }
  }
  log(`[JLPT] tanos 詞表(N5+N4):${tuples.length} 筆`)
  return tuples
}

function matchVocab(entries, tuples) {
  const byKeb = new Map()
  const byReb = new Map()
  const byRebKanaOnly = new Map() // 假名詞目優先配「沒有漢字表記」的條目
  for (const e of entries.values()) {
    for (const k of e.kebs) if (!byKeb.has(k)) byKeb.set(k, e.seq)
    for (const r of e.rebs) {
      if (!byReb.has(r)) byReb.set(r, e.seq)
      if (e.kebs.length === 0 && !byRebKanaOnly.has(r)) byRebKanaOnly.set(r, e.seq)
    }
  }
  const matched = new Map() // seq -> level
  let unmatched = 0
  for (const t of tuples) {
    let seq = byKeb.get(t.word)
    if (!seq && KANA_RE.test(t.word)) {
      seq = byRebKanaOnly.get(t.word) ?? byReb.get(t.word)
      if (!seq && t.reading) seq = byRebKanaOnly.get(t.reading) ?? byReb.get(t.reading)
    } else if (!seq && t.reading) {
      seq = byReb.get(t.reading)
    }
    if (!seq) {
      unmatched++
      continue
    }
    if (!matched.has(seq)) matched.set(seq, t.level) // 先出現的層級優先(N5 先處理)
  }
  log(`[配對] 命中 JMDict:${matched.size} 詞(未命中 ${unmatched})`)
  return matched
}

// ---------- 3. zh.wiktionary 中文釋義 ----------

function stripMarkup(s) {
  let prev
  do {
    prev = s
    s = s.replace(/\{\{[^{}]*\}\}/g, '')
  } while (s !== prev)
  return s
    .replace(/'{2,5}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^[:*\s#]+/, '')
    .trim()
}

function extractJaDefinitions(text, max = 2) {
  const lines = text.split('\n')
  let inJa = false
  const defs = []
  for (const line of lines) {
    if (/^==[^=]/.test(line)) {
      inJa = /^\s*==\s*(?:日语|日語|\{\{-ja-\}\})/.test(line)
      continue
    }
    // 只取釋義行(# 開頭,排除例句 #* / #:);再跳過 usex/quote 模板
    if (inJa && /^#(?![*:])/.test(line)) {
      if (/\{\{\s*ja-(?:usex|x)|\{\{\s*quote|\{\{\s*ux/i.test(line)) continue
      const cleaned = stripMarkup(line.replace(/^#+\s*/, '')).replace(/^\[[^\]]*\]\s*/, '')
      // 中文釋義不應含假名(含假名多半是混入的日文例句或日文釋義)
      const hasKana = /[\u3040-\u30ff]/.test(cleaned)
      if (!hasKana && cleaned.length >= 2 && cleaned.length <= 40 && !cleaned.includes('{')) {
        if (!defs.includes(cleaned)) defs.push(cleaned)
      }
    }
    if (defs.length >= max + 2) break
  }
  // 兩條釋義合併時避免過長:優先短的那條當主釋義
  const sorted = [...defs].sort((a, b) => a.length - b.length)
  const picked = sorted.slice(0, max)
  return picked.join(';')
}

async function fetchZhMeanings(vocabList) {
  log('[zh.wiktionary] 批量抓取中文釋義…')

  async function fetchWithRetry(url, attempts = 6) {
    let wait = 4000
    for (let a = 0; a < attempts; a++) {
      const res = await fetch(url, { headers: UA })
      if (res.ok) return await res.json()
      if (res.status === 429 || res.status === 503) {
        log(`  … 限流(${res.status}),等待 ${wait / 1000}s 後重試`)
        await new Promise((r) => setTimeout(r, wait))
        wait = Math.min(wait * 2, 30000)
        continue
      }
      throw new Error(`HTTP ${res.status}`)
    }
    throw new Error('重試次數用盡')
  }
  const cacheFile = path.join(CACHE, 'zhwikt.json')
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {}
  const titles = [...new Set(vocabList.map((v) => v.word).concat(vocabList.map((v) => v.reading)))]
  const todo = titles.filter((t) => !(t in cache))
  log(`[zh.wiktionary] 共 ${titles.length} 個詞目,快取 ${titles.length - todo.length},待抓 ${todo.length}`)
  const BATCH = 30
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH)
    const url =
      'https://zh.wiktionary.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        titles: batch.join('|'),
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        format: 'json',
        formatversion: '2',
        redirects: '1'
      })
    try {
      const json = await fetchWithRetry(url)
      for (const p of json.query?.pages ?? []) {
        const content = p.revisions?.[0]?.slots?.main?.content ?? ''
        cache[p.title] = content // 快取存原始 wikitext,解析邏輯可隨時改進重跑
      }
    } catch (e) {
      warn('zh.wiktionary 批次失敗(繼續):', e.message)
    }
    if ((i / BATCH) % 10 === 0) log(`  … ${Math.min(i + BATCH, todo.length)} / ${todo.length}`)
    if ((i / BATCH) % 10 === 9) fs.writeFileSync(cacheFile, JSON.stringify(cache))
    await new Promise((r) => setTimeout(r, 900))
  }
  fs.writeFileSync(cacheFile, JSON.stringify(cache))
  let withMeaning = 0
  for (const v of vocabList) {
    const rawText = cache[v.word] ?? cache[v.reading] ?? ''
    const m = rawText ? toTw(extractJaDefinitions(rawText)) : ''
    if (m) {
      v.meaningZh = m
      withMeaning++
    }
  }
  log(`[zh.wiktionary] 取得釋義:${withMeaning} / ${vocabList.length}`)
  return vocabList
}

// ---------- 4. JmdictFurigana ----------

async function loadFurigana() {
  try {
    const jsonPath = await download(
      FURIGANA_URL,
      path.join(CACHE, 'JmdictFurigana.json'),
      'JmdictFurigana'
    )
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, ''))
    const map = new Map()
    for (const item of raw) {
      const segs = (item.furigana ?? []).map((s) => ({ s: s.ruby, r: s.rt ?? null }))
      map.set(`${item.text}|${item.reading}`, segs)
    }
    log(`[Furigana] ${map.size} 筆注音資料`)
    return map
  } catch (e) {
    warn('Furigana 資料取得失敗(不影響建置):', e.message)
    return new Map()
  }
}

// ---------- 5. Tatoeba 例句 ----------

function buildAC(patterns) {
  const children = [Object.create(null)]
  const out = [[]]
  const fail = [0]
  for (const { text, id } of patterns) {
    let node = 0
    for (const ch of text) {
      if (!children[node][ch]) {
        children.push(Object.create(null))
        out.push([])
        fail.push(0)
        children[node][ch] = children.length - 1
      }
      node = children[node][ch]
    }
    if (!out[node].includes(id)) out[node].push(id)
  }
  const queue = []
  for (const ch in children[0]) queue.push(children[0][ch])
  while (queue.length) {
    const node = queue.shift()
    for (const ch in children[node]) {
      const child = children[node][ch]
      let f = fail[node]
      while (f !== 0 && !children[f][ch]) f = fail[f]
      const nf = children[f][ch]
      fail[child] = nf && nf !== child ? nf : 0
      out[child] = out[child].concat(out[fail[child]])
      queue.push(child)
    }
  }
  return {
    search(text, cb) {
      let node = 0
      for (const ch of text) {
        while (node !== 0 && !children[node][ch]) node = fail[node]
        node = children[node][ch] || 0
        for (const id of out[node]) cb(id)
      }
    }
  }
}

async function readBz2Lines(file, onLine) {
  await new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(bz2()) })
    rl.on('line', onLine)
    rl.on('close', resolve)
    rl.on('error', reject)
  })
}

async function loadTatoebaExamples(vocabList) {
  try {
    const jpnPath = await download(
      `${TATOEBA_BASE}/jpn/jpn_sentences.tsv.bz2`,
      path.join(CACHE, 'jpn_sentences.tsv.bz2'),
      'Tatoeba 日文句庫'
    )
    const cmnPath = await download(
      `${TATOEBA_BASE}/cmn/cmn_sentences.tsv.bz2`,
      path.join(CACHE, 'cmn_sentences.tsv.bz2'),
      'Tatoeba 中文句庫'
    )
    const linksPath = await download(
      `${TATOEBA_BASE}/jpn/jpn-cmn_links.tsv.bz2`,
      path.join(CACHE, 'jpn-cmn_links.tsv.bz2'),
      'Tatoeba 日中連結'
    )

    const jpn = new Map()
    await readBz2Lines(jpnPath, (line) => {
      const i1 = line.indexOf('\t')
      const i2 = line.indexOf('\t', i1 + 1)
      if (i1 === -1 || i2 === -1) return
      jpn.set(Number(line.slice(0, i1)), line.slice(i2 + 1))
    })
    log(`[Tatoeba] 日文句 ${jpn.size}`)

    const cmn = new Map()
    await readBz2Lines(cmnPath, (line) => {
      const i1 = line.indexOf('\t')
      const i2 = line.indexOf('\t', i1 + 1)
      if (i1 === -1 || i2 === -1) return
      cmn.set(Number(line.slice(0, i1)), line.slice(i2 + 1))
    })
    log(`[Tatoeba] 中文句 ${cmn.size}`)

    const adj = new Map()
    await readBz2Lines(linksPath, (line) => {
      const [a, b] = line.split('\t')
      const na = Number(a)
      const nb = Number(b)
      if (jpn.has(na) && cmn.has(nb)) {
        if (!adj.has(na)) adj.set(na, [])
        adj.get(na).push(nb)
      } else if (jpn.has(nb) && cmn.has(na)) {
        if (!adj.has(nb)) adj.set(nb, [])
        adj.get(nb).push(na)
      }
    })
    log(`[Tatoeba] 有中文翻譯的日文句 ${adj.size}`)

    const patterns = []
    const seenPat = new Set()
    for (const v of vocabList) {
      for (const form of new Set([v.word, v.reading])) {
        if (!form) continue
        const ok = KANJI_RE.test(form) || form.length >= 2
        if (!ok || seenPat.has(form)) continue
        seenPat.add(form)
        patterns.push({ text: form, id: v.id })
      }
    }
    const ac = buildAC(patterns)

    const best = new Map() // vocabId -> { jpId, len }
    for (const [jpId] of adj) {
      const text = jpn.get(jpId)
      if (!text || text.length > 60) continue
      const hit = new Set()
      ac.search(text, (id) => hit.add(id))
      for (const id of hit) {
        const prev = best.get(id)
        if (!prev || text.length < prev.len) best.set(id, { jpId, len: text.length })
      }
    }
    log(`[Tatoeba] 找到例句的詞:${best.size}`)

    const examples = new Map()
    for (const [id, { jpId }] of best) {
      const cands = adj.get(jpId) ?? []
      let bestZh = null
      for (const c of cands) {
        const t = cmn.get(c)
        if (t && (!bestZh || t.length < bestZh.length)) bestZh = t
      }
      if (bestZh) examples.set(id, { jp: jpn.get(jpId), zh: toTw(bestZh) })
    }
    log(`[Tatoeba] 完成配對(日句+中譯):${examples.size}`)
    return examples
  } catch (e) {
    warn('Tatoeba 例句取得失敗(不影響建置):', e.message)
    return new Map()
  }
}

// ---------- main ----------

async function main() {
  const entries = await parseJMdict()
  const tuples = await fetchJLPTTuples()
  const matched = matchVocab(entries, tuples)

  let vocabList = [...matched.entries()].map(([seq, level]) => {
    const e = entries.get(seq)
    const word = e.kebs[0] ?? e.rebs[0]
    const reading = e.rebs[0]
    const hasKanji = word !== reading && KANJI_RE.test(word)
    return {
      id: seq,
      word,
      reading,
      level,
      meaningZh: '',
      pos: e.pos.slice(0, 2)
    }
  })

  vocabList = await fetchZhMeanings(vocabList)

  const furigana = await loadFurigana()
  vocabList = vocabList.map((v) => {
    const hasKanji = v.word !== v.reading && KANJI_RE.test(v.word)
    const ruby = hasKanji ? (furigana.get(`${v.word}|${v.reading}`) ?? undefined) : undefined
    return ruby && ruby.length ? { ...v, ruby } : v
  })

  const examples = await loadTatoebaExamples(vocabList)
  vocabList = vocabList.map((v) => (examples.has(v.id) ? { ...v, example: examples.get(v.id) } : v))

  // 沒有中文釋義的詞不進詞庫(寧缺勿錯)
  vocabList = vocabList.filter((v) => v.meaningZh)

  const levelRank = { N5: 0, N4: 1 }
  vocabList.sort((a, b) => levelRank[a.level] - levelRank[b.level] || a.id - b.id)

  fs.writeFileSync(OUT, JSON.stringify(vocabList))
  const n5 = vocabList.filter((v) => v.level === 'N5')
  const n4 = vocabList.filter((v) => v.level === 'N4')
  log('')
  log('========== 建置結果 ==========')
  log(`總詞數:${vocabList.length}(N5 ${n5.length}、N4 ${n4.length})`)
  log(`附例句:${vocabList.filter((v) => v.example).length}`)
  log(`附注音:${vocabList.filter((v) => v.ruby).length}`)
  log(`輸出:${OUT}`)
  if (vocabList.length < 1000) {
    warn('詞數少於 1000,請檢查各來源與配對邏輯。')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
