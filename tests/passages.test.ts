import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Passage } from '../src/api.ts'
import { readingOrder, readingPosition, stepInReadingOrder } from '../src/passages.ts'

function passage(cite_key: string, page: number, start_sentence: number): Passage {
  return {
    cite_key,
    attachment_key: `PDF-${cite_key}`,
    page,
    start_sentence,
    end_sentence: start_sentence + 1,
    rects: [],
    reason: '',
  }
}

// Strongest first, as stored: B p7, A p3, A p1, B p2, A p3 (earlier sentence).
const stored = [
  passage('b', 7, 90),
  passage('a', 3, 40),
  passage('a', 1, 5),
  passage('b', 2, 12),
  passage('a', 3, 31),
]
const group = ['a', 'b']

describe('readingOrder', () => {
  it('sorts by source in the group, then page, then sentence', () => {
    const order = readingOrder(stored, group)
    assert.deepEqual(
      order.map(item => [item.passage.cite_key, item.passage.page, item.passage.start_sentence]),
      [
        ['a', 1, 5],
        ['a', 3, 31],
        ['a', 3, 40],
        ['b', 2, 12],
        ['b', 7, 90],
      ],
    )
  })

  it('keeps the rank, the index in the stored strongest-first list', () => {
    assert.deepEqual(
      readingOrder(stored, group).map(item => item.rank),
      [2, 4, 1, 3, 0],
    )
  })

  it('follows the order of the citation group, not the cite keys', () => {
    const order = readingOrder(stored, ['b', 'a'])
    assert.deepEqual(
      order.map(item => item.rank),
      [3, 0, 2, 4, 1],
    )
  })

  it('puts passages of keys outside the group last', () => {
    const order = readingOrder([passage('x', 1, 1), passage('a', 9, 9)], ['a'])
    assert.deepEqual(
      order.map(item => item.passage.cite_key),
      ['a', 'x'],
    )
  })

  it('does not change the stored list', () => {
    const copy = structuredClone(stored)
    readingOrder(stored, group)
    assert.deepEqual(stored, copy)
  })

  it('handles no passages', () => {
    assert.deepEqual(readingOrder([], group), [])
  })
})

describe('stepInReadingOrder', () => {
  const order = readingOrder(stored, group)

  it('starts at the strongest passage and goes on in the PDF', () => {
    // The strongest passage (rank 0) is the last in reading order here.
    assert.equal(readingPosition(order, 0), 5)
    // Up goes back in the PDF: B p2.
    assert.equal(stepInReadingOrder(order, 0, -1), 3)
    // From A p3 sentence 31, down goes to A p3 sentence 40.
    assert.equal(stepInReadingOrder(order, 4, 1), 1)
  })

  it('goes round at both ends', () => {
    assert.equal(stepInReadingOrder(order, 0, 1), 2)
    assert.equal(stepInReadingOrder(order, 2, -1), 0)
  })

  it('without a current passage starts at the first or the last', () => {
    assert.equal(stepInReadingOrder(order, null, 1), 2)
    assert.equal(stepInReadingOrder(order, null, -1), 0)
  })
})

describe('readingPosition', () => {
  it('is 1-based and 0 for an unknown passage', () => {
    const order = readingOrder(stored, group)
    assert.equal(readingPosition(order, 2), 1)
    assert.equal(readingPosition(order, null), 0)
    assert.equal(readingPosition(order, 99), 0)
  })
})
