import type { Kana, KanaGroup, KanaType } from '../types'

// 五十音全表(平假名 + 片假名,含濁音/半濁音/拗音,共 208 個)。
// romaji 為 Hepburn 式;陣列含打字測驗可接受的常見變體。
interface RowSpec {
  row: string
  group: KanaGroup
  items: [string, string[]][]
}

const HIRA_ROWS: RowSpec[] = [
  {
    row: 'あ行', group: 'gojuon',
    items: [['あ', ['a']], ['い', ['i']], ['う', ['u']], ['え', ['e']], ['お', ['o']]]
  },
  {
    row: 'か行', group: 'gojuon',
    items: [['か', ['ka']], ['き', ['ki']], ['く', ['ku']], ['け', ['ke']], ['こ', ['ko']]]
  },
  {
    row: 'さ行', group: 'gojuon',
    items: [['さ', ['sa']], ['し', ['shi', 'si']], ['す', ['su']], ['せ', ['se']], ['そ', ['so']]]
  },
  {
    row: 'た行', group: 'gojuon',
    items: [['た', ['ta']], ['ち', ['chi', 'ti']], ['つ', ['tsu', 'tu']], ['て', ['te']], ['と', ['to']]]
  },
  {
    row: 'な行', group: 'gojuon',
    items: [['な', ['na']], ['に', ['ni']], ['ぬ', ['nu']], ['ね', ['ne']], ['の', ['no']]]
  },
  {
    row: 'は行', group: 'gojuon',
    items: [['は', ['ha']], ['ひ', ['hi']], ['ふ', ['fu', 'hu']], ['へ', ['he']], ['ほ', ['ho']]]
  },
  {
    row: 'ま行', group: 'gojuon',
    items: [['ま', ['ma']], ['み', ['mi']], ['む', ['mu']], ['め', ['me']], ['も', ['mo']]]
  },
  {
    row: 'や行', group: 'gojuon',
    items: [['や', ['ya']], ['ゆ', ['yu']], ['よ', ['yo']]]
  },
  {
    row: 'ら行', group: 'gojuon',
    items: [['ら', ['ra']], ['り', ['ri']], ['る', ['ru']], ['れ', ['re']], ['ろ', ['ro']]]
  },
  {
    row: 'わ行', group: 'gojuon',
    items: [['わ', ['wa']], ['を', ['wo', 'o']], ['ん', ['n']]]
  },
  {
    row: 'が行', group: 'dakuten',
    items: [['が', ['ga']], ['ぎ', ['gi']], ['ぐ', ['gu']], ['げ', ['ge']], ['ご', ['go']]]
  },
  {
    row: 'ざ行', group: 'dakuten',
    items: [['ざ', ['za']], ['じ', ['ji', 'zi']], ['ず', ['zu']], ['ぜ', ['ze']], ['ぞ', ['zo']]]
  },
  {
    row: 'だ行', group: 'dakuten',
    items: [['だ', ['da']], ['ぢ', ['ji', 'di']], ['づ', ['zu', 'du']], ['で', ['de']], ['ど', ['do']]]
  },
  {
    row: 'ば行', group: 'dakuten',
    items: [['ば', ['ba']], ['び', ['bi']], ['ぶ', ['bu']], ['べ', ['be']], ['ぼ', ['bo']]]
  },
  {
    row: 'ぱ行', group: 'dakuten',
    items: [['ぱ', ['pa']], ['ぴ', ['pi']], ['ぷ', ['pu']], ['ぺ', ['pe']], ['ぽ', ['po']]]
  },
  {
    row: 'きゃ行', group: 'yoon',
    items: [['きゃ', ['kya']], ['きゅ', ['kyu']], ['きょ', ['kyo']]]
  },
  {
    row: 'しゃ行', group: 'yoon',
    items: [['しゃ', ['sha', 'sya']], ['しゅ', ['shu', 'syu']], ['しょ', ['sho', 'syo']]]
  },
  {
    row: 'ちゃ行', group: 'yoon',
    items: [['ちゃ', ['cha', 'tya', 'cya']], ['ちゅ', ['chu', 'tyu', 'cyu']], ['ちょ', ['cho', 'tyo', 'cyo']]]
  },
  {
    row: 'にゃ行', group: 'yoon',
    items: [['にゃ', ['nya']], ['にゅ', ['nyu']], ['にょ', ['nyo']]]
  },
  {
    row: 'ひゃ行', group: 'yoon',
    items: [['ひゃ', ['hya']], ['ひゅ', ['hyu']], ['ひょ', ['hyo']]]
  },
  {
    row: 'みゃ行', group: 'yoon',
    items: [['みゃ', ['mya']], ['みゅ', ['myu']], ['みょ', ['myo']]]
  },
  {
    row: 'りゃ行', group: 'yoon',
    items: [['りゃ', ['rya']], ['りゅ', ['ryu']], ['りょ', ['ryo']]]
  },
  {
    row: 'ぎゃ行', group: 'yoon',
    items: [['ぎゃ', ['gya']], ['ぎゅ', ['gyu']], ['ぎょ', ['gyo']]]
  },
  {
    row: 'じゃ行', group: 'yoon',
    items: [['じゃ', ['ja', 'jya', 'zya']], ['じゅ', ['ju', 'jyu', 'zyu']], ['じょ', ['jo', 'jyo', 'zyo']]]
  },
  {
    row: 'びゃ行', group: 'yoon',
    items: [['びゃ', ['bya']], ['びゅ', ['byu']], ['びょ', ['byo']]]
  },
  {
    row: 'ぴゃ行', group: 'yoon',
    items: [['ぴゃ', ['pya']], ['ぴゅ', ['pyu']], ['ぴょ', ['pyo']]]
  }
]

// 片假名與平假名一一對應(順序相同)
const KATA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポキャキュキョシャシュショチャチュチョニャニュニョヒャヒュヒョミャミュミョリャリュリョギャギュギョジャジュジョビャビュビョピャピュピョ'

function buildKana(ktype: KanaType): Kana[] {
  const out: Kana[] = []
  // 學習順序:平假名(seq 0–103)在前,片假名(104–207)在後
  const seqOffset = ktype === 'hiragana' ? 0 : 104
  let idx = 0
  for (const spec of HIRA_ROWS) {
    for (const [hira, romaji] of spec.items) {
      const kana = ktype === 'hiragana' ? hira : KATA[idx]
      out.push({
        id: (ktype === 'hiragana' ? 0 : 10000) + idx + 1,
        kana,
        romaji,
        ktype,
        group: spec.group,
        row: spec.row,
        seq: seqOffset + idx
      })
      idx++
    }
  }
  return out
}

export const HIRAGANA: Kana[] = buildKana('hiragana')
export const KATAKANA: Kana[] = buildKana('katakana')
export const KANA_ALL: Kana[] = [...HIRAGANA, ...KATAKANA]

export const KANA_BY_ID = new Map<number, Kana>(KANA_ALL.map((k) => [k.id, k]))

export const KANA_TOTAL = KANA_ALL.length
