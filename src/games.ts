import { t } from './i18n'
import type { StringKey } from './i18n'

export interface Dart {
  value: number
  mult: number
}

export function dartScore(d: Dart): number {
  if (d.value === 0) {
    return 0
  }
  if (d.value === 25) {
    if (d.mult >= 2) {
      return 50
    }
    return 25
  }
  return d.value * d.mult
}

export function dartLabel(d: Dart): string {
  if (d.value === 0) {
    return '—'
  }
  if (d.value === 25) {
    if (d.mult >= 2) {
      return t('bullEye')
    }
    return t('bull')
  }
  let prefix = ''
  if (d.mult === 3) {
    prefix = t('triple')
  } else if (d.mult === 2) {
    prefix = t('double')
  }
  return prefix + d.value
}

export type Category = 'x01' | 'cricket'
export type Layout = 'score' | 'cricket'

export interface PlayerView {
  name: string
  primary: string
  secondary: string
  active: boolean
  winner: boolean
  out: boolean
  marks?: number[]
}

export interface GameView {
  title: string
  hint: string
  message: string
  layout: Layout
  turn: { label: string; score: number }[]
  turnTotal: number
  finished: boolean
  winner: number | null
  players: PlayerView[]
  numbers?: number[]
  previous?: string
  average?: string
}

export interface Game {
  applyDart(d: Dart): void
  commitTurn(): void
  undo(): void
  currentTurn(): Dart[]
  view(): GameView
  lens(sel: number, pending: Dart[]): string
  checkoutFor(pending: Dart[]): Dart[] | undefined
}

interface Core {
  active: number
  turn: Dart[]
  finished: boolean
  winner: number | null
  message: string
}

function newCore(): Core {
  return { active: 0, turn: [], finished: false, winner: null, message: '' }
}

function turnTotal(turn: Dart[]): number {
  let sum = 0
  for (const d of turn) {
    sum += dartScore(d)
  }
  return sum
}

function turnSlots(turn: Dart[]): { label: string; score: number }[] {
  const out: { label: string; score: number }[] = []
  for (const d of turn) {
    out.push({ label: dartLabel(d), score: dartScore(d) })
  }
  return out
}

abstract class GameBase<S extends Core> implements Game {
  state: S
  private history: string[] = []

  constructor(initial: S) {
    this.state = initial
  }

  protected save(): void {
    this.history.push(JSON.stringify(this.state))
    if (this.history.length > 300) {
      this.history.shift()
    }
  }

  undo(): void {
    const prev = this.history.pop()
    if (prev) {
      this.state = JSON.parse(prev)
    }
  }

  protected turnFull(): boolean {
    return this.state.turn.length >= 3
  }

  currentTurn(): Dart[] {
    return this.state.turn.map(d => ({ ...d }))
  }

  abstract applyDart(d: Dart): void
  abstract commitTurn(): void
  abstract view(): GameView

  checkoutFor(_pending: Dart[]): Dart[] | undefined {
    return undefined
  }

  lens(sel: number, pending: Dart[]): string {
    const v = this.view()
    const p = v.players.find(function (player) {
      return player.active || player.winner
    })
    const lines: string[] = []
    if (p && p.primary !== '') {
      lines.push(t('lensCurrentScore') + ': ' + p.primary)
    }
    if (v.previous !== undefined) {
      lines.push(t('lensPreviousScore') + ': ' + v.previous)
    }
    if (v.average !== undefined) {
      lines.push(t('lensLegAverage') + ': ' + v.average)
    }
    if (v.finished) {
      lines.push('')
      lines.push(t('gameOver'))
      return lines.join('\n')
    }
    const labels: string[] = []
    for (const slot of v.turn) {
      labels.push(slot.label)
    }
    for (const d of pending) {
      labels.push(dartLabel(d))
    }
    lines.push('')
    for (let i = 0; i < 3; i++) {
      let label = ''
      if (i < labels.length) {
        label = labels[i]
      }
      lines.push((sel === i ? '> ' : '  ') + t('lensDart') + ' ' + (i + 1) + ': ' + label)
    }
    lines.push('')
    lines.push((sel === 3 ? '> ' : '  ') + t('lensConfirmScore'))
    return lines.join('\n')
  }
}

function optBool(opts: Record<string, string>, key: string, def: boolean): boolean {
  const v = opts[key]
  if (v === undefined) {
    return def
  }
  return v === 'on'
}

function optInt(opts: Record<string, string>, key: string, def: number): number {
  const v = opts[key]
  if (v === undefined) {
    return def
  }
  const n = parseInt(v, 10)
  if (isNaN(n)) {
    return def
  }
  return n
}

function doubleSegs(): Dart[] {
  const out: Dart[] = []
  for (let i = 1; i <= 20; i++) {
    out.push({ value: i, mult: 2 })
  }
  out.push({ value: 25, mult: 2 })
  return out
}

function checkoutSegs(): Dart[] {
  const out: Dart[] = []
  for (let i = 20; i >= 1; i--) {
    out.push({ value: i, mult: 3 })
  }
  for (let i = 20; i >= 1; i--) {
    out.push({ value: i, mult: 2 })
  }
  out.push({ value: 25, mult: 2 })
  for (let i = 20; i >= 1; i--) {
    out.push({ value: i, mult: 1 })
  }
  out.push({ value: 25, mult: 1 })
  return out
}

export function findCheckout(score: number): Dart[] | null {
  if (score < 2 || score > 170) {
    return null
  }
  const doubles = doubleSegs()
  for (const d of doubles) {
    if (dartScore(d) === score) {
      return [d]
    }
  }
  const segs = checkoutSegs()
  for (const a of segs) {
    const r1 = score - dartScore(a)
    for (const d of doubles) {
      if (dartScore(d) === r1) {
        return [a, d]
      }
    }
  }
  for (const a of segs) {
    for (const b of segs) {
      const r2 = score - dartScore(a) - dartScore(b)
      if (r2 < 2) {
        continue
      }
      for (const d of doubles) {
        if (dartScore(d) === r2) {
          return [a, b, d]
        }
      }
    }
  }
  return null
}

interface X01Player {
  score: number
  legs: number
  sets: number
  in: boolean
  dartsUsed: number
  scored: number
}

interface X01State extends Core {
  names: string[]
  start: number
  doubleOut: boolean
  doubleIn: boolean
  legsTarget: number
  setsTarget: number
  legStarter: number
  turnStart: number
  turnStartDarts: number
  turnStartScored: number
  lastTurnPoints: number
  lastTurnBust: boolean
  players: X01Player[]
}

class X01Game extends GameBase<X01State> {
  constructor(names: string[], cfg: { start: number; doubleOut: boolean; doubleIn: boolean; legsTarget: number; setsTarget: number }) {
    const players: X01Player[] = []
    for (let i = 0; i < names.length; i++) {
      players.push({ score: cfg.start, legs: 0, sets: 0, in: !cfg.doubleIn, dartsUsed: 0, scored: 0 })
    }
    const core = newCore()
    super({
      ...core,
      names,
      start: cfg.start,
      doubleOut: cfg.doubleOut,
      doubleIn: cfg.doubleIn,
      legsTarget: cfg.legsTarget,
      setsTarget: cfg.setsTarget,
      legStarter: 0,
      turnStart: cfg.start,
      turnStartDarts: 0,
      turnStartScored: 0,
      lastTurnPoints: 0,
      lastTurnBust: false,
      players,
    })
  }

  applyDart(d: Dart): void {
    const s = this.state
    if (s.finished) {
      return
    }
    this.save()
    s.message = ''
    const p = s.players[s.active]
    let counts = true
    if (s.doubleIn && !p.in) {
      if (d.mult === 2) {
        p.in = true
      } else {
        counts = false
      }
    }
    s.turn.push({ ...d })
    p.dartsUsed += 1
    if (!counts) {
      this.afterDart()
      return
    }
    const sc = dartScore(d)
    const remaining = p.score - sc
    const isDouble = d.mult === 2
    let bust = false
    if (s.doubleOut) {
      if (remaining < 0 || remaining === 1) {
        bust = true
      } else if (remaining === 0 && !isDouble) {
        bust = true
      }
    } else if (remaining < 0) {
      bust = true
    }
    if (bust) {
      s.message = t('bust')
      p.score = s.turnStart
      p.dartsUsed = s.turnStartDarts + 3
      p.scored = s.turnStartScored
      this.commitTurn()
      s.lastTurnBust = true
      return
    }
    p.score = remaining
    p.scored += sc
    if (remaining === 0) {
      this.legWon()
      return
    }
    this.afterDart()
  }

  private afterDart(): void {
    if (this.turnFull()) {
      this.commitTurn()
    }
  }

  commitTurn(): void {
    const s = this.state
    if (s.finished) {
      return
    }
    s.lastTurnPoints = s.turnStart - s.players[s.active].score
    s.lastTurnBust = false
    s.turn = []
    s.active = (s.active + 1) % s.players.length
    s.turnStart = s.players[s.active].score
    s.turnStartDarts = s.players[s.active].dartsUsed
    s.turnStartScored = s.players[s.active].scored
  }

  private legWon(): void {
    const s = this.state
    const p = s.players[s.active]
    s.lastTurnPoints = s.turnStart - p.score
    s.lastTurnBust = false
    p.legs += 1
    s.turn = []
    if (p.legs >= s.legsTarget) {
      p.sets += 1
      if (p.sets >= s.setsTarget) {
        s.turnStartDarts = p.dartsUsed
        s.turnStartScored = p.scored
        s.finished = true
        s.winner = s.active
        return
      }
      for (const pl of s.players) {
        pl.legs = 0
      }
    }
    for (const pl of s.players) {
      pl.score = s.start
      pl.in = !s.doubleIn
      pl.dartsUsed = 0
      pl.scored = 0
    }
    s.legStarter = (s.legStarter + 1) % s.players.length
    s.active = s.legStarter
    s.turnStart = s.players[s.active].score
    s.turnStartDarts = s.players[s.active].dartsUsed
    s.turnStartScored = s.players[s.active].scored
  }

  view(): GameView {
    const s = this.state
    const players: PlayerView[] = []
    for (let i = 0; i < s.players.length; i++) {
      const p = s.players[i]
      let secondary = ''
      if (s.setsTarget > 1) {
        secondary = 'S ' + p.sets + ' · L ' + p.legs
      } else if (s.legsTarget > 1) {
        secondary = t('left') + ' · L ' + p.legs + '/' + s.legsTarget
      }
      if (s.doubleIn && !p.in) {
        secondary = t('startBull')
      }
      players.push({
        name: s.names[i],
        primary: String(p.score),
        secondary,
        active: i === s.active && !s.finished,
        winner: s.finished && s.winner === i,
        out: false,
      })
    }
    let average = '0.0'
    if (s.turnStartDarts > 0) {
      average = ((s.turnStartScored / s.turnStartDarts) * 3).toFixed(1)
    }
    let previous = String(s.lastTurnPoints)
    if (s.lastTurnBust) {
      previous = t('bust')
    }
    return {
      title: String(s.start),
      hint: '',
      message: s.message,
      layout: 'score',
      turn: turnSlots(s.turn),
      turnTotal: s.players[s.active].scored - s.turnStartScored,
      finished: s.finished,
      winner: s.winner,
      players,
      previous,
      average,
    }
  }

  checkoutFor(pending: Dart[]): Dart[] | undefined {
    const s = this.state
    if (s.finished || !s.doubleOut) {
      return undefined
    }
    const dartsLeft = 3 - s.turn.length - pending.length
    if (dartsLeft <= 0) {
      return undefined
    }
    const p = s.players[s.active]
    let score = p.score
    let inGame = p.in
    for (const d of pending) {
      if (!inGame) {
        if (d.mult !== 2) {
          continue
        }
        inGame = true
      }
      score -= dartScore(d)
    }
    if (!inGame || score < 2 || score > 170) {
      return undefined
    }
    const route = findCheckout(score)
    if (!route || route.length > dartsLeft) {
      return undefined
    }
    return route
  }
}

const CRICKET_STD = [20, 19, 18, 17, 16, 15, 25]
const CRICKET_TACTICS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 25]

function randomCricketNumbers(): number[] {
  const pool: number[] = []
  for (let i = 1; i <= 20; i++) {
    pool.push(i)
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  const picked = pool.slice(0, 6)
  picked.sort(function (a, b) {
    return b - a
  })
  picked.push(25)
  return picked
}

interface CricketPlayer {
  marks: number[]
  score: number
}

interface CricketState extends Core {
  names: string[]
  numbers: number[]
  scoring: boolean
  players: CricketPlayer[]
}

class CricketGame extends GameBase<CricketState> {
  constructor(names: string[], cfg: { numbers: number[]; scoring: boolean }) {
    const players: CricketPlayer[] = []
    for (let i = 0; i < names.length; i++) {
      const marks: number[] = []
      for (let k = 0; k < cfg.numbers.length; k++) {
        marks.push(0)
      }
      players.push({ marks, score: 0 })
    }
    super({ ...newCore(), names, numbers: cfg.numbers.slice(), scoring: cfg.scoring, players })
  }

  private idxOf(value: number): number {
    return this.state.numbers.indexOf(value)
  }

  applyDart(d: Dart): void {
    const s = this.state
    if (s.finished) {
      return
    }
    this.save()
    s.message = ''
    s.turn.push({ ...d })
    const idx = this.idxOf(d.value)
    if (idx >= 0) {
      const p = s.players[s.active]
      let marks = d.mult
      if (d.value === 25) {
        marks = 1
      }
      const needed = 3 - p.marks[idx]
      const closing = Math.min(marks, needed)
      p.marks[idx] += closing
      const overflow = marks - closing
      if (s.scoring && overflow > 0) {
        p.score += overflow * d.value
      }
      this.checkWin()
    }
    if (!s.finished && this.turnFull()) {
      this.commitTurn()
    }
  }

  private allClosed(p: CricketPlayer): boolean {
    for (const m of p.marks) {
      if (m < 3) {
        return false
      }
    }
    return true
  }

  private checkWin(): void {
    const s = this.state
    const p = s.players[s.active]
    if (!this.allClosed(p)) {
      return
    }
    if (!s.scoring) {
      s.finished = true
      s.winner = s.active
      return
    }
    let highestOther = 0
    for (let i = 0; i < s.players.length; i++) {
      if (i !== s.active && s.players[i].score > highestOther) {
        highestOther = s.players[i].score
      }
    }
    if (p.score >= highestOther) {
      s.finished = true
      s.winner = s.active
    }
  }

  commitTurn(): void {
    const s = this.state
    if (s.finished) {
      return
    }
    s.turn = []
    s.active = (s.active + 1) % s.players.length
  }

  view(): GameView {
    const s = this.state
    const players: PlayerView[] = []
    for (let i = 0; i < s.players.length; i++) {
      const p = s.players[i]
      players.push({
        name: s.names[i],
        primary: s.scoring ? String(p.score) : '',
        secondary: '',
        active: i === s.active && !s.finished,
        winner: s.finished && s.winner === i,
        out: false,
        marks: p.marks.slice(),
      })
    }
    return {
      title: t('catCricket'),
      hint: '',
      message: s.message,
      layout: 'cricket',
      turn: turnSlots(s.turn),
      turnTotal: turnTotal(s.turn),
      finished: s.finished,
      winner: s.winner,
      players,
      numbers: s.numbers.slice(),
    }
  }
}

export interface OptionValue {
  value: string
  label: string
}

export interface OptionSpec {
  key: string
  label: StringKey
  type: 'toggle' | 'select'
  values: OptionValue[]
  def: string
}

export interface GameDef {
  id: string
  category: Category
  name: StringKey
  blurb: StringKey
  minPlayers: number
  maxPlayers: number
  options: OptionSpec[]
  create(players: string[], opts: Record<string, string>): Game
}

const LEGS_OPT: OptionSpec = {
  key: 'legs',
  label: 'optLegs',
  type: 'select',
  values: [{ value: '1', label: '1' }, { value: '3', label: '3' }, { value: '5', label: '5' }],
  def: '1',
}

const SETS_OPT: OptionSpec = {
  key: 'sets',
  label: 'optSets',
  type: 'select',
  values: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }],
  def: '1',
}

const DOUBLE_OUT_OPT: OptionSpec = {
  key: 'doubleOut',
  label: 'optDoubleOut',
  type: 'toggle',
  values: [],
  def: 'on',
}

const DOUBLE_IN_OPT: OptionSpec = {
  key: 'doubleIn',
  label: 'optDoubleIn',
  type: 'toggle',
  values: [],
  def: 'off',
}

function x01Def(id: string, start: number, name: StringKey, blurb: StringKey): GameDef {
  return {
    id,
    category: 'x01',
    name,
    blurb,
    minPlayers: 1,
    maxPlayers: 4,
    options: [DOUBLE_OUT_OPT, DOUBLE_IN_OPT, LEGS_OPT, SETS_OPT],
    create: function (players, opts) {
      return new X01Game(players, {
        start,
        doubleOut: optBool(opts, 'doubleOut', true),
        doubleIn: optBool(opts, 'doubleIn', false),
        legsTarget: optInt(opts, 'legs', 1),
        setsTarget: optInt(opts, 'sets', 1),
      })
    },
  }
}

function cricketDef(id: string, name: StringKey, blurb: StringKey, cfg: { numbers: number[] | null; scoring: boolean }): GameDef {
  return {
    id,
    category: 'cricket',
    name,
    blurb,
    minPlayers: 1,
    maxPlayers: 4,
    options: [],
    create: function (players, _opts) {
      let numbers = cfg.numbers
      if (numbers === null) {
        numbers = randomCricketNumbers()
      }
      return new CricketGame(players, { numbers, scoring: cfg.scoring })
    },
  }
}

export const GAMES: GameDef[] = [
  x01Def('301', 301, 'game_301_name', 'game_301_blurb'),
  x01Def('501', 501, 'game_501_name', 'game_501_blurb'),
  x01Def('701', 701, 'game_701_name', 'game_701_blurb'),
  x01Def('901', 901, 'game_901_name', 'game_901_blurb'),

  cricketDef('cricket', 'game_cricket_name', 'game_cricket_blurb', { numbers: CRICKET_STD, scoring: true }),
  cricketDef('noscore', 'game_noscore_name', 'game_noscore_blurb', { numbers: CRICKET_STD, scoring: false }),
  cricketDef('tactics', 'game_tactics_name', 'game_tactics_blurb', { numbers: CRICKET_TACTICS, scoring: true }),
  cricketDef('random', 'game_random_name', 'game_random_blurb', { numbers: null, scoring: true }),
]

export function gamesByCategory(cat: Category): GameDef[] {
  const out: GameDef[] = []
  for (const g of GAMES) {
    if (g.category === cat) {
      out.push(g)
    }
  }
  return out
}

export function findGame(id: string): GameDef | undefined {
  for (const g of GAMES) {
    if (g.id === id) {
      return g
    }
  }
  return undefined
}
