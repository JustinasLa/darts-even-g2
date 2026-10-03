import { describe, expect, it } from 'vitest'
import { findGame, gamesByCategory } from './games'
import type { Dart, Game } from './games'

const S = (value: number): Dart => ({ value, mult: 1 })
const D = (value: number): Dart => ({ value, mult: 2 })
const T = (value: number): Dart => ({ value, mult: 3 })
const MISS = S(0)

function make(id: string, names = ['A']): Game {
  return findGame(id)!.create(names, {})
}

function play(game: Game, darts: Dart[]): void {
  for (const dart of darts) game.applyDart(dart)
}

describe('practice registry', function () {
  it('exposes all three requested modes', function () {
    expect(gamesByCategory('practice').map(game => game.id)).toEqual(['clock', 'shanghai', 'countup'])
    for (const id of ['clock', 'shanghai', 'countup']) {
      expect(make(id).checkoutFor([])).toBeUndefined()
      expect(findGame(id)!.options).toEqual([])
    }
  })
})

describe('Around the Clock', function () {
  it('advances exactly one target for any multiplier and can hit several targets per turn', function () {
    const game = make('clock')
    expect(game.view()).toMatchObject({ primaryLabel: 'Target', panel: 'Target\n1' })
    game.applyDart(T(1))
    expect(game.view().players[0].primary).toBe('2')
    expect(game.view().turnTotal).toBe(1)
    play(game, [D(2), S(3)])
    expect(game.view().players[0]).toMatchObject({ primary: '4', secondary: 'Targets hit: 3/20' })
    expect(game.view().turn).toEqual([])
    expect(game.lens(0, [])).toContain('Target: 4\nHit 1–20 in order')
  })

  it('ignores wrong numbers, bull and misses', function () {
    const game = make('clock')
    play(game, [S(20), D(25), MISS])
    expect(game.view().players[0].primary).toBe('1')
    expect(game.view().turnTotal).toBe(0)
    game.applyDart(S(1))
    game.applyDart(S(1))
    expect(game.view().players[0].primary).toBe('2')
    expect(game.view().turnTotal).toBe(1)
  })

  it('keeps separate targets for each player and permits partial turns', function () {
    const game = make('clock', ['A', 'B'])
    play(game, [S(1), S(2)])
    game.commitTurn()
    expect(game.view().players[1]).toMatchObject({ active: true, primary: '1' })
    game.commitTurn()
    expect(game.view().players[0]).toMatchObject({ active: true, primary: '3' })
  })

  it('finishes immediately on twenty and restores the winning target on undo', function () {
    const game = make('clock')
    for (let value = 1; value <= 20; value++) game.applyDart(S(value))
    expect(game.view()).toMatchObject({ finished: true, winner: 0 })
    expect(game.view().players[0]).toMatchObject({ winner: true, primary: '20', secondary: 'Targets hit: 20/20' })
    expect(game.lens(0, [])).toContain('Game over')
    const finished = game.view()
    game.applyDart(MISS)
    game.commitTurn()
    expect(game.view()).toEqual(finished)
    game.undo()
    expect(game.view()).toMatchObject({ finished: false, winner: null })
    expect(game.view().players[0].primary).toBe('20')
    game.applyDart(T(20))
    expect(game.view().finished).toBe(true)
  })

  it('snapshots dart values and turn transitions', function () {
    const game = make('clock')
    const dart = S(1)
    game.applyDart(dart)
    dart.value = 20
    expect(game.view().turn[0].label).toBe('1')
    play(game, [S(2), S(3)])
    game.undo()
    expect(game.view().players[0].primary).toBe('3')
    expect(game.view().turn.map(slot => slot.label)).toEqual(['1', '2'])
  })

  it('projects staged targets in order without changing scores or undo history', function () {
    const game = make('clock', ['A', 'B'])
    const initial = game.view()
    const draft = [T(1), D(2), S(3)]
    const preview = game.view(draft)
    expect(preview).toMatchObject({ panel: 'Target\n4', entryTarget: 4, turnTotal: 3, finished: false })
    expect(preview.players.map(player => player.primary)).toEqual(['4', '1'])
    expect(preview.turn.map(slot => slot.label)).toEqual(['T1', 'D2', '3'])
    expect(game.lens(3, draft)).toContain('Target: 4')
    expect(game.view()).toEqual(initial)
    draft[0] = S(20)
    expect(game.view(draft)).toMatchObject({ panel: 'Target\n1', entryTarget: 1, turnTotal: 0 })
    expect(game.view(draft).players[0].primary).toBe('1')
    game.undo()
    expect(game.view()).toEqual(initial)
    game.applyDart(S(1))
    game.view([S(2)])
    game.undo()
    expect(game.view()).toEqual(initial)
  })

  it('caps drafts at the remaining darts in a partial visit', function () {
    const game = make('clock')
    game.applyDart(S(1))
    const preview = game.view([S(2), S(3), S(4)])
    expect(preview.players[0].primary).toBe('4')
    expect(preview.turn.map(slot => slot.label)).toEqual(['1', '2', '3'])
    expect(game.view().players[0].primary).toBe('2')
  })

  it('projects absolute row prefixes across applied darts and pending drafts', function () {
    const game = make('clock', ['A', 'B'])
    const initial = game.view()
    play(game, [T(1), D(2)])
    const before = game.view()
    const pending = [S(3), T(4)]
    for (let row = 0; row <= 3; row++) {
      const preview = game.view(pending, row)
      expect(preview).toMatchObject({ entryTarget: row + 1, turnTotal: row, finished: false })
      expect(preview.turn).toHaveLength(row)
      expect(preview.players.map(player => player.primary)).toEqual([String(row + 1), '1'])
    }
    expect(game.view()).toEqual(before)
    expect(game.currentTurn()).toEqual([T(1), D(2)])
    expect(game.lens(3, pending)).toContain('Dart 1: T1\n  Dart 2: D2\n  Dart 3: 3')
    pending[0] = S(20)
    expect(game.view(pending, 2).entryTarget).toBe(3)
    expect(game.view(pending, 3)).toMatchObject({ entryTarget: 3, turnTotal: 2 })
    game.undo()
    expect(game.view().entryTarget).toBe(2)
    game.undo()
    expect(game.view()).toEqual(initial)
  })

  it('reconstructs the current visit target after earlier visits and wrong applied darts', function () {
    const game = make('clock')
    play(game, [S(1), S(2), S(3)])
    const start = game.view()
    play(game, [T(20), D(4)])
    const before = game.view()
    const pending = [T(5)]
    expect([0, 1, 2, 3].map(row => game.view(pending, row).entryTarget)).toEqual([4, 4, 5, 6])
    expect([0, 1, 2, 3].map(row => game.view(pending, row).turnTotal)).toEqual([0, 0, 1, 2])
    expect(game.view()).toEqual(before)
    game.undo()
    game.undo()
    expect(game.view()).toEqual(start)
  })

  it('projects a winning draft after an applied nineteen without committing or duplicating it', function () {
    const game = make('clock')
    for (let value = 1; value <= 18; value++) game.applyDart(S(value))
    const beforeNineteen = game.view()
    game.applyDart(D(19))
    const before = game.view()
    const pending = [T(20), MISS]
    expect(game.view(pending, 0).entryTarget).toBe(19)
    expect(game.view(pending, 1)).toMatchObject({ entryTarget: 20, turnTotal: 1 })
    const preview = game.view(pending)
    expect(preview).toMatchObject({ entryTarget: 20, turnTotal: 2, finished: false, winner: null })
    expect(preview.players[0].secondary).toBe('Targets hit: 20/20')
    expect(preview.turn.map(slot => slot.label)).toEqual(['D19', 'T20'])
    expect(game.view()).toEqual(before)
    game.undo()
    expect(game.view()).toEqual(beforeNineteen)
  })

  it('shows a non-first active player target and preserves that player after winning', function () {
    const game = make('clock', ['A', 'B'])
    play(game, [S(1), S(2)])
    game.commitTurn()
    expect(game.lens(0, [])).toMatch(/^Target: 1\n/)
    expect(game.lens(1, [T(1)])).toMatch(/^Target: 2\n/)
    expect(game.view().players.map(player => player.primary)).toEqual(['3', '1'])
    for (let value = 1; value <= 20; value++) {
      game.applyDart(S(value))
      if (!game.view().finished && !game.view().players[1].active) game.commitTurn()
    }
    expect(game.view()).toMatchObject({ finished: true, winner: 1 })
    expect(game.view().players.map(player => player.primary)).toEqual(['3', '20'])
    expect(game.lens(0, [S(1)])).toMatch(/^Target: 20\n/)
    expect(game.lens(0, [])).toContain('Game over')
    game.undo()
    expect(game.view().players[1]).toMatchObject({ active: true, winner: false, primary: '20' })
  })

  it('previews twenty without finishing and stops projecting after a win', function () {
    const game = make('clock')
    for (let value = 1; value <= 18; value++) game.applyDart(S(value))
    const draft = [D(19), T(20), MISS]
    expect(game.view(draft)).toMatchObject({ finished: false, winner: null, entryTarget: 20, turnTotal: 2 })
    expect(game.view(draft).players[0].secondary).toBe('Targets hit: 20/20')
    expect(game.view(draft).turn).toHaveLength(2)
    expect(game.view().players[0].primary).toBe('19')
    play(game, draft)
    const finished = game.view()
    expect(game.view([MISS])).toEqual(finished)
  })
})

describe('Shanghai', function () {
  it.each([
    [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1],
  ])('wins for the single-double-triple order %j', function (a, b, c) {
    const game = make('shanghai')
    play(game, [a, b, c].map(mult => ({ value: 1, mult })))
    expect(game.view()).toMatchObject({ finished: true, winner: 0, turnTotal: 6 })
    expect(game.view().players[0].primary).toBe('6')
    const finished = game.view()
    game.applyDart(T(1))
    game.commitTurn()
    expect(game.view()).toEqual(finished)
    game.undo()
    expect(game.view()).toMatchObject({ finished: false, winner: null })
    game.applyDart({ value: 1, mult: c })
    expect(game.view().finished).toBe(true)
  })

  it('scores only the fixed round target with normal multipliers', function () {
    const game = make('shanghai')
    expect(game.view()).toMatchObject({ hint: 'Round 1/7 · Target 1', entryTarget: 1, panel: 'Target\n1\n\nRound\n1/7' })
    play(game, [D(1), T(20)])
    expect(game.view().players[0].primary).toBe('2')
    expect(game.view().turnTotal).toBe(2)
    game.applyDart(S(25))
    expect(game.view().hint).toBe('Round 2/7 · Target 2')
  })

  it('does not count repeated multipliers or different target numbers as a Shanghai', function () {
    const game = make('shanghai')
    play(game, [S(1), S(1), S(1)])
    expect(game.view().finished).toBe(false)
    expect(game.view().players[0].primary).toBe('3')
    play(game, [S(3), D(3), T(3)])
    expect(game.view().finished).toBe(false)
    expect(game.view().players[0].primary).toBe('3')
  })

  it('resets segment tracking on a partial turn and keeps all players on the same round', function () {
    const game = make('shanghai', ['A', 'B'])
    play(game, [S(1), D(1)])
    game.commitTurn()
    expect(game.view().hint).toBe('Round 1/7 · Target 1')
    expect(game.view().players[1].active).toBe(true)
    game.applyDart(T(1))
    expect(game.view().finished).toBe(false)
    game.commitTurn()
    expect(game.view().hint).toBe('Round 2/7 · Target 2')
    game.applyDart(T(2))
    expect(game.view().finished).toBe(false)
  })

  it('finishes after seven rounds and selects the highest total', function () {
    const game = make('shanghai', ['A', 'B'])
    for (let round = 1; round <= 7; round++) {
      play(game, [T(round), T(round), T(round)])
      expect(game.view().finished).toBe(false)
      play(game, [S(round), MISS, MISS])
    }
    expect(game.view()).toMatchObject({ finished: true, winner: 0, hint: 'Round 7/7 · Target 7' })
    expect(game.view().players.map(player => player.primary)).toEqual(['252', '28'])
    expect(game.view().players[0].winner).toBe(true)
  })

  it('restores round and combo state after automatic turn completion', function () {
    const game = make('shanghai')
    play(game, [S(1), D(1), MISS])
    expect(game.view().hint).toContain('Round 2/7')
    game.undo()
    expect(game.view().hint).toContain('Round 1/7')
    game.applyDart(T(1))
    expect(game.view().finished).toBe(true)
  })

  it('previews a non-first player Shanghai and wins even when behind on points', function () {
    const game = make('shanghai', ['A', 'B'])
    play(game, [T(1), T(1), T(1), S(1), D(1)])
    const before = game.view()
    const preview = game.view([T(1)])
    expect(preview).toMatchObject({ finished: false, winner: null, turnTotal: 6 })
    expect(preview.players.map(player => player.primary)).toEqual(['9', '3'])
    expect(game.lens(3, [T(1)])).toContain('Current Score: 3\n')
    expect(game.view()).toEqual(before)
    game.applyDart(T(1))
    expect(game.view()).toMatchObject({ finished: true, winner: 1 })
    expect(game.lens(0, [])).toContain('Current Score: 6\n')
    expect(game.view([T(20)])).toEqual(game.view())
    game.undo()
    expect(game.view()).toEqual(before)
  })
})

describe('practice draft ownership and multiplayer lens', function () {
  it.each([
    { id: 'shanghai', total: 3 },
    { id: 'countup', total: 63 },
  ])('counts only scoring darts in a capped $id draft without changing the recorded game', function ({ id, total }) {
    const game = make(id)
    const initial = game.view()
    game.applyDart(D(1))
    const before = game.view()
    const pending = [T(20), S(1), D(25)]
    const preview = game.view(pending)
    expect(preview.turn.map(slot => slot.label)).toEqual(['D1', 'T20', '1'])
    expect(preview.turnTotal).toBe(total)
    expect(preview.players).toEqual(before.players)
    expect(preview.hint).toBe(before.hint)
    expect(game.lens(3, pending)).toContain('Dart 1: D1\n  Dart 2: T20\n  Dart 3: 1')
    pending[0].value = 2
    expect(preview.turn[1]).toEqual({ label: 'T20', score: 60 })
    preview.turn[0].score = 999
    preview.players[0].primary = '999'
    expect(game.view()).toEqual(before)
    expect(game.currentTurn()).toEqual([D(1)])
    game.undo()
    expect(game.view()).toEqual(initial)
  })

  it.each([
    { id: 'shanghai', rounds: 7, final: '252' },
    { id: 'countup', rounds: 8, final: '1440' },
  ])('shows a non-first active player and final winner in $id', function ({ id, rounds, final }) {
    const game = make(id, ['A', 'B'])
    for (let round = 1; round <= rounds; round++) {
      const target = id === 'shanghai' ? round : 20
      play(game, [S(target), MISS, MISS])
      expect(game.view().players[1].active).toBe(true)
      const previous = id === 'shanghai' ? 9 * (round - 1) * round / 2 : 180 * (round - 1)
      expect(game.lens(0, [])).toMatch(new RegExp('^Current Score: ' + previous + '\n'))
      play(game, [T(target), T(target), T(target)])
    }
    expect(game.view()).toMatchObject({ finished: true, winner: 1 })
    expect(game.view().players[1]).toMatchObject({ primary: final, winner: true, active: false })
    expect(game.lens(0, [])).toMatch(new RegExp('^Current Score: ' + final + '\n'))
    const finished = game.view()
    expect(game.view([T(20), D(25)])).toEqual(finished)
    game.undo()
    expect(game.view().players[1]).toMatchObject({ active: true, winner: false })
    expect(game.view().turn).toHaveLength(2)
  })
})

describe('Count Up', function () {
  it('scores twenty-four triples as 1440 and finishes in eight rounds', function () {
    const game = make('countup')
    expect(game.view()).toMatchObject({ hint: 'Round 1/8', panel: 'Round\n1/8' })
    for (let i = 0; i < 23; i++) game.applyDart(T(20))
    expect(game.view().finished).toBe(false)
    game.applyDart(T(20))
    expect(game.view()).toMatchObject({ finished: true, winner: 0, hint: 'Round 8/8' })
    expect(game.view().players[0].primary).toBe('1440')
  })

  it('scores bulls as twenty-five and fifty and counts misses as darts', function () {
    const game = make('countup')
    play(game, [S(25), D(25)])
    expect(game.view().turnTotal).toBe(75)
    game.applyDart(MISS)
    expect(game.view().players[0].primary).toBe('75')
    expect(game.view().hint).toBe('Round 2/8')
  })

  it('uses normal per-segment arithmetic independently of target modes', function () {
    for (let value = 1; value <= 20; value++) {
      for (let mult = 1; mult <= 3; mult++) {
        const game = make('countup')
        game.applyDart({ value, mult })
        expect(game.view().players[0].primary).toBe(String(value * mult))
      }
    }
  })

  it('waits for every player and permits partial or empty visits', function () {
    const game = make('countup', ['A', 'B'])
    game.applyDart(S(20))
    game.commitTurn()
    expect(game.view().hint).toBe('Round 1/8')
    expect(game.view().players[1].active).toBe(true)
    for (let turn = 0; turn < 14; turn++) game.commitTurn()
    expect(game.view().finished).toBe(false)
    game.commitTurn()
    expect(game.view()).toMatchObject({ finished: true, winner: 0 })
    expect(game.view().players[0].primary).toBe('20')
  })

  it.each(['shanghai', 'countup'])('declares equal multiplayer totals a draw in %s', function (id) {
    const game = make(id, ['A', 'B'])
    const rounds = id === 'shanghai' ? 7 : 8
    for (let turn = 0; turn < rounds * 2; turn++) game.commitTurn()
    expect(game.view()).toMatchObject({ finished: true, winner: null, message: 'Draw' })
    expect(game.view().players.every(player => !player.winner && !player.active)).toBe(true)
    expect(game.lens(0, [])).toContain('Game over\nDraw')
  })

  it.each(['shanghai', 'countup'])('finishes a zero-score solo game with a winner in %s', function (id) {
    const game = make(id)
    const rounds = id === 'shanghai' ? 7 : 8
    for (let round = 0; round < rounds; round++) game.commitTurn()
    expect(game.view()).toMatchObject({ finished: true, winner: 0, message: '' })
    expect(game.view().players[0]).toMatchObject({ primary: '0', winner: true })
  })

  it('restores score and round when undoing the last dart', function () {
    const game = make('countup')
    for (let i = 0; i < 24; i++) game.applyDart(T(20))
    const finished = game.view()
    game.applyDart(MISS)
    game.commitTurn()
    expect(game.view()).toEqual(finished)
    game.undo()
    expect(game.view()).toMatchObject({ finished: false, winner: null, hint: 'Round 8/8' })
    expect(game.view().players[0].primary).toBe('1380')
    expect(game.view().turn).toHaveLength(2)
  })
})
