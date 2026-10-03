import { describe, it, expect, vi } from 'vitest'
import { GAMES, gamesByCategory, findGame, dartLabel, dartScore, findCheckout } from './games'
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

function segmentScore(d: Dart): number {
  return d.value === 25 ? (d.mult === 1 ? 25 : 50) : d.value * d.mult
}

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
  it('scores every numbered single, double and triple', function () {
    for (let value = 1; value <= 20; value++) {
      for (const mult of [1, 2, 3]) {
        expect(dartScore({ value, mult }), String(value) + 'x' + mult).toBe(value * mult)
      }
    }
  })

  it('scores bulls and misses', function () {
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
    expect(segmentScore(r![0])).toBe(40)
  })

  it('always finishes on a double', function () {
    const r = findCheckout(170)
    expect(r).not.toBeNull()
    expect(r![r!.length - 1].mult).toBe(2)
    let sum = 0
    for (const d of r!) {
      sum += segmentScore(d)
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
      baseSum += segmentScore(d)
    }
    expect(baseSum).toBe(121)
    expect(g.checkoutFor([D(8)])).toBeUndefined()
    const after = g.checkoutFor([T(20)])
    expect(after).not.toBeUndefined()
    let afterSum = 0
    for (const d of after!) {
      afterSum += segmentScore(d)
    }
    expect(afterSum).toBe(61)
    expect(g.checkoutFor([D(8), T(20), T(20)])).toBeUndefined()
    play(g, [D(8), T(20), T(20)])
    expect(g.view().players[0].primary).toBe('121')
    expect(g.view().previous).toBe('BUST')
    expect(g.checkoutFor([])).toEqual(base)
  })

  it('shows BUST as the previous score and counts a zero-point visit in the average', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20)])
    expect(g.view().average).toBe('180.0')
    play(g, [T(20), T(20)])
    const v = g.view()
    expect(v.message).toContain('BUST')
    expect(v.previous).toBe('BUST')
    expect(v.average).toBe('90.0')
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

describe('game definitions', function () {
  it('lists every game in its category and rejects unknown ids', function () {
    expect(gamesByCategory('x01').map(g => g.id)).toEqual(['301', '501', '701', '901'])
    expect(gamesByCategory('cricket').map(g => g.id)).toEqual(['cricket', 'noscore', 'tactics', 'random'])
    expect(findGame('unknown')).toBeUndefined()
    for (const def of GAMES) {
      expect(findGame(def.id)).toBe(def)
      expect(def.minPlayers).toBe(1)
      expect(def.maxPlayers).toBe(4)
      expect(def.create(['A'], {}).view().players).toHaveLength(1)
    }
  })

  it.each(['301', '501', '701', '901'])('starts %s at its advertised score', function (id) {
    const g = make(id, ['A', 'B', 'C', 'D'])
    expect(g.view().title).toBe(id)
    expect(g.view().players.map(p => p.primary)).toEqual([id, id, id, id])
    expect(g.view().players.map(p => p.active)).toEqual([true, false, false, false])
  })
})

describe('dart labels', function () {
  it.each([
    [MISS, '—'], [S(20), '20'], [D(20), 'D20'], [T(20), 'T20'],
    [S(25), '25'], [D(25), 'Bull'], [T(25), 'Bull'],
  ] as const)('labels %o as %s', function (dart, label) {
    expect(dartLabel(dart)).toBe(label)
  })

  it('caps bull scoring at fifty', function () {
    expect(dartScore(T(25))).toBe(50)
  })
})

describe('checkout routes', function () {
  it('returns a shortest valid route for every possible checkout', function () {
    const segments = [S(25), D(25)]
    for (let n = 1; n <= 20; n++) segments.push(S(n), D(n), T(n))
    const doubles = segments.filter(d => d.mult === 2)
    const shortest = new Map<number, number>()
    for (const last of doubles) shortest.set(segmentScore(last), 1)
    for (const first of segments) {
      for (const last of doubles) {
        const score = segmentScore(first) + segmentScore(last)
        if (!shortest.has(score)) shortest.set(score, 2)
      }
    }
    for (const first of segments) {
      for (const second of segments) {
        for (const last of doubles) {
          const score = segmentScore(first) + segmentScore(second) + segmentScore(last)
          if (!shortest.has(score)) shortest.set(score, 3)
        }
      }
    }
    for (let score = 2; score <= 170; score++) {
      const route = findCheckout(score)
      if (!shortest.has(score)) {
        expect(route, String(score)).toBeNull()
      } else {
        expect(route, String(score)).not.toBeNull()
        expect(route!.length, String(score)).toBe(shortest.get(score))
        expect(route!.reduce((sum, d) => sum + segmentScore(d), 0)).toBe(score)
        expect(route!.at(-1)!.mult).toBe(2)
        for (const dart of route!) expect(segments).toContainEqual(dart)
      }
    }
  })

  it.each([-10, 0, 1, 171, 200])('cannot check out %s', function (score) {
    expect(findCheckout(score)).toBeNull()
  })
})

describe('X01 options and match progression', function () {
  function winLeg(g: Game): void {
    play(g, [T(20), T(20), T(20), T(20), T(15), D(8)])
  }

  it('waits for a double-in and counts the opening double', function () {
    const g = make('301', ['A'], { doubleIn: 'on' })
    expect(g.view().players[0].secondary).toBe('Hit a double to start')
    play(g, [S(20), T(20), D(20)])
    expect(g.view().players[0]).toMatchObject({ primary: '261', secondary: '' })
    expect(g.view().previous).toBe('40')
    expect(g.view().average).toBe('40.0')
  })

  it('advances after three darts that do not double in', function () {
    const g = make('301', ['A', 'B'], { doubleIn: 'on' })
    play(g, [S(20), T(20), MISS])
    expect(g.view().players[0].primary).toBe('301')
    expect(g.view().players[1].active).toBe(true)
  })

  it('accepts a bull as double-in', function () {
    const g = make('301', ['A'], { doubleIn: 'on' })
    g.applyDart(D(25))
    expect(g.view().players[0]).toMatchObject({ primary: '251', secondary: '' })
  })

  it('allows a single finish with double-out disabled', function () {
    const g = make('301', ['A'], { doubleOut: 'off' })
    expect(g.checkoutFor([])).toBeUndefined()
    play(g, [T(20), T(20), T(20), T(20), T(20), S(1)])
    expect(g.view()).toMatchObject({ finished: true, winner: 0 })
    const finished = g.view()
    g.applyDart(S(20))
    g.commitTurn()
    expect(g.view()).toEqual(finished)
    expect(g.checkoutFor([])).toBeUndefined()
  })

  it.each(['on', 'off'])('rolls back an overshoot with double-out %s', function (doubleOut) {
    const g = make('301', ['A'], { doubleOut })
    play(g, [T(20), T(20), T(20), T(20), T(19), D(8)])
    expect(g.view()).toMatchObject({ previous: 'BUST', average: '90.0', turn: [] })
    expect(g.view().players[0].primary).toBe('121')
    g.undo()
    expect(g.view().players[0].primary).toBe('4')
    expect(g.view().turn).toHaveLength(2)
  })

  it('rotates players and commits partial and empty turns', function () {
    const g = make('301', ['A', 'B'])
    g.applyDart(S(20))
    expect(g.view()).toMatchObject({ turn: [{ label: '20', score: 20 }], turnTotal: 20 })
    g.commitTurn()
    expect(g.view().previous).toBe('20')
    expect(g.view().players[1].active).toBe(true)
    g.commitTurn()
    expect(g.view().previous).toBe('0')
    expect(g.view().players[0].active).toBe(true)
    expect(g.view().average).toBe('60.0')
  })

  it('uses defaults when integer options are invalid', function () {
    const g = make('301', ['A'], { legs: 'invalid', sets: 'invalid' })
    winLeg(g)
    expect(g.view().finished).toBe(true)
  })

  it('plays multiple legs and resets scores and double-in between legs', function () {
    const g = make('301', ['A'], { legs: '3', doubleIn: 'on' })
    expect(g.view().players[0].secondary).toBe('Hit a double to start')
    play(g, [D(20), T(20), T(20), T(20), T(15), D(18)])
    expect(g.view().finished).toBe(false)
    expect(g.view().players[0]).toMatchObject({ primary: '301', secondary: 'Hit a double to start' })
    g.applyDart(D(20))
    expect(g.view().players[0].secondary).toBe('Left · L 1/3')
  })

  it('resets every player at a new set and wins at the set target', function () {
    const g = make('301', ['A', 'B'], { legs: '1', sets: '2' })
    play(g, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(15), D(8)])
    expect(g.view().players.map(p => p.primary)).toEqual(['301', '301'])
    expect(g.view().players.map(p => p.secondary)).toEqual(['S 1 · L 0', 'S 0 · L 0'])
    expect(g.view().players[1].active).toBe(true)
    g.commitTurn()
    play(g, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(15), D(8)])
    expect(g.view()).toMatchObject({ finished: true, winner: 0 })
    expect(g.view().players[0]).toMatchObject({ winner: true, active: false, secondary: 'S 2 · L 1' })
    expect(g.checkoutFor([])).toBeUndefined()
  })

  it('does not suggest routes for high, bust, or bogey scores', function () {
    const g = make('301', ['A'])
    expect(g.checkoutFor([])).toBeUndefined()
    play(g, [T(20), T(20), S(12)])
    expect(g.checkoutFor([])).toBeUndefined()
    play(g, [T(20), T(19), S(12)])
    expect(g.checkoutFor([T(20)])).toBeUndefined()
    expect(g.checkoutFor([T(20), T(20), T(20), T(20)])).toBeUndefined()
  })
})

describe('X01 leg statistics and starters', function () {
  it.each([
    { checkoutDarts: 1, darts: [T(20), T(20), T(20), T(19), S(20), S(4), D(20)], average: '129.0', previous: '40' },
    { checkoutDarts: 2, darts: [T(20), T(20), T(20), T(20), S(19), MISS, S(2), D(20)], average: '112.9', previous: '42' },
    { checkoutDarts: 3, darts: [T(20), T(20), T(20), T(20), T(15), D(8)], average: '150.5', previous: '121' },
  ])('includes a $checkoutDarts-dart checkout in the final average', function ({ checkoutDarts, darts, average, previous }) {
    const g = make('301', ['A'])
    play(g, darts)
    expect(g.view()).toMatchObject({ finished: true, winner: 0, average, previous, turn: [], turnTotal: 0 })
    g.undo()
    expect(g.view().finished).toBe(false)
    expect(g.view().turn).toHaveLength(checkoutDarts - 1)
    g.applyDart(darts.at(-1)!)
    expect(g.view()).toMatchObject({ finished: true, average, previous })
  })

  it.each([{ legs: '3', sets: '1' }, { legs: '1', sets: '2' }])('starts fresh statistics at the next leg with %o', function (opts) {
    const g = make('301', ['A'], opts)
    play(g, [T(20), T(20), T(20), T(20), T(15), D(8)])
    expect(g.view()).toMatchObject({ finished: false, average: '0.0', turnTotal: 0 })
    expect(g.view().players[0].primary).toBe('301')
    play(g, [MISS, MISS, MISS])
    expect(g.view().average).toBe('0.0')
    play(g, [T(20), T(20), T(20)])
    expect(g.view().average).toBe('90.0')
  })

  it.each([{ legs: '3', sets: '1' }, { legs: '1', sets: '2' }])('resets every player at a leg boundary with %o', function (opts) {
    const g = make('301', ['A', 'B'], opts)
    play(g, [T(20), T(20), T(20), S(20), S(20), S(20), T(20), T(15), D(8)])
    expect(g.view().players.map(p => p.primary)).toEqual(['301', '301'])
    expect(g.view().players[1].active).toBe(true)
    expect(g.view().average).toBe('0.0')
    play(g, [MISS, MISS, MISS])
    expect(g.view().players[0].active).toBe(true)
    expect(g.view().average).toBe('0.0')
    g.undo()
    expect(g.view().players[1].active).toBe(true)
    expect(g.view().turn).toHaveLength(2)
  })

  it.each([
    { bustDart: 1, scored: [T(20), T(20), T(20), T(19), S(20), S(4)], bust: [T(20)], score: '40', average: '87.0', before: '130.5' },
    { bustDart: 2, scored: [T(20), T(20), T(20)], bust: [T(20), T(20)], score: '121', average: '90.0', before: '180.0' },
    { bustDart: 3, scored: [T(20), T(20), T(20)], bust: [T(20), T(19), D(8)], score: '121', average: '90.0', before: '180.0' },
  ])('counts a dart-$bustDart bust as three darts without its points', function ({ bustDart, scored, bust, score, average, before }) {
    const g = make('301', ['A'])
    play(g, scored)
    expect(g.view().average).toBe(before)
    play(g, bust)
    expect(g.view()).toMatchObject({ previous: 'BUST', average, turn: [], turnTotal: 0 })
    expect(g.view().players[0].primary).toBe(score)
    g.undo()
    expect(g.view().turn).toHaveLength(bustDart - 1)
    expect(g.view().average).toBe(before)
    g.applyDart(bust.at(-1)!)
    expect(g.view()).toMatchObject({ previous: 'BUST', average })
  })

  it('includes a busted visit and the checkout in the completed leg average', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20), T(20), T(19), D(8), T(20), T(15), D(8)])
    expect(g.view()).toMatchObject({ finished: true, previous: '121', average: '100.3', turnTotal: 0 })
  })

  it.each(['A', 'B'])('alternates leg starters when %s wins the opening leg', function (winner) {
    const g = make('301', ['A', 'B'], { legs: '3' })
    if (winner === 'B') play(g, [MISS, MISS, MISS])
    play(g, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(15), D(8)])
    expect(g.view().players[1].active).toBe(true)
    play(g, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(15), D(8)])
    expect(g.view().players[0].active).toBe(true)
    g.undo()
    expect(g.view().players[1].active).toBe(true)
    expect(g.view().players[1].primary).toBe('16')
    g.applyDart(D(8))
    expect(g.view().players[0].active).toBe(true)
  })
})

describe('X01 checkout previews and opening scores', function () {
  it('limits staged routes to the darts left in the turn', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20)])
    expect(g.checkoutFor([D(8)])).toBeUndefined()
    expect(g.checkoutFor([T(20)])).toEqual([T(19), D(2)])
    expect(g.checkoutFor([T(19), D(12)])).toEqual([D(20)])
    expect(g.checkoutFor([S(1), S(20), S(20)])).toBeUndefined()
    expect(g.checkoutFor([T(20), T(20)])).toBeUndefined()
  })

  it('counts both applied and pending darts toward a route budget', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20), S(1), D(8)])
    expect(g.checkoutFor([])).toBeUndefined()
    expect(g.checkoutFor([MISS])).toBeUndefined()
    g.undo()
    g.undo()
    g.applyDart(T(19))
    expect(g.checkoutFor([])).toEqual([T(20), D(2)])
    expect(g.checkoutFor([D(12)])).toEqual([D(20)])
    g.applyDart(D(12))
    expect(g.checkoutFor([])).toEqual([D(20)])
    expect(g.checkoutFor([MISS])).toBeUndefined()
  })

  it('projects pending double-in darts without changing the game', function () {
    const g = make('301', ['A'], { doubleIn: 'on' })
    const initial = g.view()
    expect(g.checkoutFor([])).toBeUndefined()
    expect(g.checkoutFor([S(20)])).toBeUndefined()
    expect(g.checkoutFor([S(20), D(25)])).toBeUndefined()
    expect(g.checkoutFor([D(25), T(20)])).toBeUndefined()
    expect(g.checkoutFor([T(20), T(20), T(20)])).toBeUndefined()
    expect(g.view()).toEqual(initial)
    play(g, [S(20), T(20), D(20), T(20), T(20), MISS])
    const opened = g.view()
    expect(g.checkoutFor([T(20)])).toEqual([T(19), D(12)])
    expect(g.view()).toEqual(opened)
  })

  it('reports only scored darts in a double-in turn total', function () {
    const g = make('301', ['A'], { doubleIn: 'on' })
    g.applyDart(S(20))
    expect(g.view()).toMatchObject({ turnTotal: 0, average: '0.0' })
    expect(g.view().players[0].primary).toBe('301')
    g.applyDart(D(20))
    expect(g.view().turnTotal).toBe(40)
    expect(g.view().players[0].primary).toBe('261')
    g.applyDart(T(20))
    expect(g.view()).toMatchObject({ turnTotal: 0, previous: '100', average: '100.0' })
    g.undo()
    expect(g.view()).toMatchObject({ turnTotal: 40, average: '0.0' })
  })
})

describe('engine input and view ownership', function () {
  it.each(['301', 'cricket'])('copies darts applied to %s', function (id) {
    const g = make(id, ['A'])
    const dart = T(20)
    g.applyDart(dart)
    const before = g.view()
    dart.value = 1
    dart.mult = 1
    expect(g.view()).toEqual(before)
    g.applyDart(D(19))
    g.undo()
    expect(g.view()).toEqual(before)
  })

  it.each(['cricket', 'noscore', 'tactics', 'random'])('returns independent target arrays for %s', function (id) {
    const g = make(id, ['A'])
    const targets = g.view().numbers!
    const before = targets.slice()
    targets.reverse()
    targets[0] = 1
    targets.push(0)
    expect(g.view().numbers).toEqual(before)
    g.applyDart(T(before[0]))
    expect(g.view().players[0].marks![0]).toBe(3)
  })

  it('isolates target arrays across existing and future standard games', function () {
    const first = make('cricket', ['A'])
    const existing = make('noscore', ['B'])
    first.view().numbers![0] = 1
    const later = make('cricket', ['C'])
    const targets = [20, 19, 18, 17, 16, 15, 25]
    for (const g of [first, existing, later]) {
      expect(g.view().numbers).toEqual(targets)
      g.applyDart(T(20))
      expect(g.view().players[0].marks![0]).toBe(3)
    }
  })
})

describe('Cricket state and history', function () {
  it('ignores misses and numbers outside the board while rotating turns', function () {
    const g = make('cricket', ['A', 'B'])
    play(g, [MISS, T(14)])
    expect(g.view()).toMatchObject({ turnTotal: 42 })
    expect(g.view().players[0].marks).toEqual([0, 0, 0, 0, 0, 0, 0])
    g.commitTurn()
    expect(g.view().players[1].active).toBe(true)
  })

  it('discards overflowing marks when scoring is disabled', function () {
    const g = make('noscore', ['A'])
    play(g, [T(20), T(20)])
    expect(g.view().players[0]).toMatchObject({ primary: '', marks: [3, 0, 0, 0, 0, 0, 0] })
    expect(g.checkoutFor([])).toBeUndefined()
  })

  it('does not mutate the game through the marks returned by view', function () {
    const g = make('cricket', ['A'])
    g.view().players[0].marks![0] = 3
    expect(g.view().players[0].marks![0]).toBe(0)
  })

  it.each(['cricket', 'noscore'])('ignores play after winning %s and can undo the win', function (id) {
    const g = make(id, ['A'])
    play(g, [T(20), T(19), T(18), T(17), T(16), T(15), S(25), S(25), S(25)])
    const finished = g.view()
    g.applyDart(T(20))
    g.commitTurn()
    expect(g.view()).toEqual(finished)
    g.undo()
    expect(g.view()).toMatchObject({ finished: false, winner: null })
    expect(g.view().players[0].marks![6]).toBe(2)
  })

  it('retains only the last three hundred dart snapshots', function () {
    const g = make('cricket', ['A'])
    for (let i = 0; i < 305; i++) g.applyDart(MISS)
    for (let i = 0; i < 300; i++) g.undo()
    expect(g.view().turn).toHaveLength(2)
    const oldest = g.view()
    g.undo()
    expect(g.view()).toEqual(oldest)
  })

  it('undoing a fresh game is harmless', function () {
    const g = make('301', ['A'])
    const initial = g.view()
    g.undo()
    expect(g.view()).toEqual(initial)
  })

  it('shuffles distinct random targets and sorts them descending', function () {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const g = make('random', ['A'])
      expect(g.view().numbers).toEqual([7, 6, 5, 4, 3, 2, 25])
      expect(random).toHaveBeenCalledTimes(19)
    } finally {
      random.mockRestore()
    }
  })
})

describe('lens scoreboard', function () {
  it('shows the active X01 player and the winner after the match', function () {
    const g = make('301', ['A', 'B'])
    g.applyDart(S(20))
    g.commitTurn()
    expect(g.lens(0, [])).toContain('Current Score: 301\n')
    play(g, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(15), D(8)])
    expect(g.view().winner).toBe(1)
    expect(g.lens(0, [])).toContain('Current Score: 0\n')
    expect(g.lens(0, [])).toContain('Leg Average: 150.5\n\nGame over')
  })

  it('shows the active Cricket player score', function () {
    const g = make('cricket', ['A', 'B'])
    play(g, [T(20), T(20), T(20)])
    expect(g.lens(0, [])).toContain('Current Score: 0\n')
    play(g, [T(19), T(19)])
    expect(g.lens(0, [])).toContain('Current Score: 57\n')
  })

  it('shows committed score, previous turn and average alongside staged darts', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20)])
    const before = g.view()
    expect(g.lens(3, [D(20), S(25), MISS])).toBe(
      'Current Score: 121\nPrevious Score: 180\nLeg Average: 180.0\n\n  Dart 1: D20\n  Dart 2: 25\n  Dart 3: —\n\n> Confirm Score',
    )
    expect(g.view()).toEqual(before)
  })

  it('uses the current turn when no darts are staged', function () {
    const g = make('301', ['A'])
    g.applyDart(T(20))
    expect(g.lens(0, [])).toContain('> Dart 1: T20\n  Dart 2: \n  Dart 3: ')
  })

  it('omits score and statistics for no-score cricket and empty scoreboards', function () {
    const g = make('noscore', ['A'])
    expect(g.lens(1, [])).toBe('\n  Dart 1: \n> Dart 2: \n  Dart 3: \n\n  Confirm Score')
    expect(make('cricket', []).lens(1, [])).toBe(g.lens(1, []))
  })

  it('replaces entry rows with the game-over message after a win', function () {
    const g = make('301', ['A'])
    play(g, [T(20), T(20), T(20), T(20), T(15), D(8)])
    expect(g.lens(0, [S(20)])).toContain('\n\nGame over')
    expect(g.lens(0, [])).not.toContain('Dart 1')
  })
})
