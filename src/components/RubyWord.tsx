import type { VocabEntry } from '../types'

/** 帶 furigana 的單字顯示;沒有 ruby 資料就只顯示原字 */
export function RubyWord({ entry, className }: { entry: VocabEntry; className?: string }) {
  if (entry.ruby && entry.ruby.length > 0) {
    return (
      <span className={className}>
        {entry.ruby.map((seg, i) =>
          seg.r ? (
            <ruby key={i}>{seg.s}<rt>{seg.r}</rt></ruby>
          ) : (
            <span key={i}>{seg.s}</span>
          )
        )}
      </span>
    )
  }
  return <span className={className}>{entry.word}</span>
}
