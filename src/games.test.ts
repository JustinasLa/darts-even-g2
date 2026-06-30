import { describe, it, expect } from 'vitest'
import { findGame, dartScore, findCheckout } from './games'
import type { Dart, Game } from './games'

function S(n: number): Dart {
  return { value: n, mult: 1 }
}
function D(n: number): Dart {
  return { value: n, mult: 2 }
}
function T(n: number): Dart {
  return { value: n, mult: 3 }
}
const MISS: Dart = { value: 0, mult: 1 }

function play(g: Game, darts: Dart[]): void {
  for (const d of darts) {
    g.applyDart(d)
  }
}

function make(id: string, players: string[], opts: Record<string, string> = {}): Game {
  const def = findGame(id)
  if (!def) {
    throw new Error('missing game ' + id)
  }
  return def.create(players, opts)
}

describe('dart scoring', function () {
  it('scores singles, doubles, triples and bull', function () {
    expect(dartScore(S(20))).toBe(20)
    expect(dartScore(D(20))).toBe(40)
    expect(dartScore(T(20))).toBe(60)
    expect(dartScore({ value: 25, mult: 1 })).toBe(25)
    expect(dartScore({ value: 25, mult: 2 })).toBe(50)
    expect(dartScore(MISS)).toBe(0)
  })
})

describe('checkout solver', function () {
  it('finds a one-dart double', function () {
    const r = findCheckout(40)
    expect(r).not.toBeNull()
    expect(r!.length).toBe(1)
    expect(dartScore(r![0])).toBe(40)
  })

  it('always finishes on a double', function () {
    const r = findCheckout(170)
    expect(r).not.toBeNull()
    expect(r![r!.length - 1].mult).toBe(2)
    let sum = 0
    for (const d of r!) {
      sum += dartScore(d)
    }
    expect(sum).toBe(170)
  })

  it('returns null above 170', function () {
    expect(findCheckout(171)).toBeNull()
  })
})

describe('X01', function () {
  it('checks out exactly on a double and wins', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20)])
    expect(g.view().players[0].primary).toBe('121')
    play(g, [T(20), T(15), D(8)])
    const v = g.view()
    expect(v.finished).toBe(true)
    expect(v.winner).toBe(0)
  })

  it('busts when a dart leaves a score of 1', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20)])
    play(g, [T(20), T(20)])
    const v = g.view()
    expect(v.players[0].primary).toBe('121')
    expect(v.message).toContain('BUST')
  })

  it('busts when finishing on a non-double under double-out', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20)])
    play(g, [T(20), T(19), S(4)])
    expect(g.view().players[0].primary).toBe('121')
  })

  it('reports last turn points and 3-dart average', function () {
    const g = make('301', ['A'])
    expect(g.view().previous).toBe('0')
    play(g, [T(20), T(20), T(20)])
    const v = g.view()
    expect(v.previous).toBe('180')
    expect(v.average).toBe('180.0')
  })

  it('updates the leg average only after the turn is committed', function () {
    const g = make('301', ['A'])
    g.applyDart(T(20))
    expect(g.view().average).toBe('0.0')
    g.applyDart(T(20))
    expect(g.view().average).toBe('0.0')
    g.applyDart(T(20))
    expect(g.view().average).toBe('180.0')
  })

  it('updates the checkout as darts are staged and resets after a bust', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20)])
    expect(g.view().players[0].primary).toBe('121')
    const base = g.checkoutFor([])
    expect(base).not.toBeUndefined()
    let baseSum = 0
    for (const d of base!) {
      baseSum += dartScore(d)
    }
    expect(baseSum).toBe(121)
    const after = g.checkoutFor([D(8)])
    expect(after).not.toBeUndefined()
    let afterSum = 0
    for (const d of after!) {
      afterSum += dartScore(d)
    }
    expect(afterSum).toBe(105)
    expect(g.checkoutFor([D(8), T(20), T(20)])).toBeUndefined()
    play(g, [D(8), T(20), T(20)])
    expect(g.view().players[0].primary).toBe('121')
    expect(g.view().previous).toBe('BUST')
    expect(g.checkoutFor([])).toEqual(base)
  })

  it('shows BUST as the previous score and leaves it out of the average', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20)])
    expect(g.view().average).toBe('180.0')
    play(g, [T(20), T(20)])
    const v = g.view()
    expect(v.message).toContain('BUST')
    expect(v.previous).toBe('BUST')
    expect(v.average).toBe('180.0')
  })
})

describe('Cricket', function () {
  it('closes a number then scores points on it', function () {
    const g = make('cricket', ['A', 'B'])
    play(g, [T(20), T(20), T(20)])
    const v = g.view()
    expect(v.players[0].marks![0]).toBe(3)
    expect(v.players[0].primary).toBe('120')
  })

  it('keeps scoring a closed number regardless of opponents', function () {
    const g = make('cricket', ['A', 'B'])
    play(g, [T(20), MISS, MISS])
    play(g, [T(20), MISS, MISS])
    expect(g.view().players[0].marks![0]).toBe(3)
    expect(g.view().players[1].marks![0]).toBe(3)
    play(g, [T(20), MISS, MISS])
    expect(g.view().players[0].primary).toBe('60')
  })

  it('counts every bull hit as one mark, needs three to close, then scores the bull value a mark', function () {
    const g = make('cricket', ['A', 'B'])
    play(g, [D(25), S(25)])
    expect(g.view().players[0].marks![6]).toBe(2)
    play(g, [D(25)])
    expect(g.view().players[0].marks![6]).toBe(3)
    expect(g.view().players[0].primary).toBe('0')
    play(g, [MISS, MISS, MISS])
    play(g, [S(25)])
    expect(g.view().players[0].primary).toBe('25')
  })

  it('scores the number value per mark on a closed number by multiplier', function () {
    const g = make('cricket', ['A', 'B'])
    play(g, [T(17)])
    expect(g.view().players[0].marks![3]).toBe(3)
    expect(g.view().players[0].primary).toBe('0')
    play(g, [D(17)])
    expect(g.view().players[0].primary).toBe('34')
    play(g, [T(17)])
    expect(g.view().players[0].primary).toBe('85')
    play(g, [MISS, MISS, MISS])
    play(g, [S(17), MISS, MISS])
    expect(g.view().players[0].primary).toBe('102')
  })

  it('wins on closing everything when not behind', function () {
    const g = make('cricket', ['A'])
    play(g, [T(20), T(19), T(18)])
    play(g, [T(17), T(16), T(15)])
    expect(g.view().finished).toBe(false)
    play(g, [S(25), S(25), S(25)])
    const v = g.view()
    expect(v.finished).toBe(true)
    expect(v.winner).toBe(0)
  })

  it('does not win on closing everything while behind, then wins on catching up', function () {
    const g = make('cricket', ['A', 'B'])
    play(g, [T(18), T(17), T(16)])
    play(g, [T(19), T(19), T(19)])
    expect(g.view().players[1].primary).toBe('114')
    play(g, [T(20), T(19), T(15)])
    play(g, [MISS, MISS, MISS])
    play(g, [S(25), S(25), S(25)])
    expect(g.view().finished).toBe(false)
    play(g, [MISS, MISS, MISS])
    play(g, [T(20), T(20)])
    const v = g.view()
    expect(v.finished).toBe(true)
    expect(v.winner).toBe(0)
    expect(v.players[0].primary).toBe('120')
  })
})

describe('Cricket variants', function () {
  it('no score cricket ignores points and ends on closing every number', function () {
    const g = make('noscore', ['A'])
    play(g, [T(20), T(19), T(18)])
    play(g, [T(17), T(16), T(15)])
    expect(g.view().finished).toBe(false)
    play(g, [S(25), S(25), S(25)])
    const v = g.view()
    expect(v.finished).toBe(true)
    expect(v.winner).toBe(0)
    expect(v.players[0].primary).toBe('')
  })

  it('tactics plays the 10 through 20 and bull board', function () {
    const g = make('tactics', ['A'])
    const v = g.view()
    expect(v.numbers).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 25])
    play(g, [T(10), MISS, MISS])
    expect(g.view().players[0].marks![10]).toBe(3)
  })

  it('random cricket deals seven targets ending on the bull', function () {
    const g = make('random', ['A'])
    const numbers = g.view().numbers!
    expect(numbers.length).toBe(7)
    expect(numbers[6]).toBe(25)
    for (let i = 0; i < 6; i++) {
      expect(numbers[i]).toBeGreaterThanOrEqual(1)
      expect(numbers[i]).toBeLessThanOrEqual(20)
    }
  })
})

describe('undo', function () {
  it('reverts the last dart', function () {
    const g = make('501', ['A'])
    play(g, [T(20)])
    expect(g.view().players[0].primary).toBe('441')
    g.undo()
    expect(g.view().players[0].primary).toBe('501')
  })
})
