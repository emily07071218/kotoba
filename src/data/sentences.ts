import type { SentenceEntry } from '../types'

// 日常用語:短句(挨拶・常用句)+ 短文(2–4 句的小段落)。
// 皆為基礎 N5 程度的自製內容,配合 TTS 朗讀。
export const PHRASES: SentenceEntry[] = [
  { id: 8_000_001, kind: 'phrase', jp: 'おはようございます。', zh: '早安。' },
  { id: 8_000_002, kind: 'phrase', jp: 'こんにちは。', zh: '你好。(日間)' },
  { id: 8_000_003, kind: 'phrase', jp: 'こんばんは。', zh: '晚上好。' },
  { id: 8_000_004, kind: 'phrase', jp: 'おやすみなさい。', zh: '晚安。(睡前)' },
  { id: 8_000_005, kind: 'phrase', jp: 'ありがとうございます。', zh: '謝謝您。' },
  { id: 8_000_006, kind: 'phrase', jp: 'すみません。', zh: '不好意思;對不起;請問。' },
  { id: 8_000_007, kind: 'phrase', jp: 'ごめんなさい。', zh: '對不起。' },
  { id: 8_000_008, kind: 'phrase', jp: 'いただきます。', zh: '我開動了。(飯前)' },
  { id: 8_000_009, kind: 'phrase', jp: 'ごちそうさま。', zh: '我吃飽了。(飯後)' },
  { id: 8_000_010, kind: 'phrase', jp: 'いってきます。', zh: '我出門了。' },
  { id: 8_000_011, kind: 'phrase', jp: 'ただいま。', zh: '我回來了。' },
  { id: 8_000_012, kind: 'phrase', jp: 'おかえりなさい。', zh: '歡迎回來。' },
  { id: 8_000_013, kind: 'phrase', jp: 'はじめまして。', zh: '初次見面。' },
  { id: 8_000_014, kind: 'phrase', jp: 'よろしくお願いします。', zh: '請多指教。' },
  { id: 8_000_015, kind: 'phrase', jp: 'お元気ですか。', zh: '你好嗎?' },
  { id: 8_000_016, kind: 'phrase', jp: '大丈夫です。', zh: '沒問題;不要緊。' },
  { id: 8_000_017, kind: 'phrase', jp: '分かりました。', zh: '我知道了。' },
  { id: 8_000_018, kind: 'phrase', jp: '待ってください。', zh: '請等一下。' },
  { id: 8_000_019, kind: 'phrase', jp: 'もう一度お願いします。', zh: '請再說一次。' },
  { id: 8_000_020, kind: 'phrase', jp: 'いくらですか。', zh: '多少錢?' },
  { id: 8_000_021, kind: 'phrase', jp: 'これをください。', zh: '請給我這個。' },
  { id: 8_000_022, kind: 'phrase', jp: 'トイレはどこですか。', zh: '廁所在哪裡?' },
  { id: 8_000_023, kind: 'phrase', jp: '美味しいです。', zh: '好吃。' },
  { id: 8_000_024, kind: 'phrase', jp: '疲れました。', zh: '累了。' }
]

export const PASSAGES: SentenceEntry[] = [
  {
    id: 8_100_001, kind: 'passage',
    jp: '朝です。\n太陽が上がります。\n良い一日を!',
    zh: '早上了。太陽升起。祝你有美好的一天!'
  },
  {
    id: 8_100_002, kind: 'passage',
    jp: '今日は晴れです。\n風が気持ちいいです。\n散歩しましょう。',
    zh: '今天是晴天。風很舒服。一起去散步吧。'
  },
  {
    id: 8_100_003, kind: 'passage',
    jp: '私はラーメンが好きです。\n毎週食べます。\nでも少し高いです。',
    zh: '我喜歡拉麵。每個星期都吃。不過有點貴。'
  },
  {
    id: 8_100_004, kind: 'passage',
    jp: '私の家族は四人です。\n父と母と妹がいます。\nみんな優しいです。',
    zh: '我家有四個人。有爸爸、媽媽和妹妹。大家都很溫柔。'
  },
  {
    id: 8_100_005, kind: 'passage',
    jp: '毎朝、電車で学校へ行きます。\n駅は近いです。\n十分ぐらいかかります。',
    zh: '每天早上搭電車去學校。車站很近。大概要花十分鐘。'
  },
  {
    id: 8_100_006, kind: 'passage',
    jp: '私は猫がいます。\n名前はタロウです。\nよく寝ます。\nとても可愛いです。',
    zh: '我養了一隻貓。名字叫太郎。很會睡覺。非常可愛。'
  },
  {
    id: 8_100_007, kind: 'passage',
    jp: '明日は休みです。\n友達と映画を見ます。\n楽しみです。',
    zh: '明天放假。要和朋友一起看電影。真期待。'
  },
  {
    id: 8_100_008, kind: 'passage',
    jp: '夏休みに京都へ行きます。\nお寺を見ます。\n和食も食べたいです。',
    zh: '暑假要去京都。要去參觀寺廟。也想吃日本料理。'
  }
]

export const SENTENCES: SentenceEntry[] = [...PHRASES, ...PASSAGES]
export const SENT_BY_ID = new Map<number, SentenceEntry>(SENTENCES.map((s) => [s.id, s]))
