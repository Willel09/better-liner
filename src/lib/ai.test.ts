import { describe, expect, it } from 'vitest'
import { djOrder, parseJson } from './ai'
import type { Track } from './types'

const tr = (id: string, artist = id): Track => ({ id, source: 'ref', title: id, artist, duration: 0, artwork: null })

describe('parseJson', () => {
  it('accepts JSON wrapped in prose or code fences', () => {
    expect(parseJson<{ a: number }>('Sure!\n```json\n{"a": 1}\n```')).toEqual({ a: 1 })
  })
})

describe('djOrder', () => {
  it('moves through tempo in small steps', () => {
    const ts = [tr('a'), tr('b'), tr('c'), tr('d'), tr('e')]
    const bpm: Record<string, number> = { a: 170, b: 80, c: 125, d: 100, e: 150 }
    const feats = Object.fromEntries(ts.map((t) => [t.id, { bpm: bpm[t.id], energy: bpm[t.id] / 200, valence: 0.5 }]))
    const out = djOrder(ts, feats).map((t) => bpm[t.id])
    expect(out).toEqual([80, 100, 125, 150, 170])
  })
})
