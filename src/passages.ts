// Order of the passages of a check for reading.
//
// The backend stores passages strongest first. Stepping through them in that
// order makes the viewer jump back and forth in a paper, so the arrows follow
// the order of the papers instead: sources as they appear in the citation
// group, then page, then sentence. A passage is identified by its rank, its
// index in the stored (strongest-first) list; rank 0 is the strongest.
import type { Passage } from './api'

export type Ordered = { passage: Passage; rank: number }

export function readingOrder(passages: Passage[], groupKeys: string[]): Ordered[] {
  const source = (key: string) => {
    const index = groupKeys.indexOf(key)
    return index === -1 ? groupKeys.length : index
  }
  return passages
    .map((passage, rank) => ({ passage, rank }))
    .sort(
      (a, b) =>
        source(a.passage.cite_key) - source(b.passage.cite_key) ||
        a.passage.page - b.passage.page ||
        a.passage.start_sentence - b.passage.start_sentence ||
        a.rank - b.rank,
    )
}

// The rank of the passage `delta` steps away in reading order, going round
// at the ends. Without a current passage, forward starts at the first one
// and backward at the last.
export function stepInReadingOrder(order: Ordered[], rank: number | null, delta: number): number {
  const count = order.length
  const position = order.findIndex(item => item.rank === rank)
  const start = position === -1 ? (delta > 0 ? -1 : count) : position
  return order[(((start + delta) % count) + count) % count].rank
}

// 1-based position of a passage in reading order, or 0 if it is not there.
export function readingPosition(order: Ordered[], rank: number | null): number {
  return order.findIndex(item => item.rank === rank) + 1
}
