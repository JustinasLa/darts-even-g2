import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { t } from './i18n'
import type { StringKey } from './i18n'
import type { Category, GameDef, Game, GameView, PlayerView } from './games'
import { gamesByCategory, findGame, dartLabel } from './games'
import type { Dart } from './games'
import flagIcon from './icons/Flag.svg?raw'
import checklistIcon from './icons/Checklist.svg?raw'
import chevronRightIcon from './icons/ChevronRight.svg?raw'
import chevronLeftIcon from './icons/ChevronLeft.svg?raw'
import undoIcon from './icons/Undo.svg?raw'
import slashIcon from './icons/Slash.svg?raw'
import crossIcon from './icons/Cross.svg?raw'
import dotIcon from './icons/Dot.svg?raw'
import './style.css'

const bridge = await waitForEvenAppBridge()

const BODY = { id: 1, name: 'body', x: 0, y: 0, w: 472, h: 288, pad: 4, border: 0 }
const PANEL = { id: 2, name: 'panel', x: 480, y: 0, w: 96, h: 288, pad: 4, border: 0 }

const LENS_LINE_H = 27
const PANEL_ROWS = Math.floor((PANEL.h - 2 * PANEL.pad) / LENS_LINE_H)

const body = new TextContainerProperty({
  xPosition: BODY.x,
  yPosition: BODY.y,
  width: BODY.w,
  height: BODY.h,
  borderWidth: BODY.border,
  borderColor: 5,
  paddingLength: BODY.pad,
  containerID: BODY.id,
  containerName: BODY.name,
  content: t('appTitle') + '\n\n' + t('tagline'),
  isEventCapture: 1,
})

const panel = new TextContainerProperty({
  xPosition: PANEL.x,
  yPosition: PANEL.y,
  width: PANEL.w,
  height: PANEL.h,
  borderWidth: PANEL.border,
  borderColor: 5,
  paddingLength: PANEL.pad,
  containerID: PANEL.id,
  containerName: PANEL.name,
  content: '',
  isEventCapture: 0,
})

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({ containerTotalNum: 2, textObject: [body, panel] }),
)
if (created !== 0) {
  console.error('createStartUpPageContainer failed:', created)
}

let rendering: Promise<unknown> = Promise.resolve()
function drawLens(text: string) {
  rendering = rendering.then(function () {
    return bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: BODY.id, containerName: BODY.name, content: text }),
    )
  })
  const side = panelContent()
  rendering = rendering.then(function () {
    return bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: PANEL.id, containerName: PANEL.name, content: side }),
    )
  })
}

const unsubscribe = bridge.onEvenHubEvent(function (event) {
  let sysType: number | null = null
  if (event.sysEvent) {
    if (event.sysEvent.eventType === undefined || event.sysEvent.eventType === null) {
      sysType = OsEventTypeList.CLICK_EVENT
    } else {
      sysType = event.sysEvent.eventType
    }
  }
  let textType: number | null = null
  if (event.textEvent && event.textEvent.eventType !== undefined && event.textEvent.eventType !== null) {
    textType = event.textEvent.eventType
  }

  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    if (!backLens()) {
      unsubscribe()
      bridge.shutDownPageContainer(1)
    }
    return
  }
  if (textType === OsEventTypeList.SCROLL_TOP_EVENT) {
    moveLens(-1)
    return
  }
  if (textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    moveLens(1)
    return
  }
  if (sysType === OsEventTypeList.CLICK_EVENT) {
    selectLens()
    return
  }
  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    unsubscribe()
  }
})

type Screen = 'home' | 'category' | 'game'

let screen: Screen = 'home'
let activeCategory: Category = 'x01'
let activeDef: GameDef | null = null
let setupOptions: Record<string, string> = {}
let game: Game | null = null
let mult = 1
let lensSel = 0
let confirmQuit = false

type LensEntry = 'list' | 'mult' | 'num'
let lensEntry: LensEntry = 'list'
let lensEntryMult = 1
let lensEditIndex = 0
let pendingDarts: Dart[] = []

const CAT_ORDER: Category[] = ['x01', 'cricket']
const CAT_NAME: Record<Category, StringKey> = {
  x01: 'catX01',
  cricket: 'catCricket',
}
const CAT_BLURB: Record<Category, StringKey> = {
  x01: 'catX01Blurb',
  cricket: 'catCricketBlurb',
}
const CAT_ICON: Record<Category, string> = {
  x01: flagIcon,
  cricket: checklistIcon,
}

const app = document.querySelector<HTMLDivElement>('#app')!

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function markSymbol(m: number): string {
  if (m >= 3) {
    return '<span class="cmark-ico">' + dotIcon + '</span>'
  }
  if (m === 2) {
    return '<span class="cmark-ico">' + crossIcon + '</span>'
  }
  if (m === 1) {
    return '<span class="cmark-ico">' + slashIcon + '</span>'
  }
  return ''
}

function lensMarkSymbol(m: number): string {
  if (m >= 3) {
    return '●'
  }
  if (m === 2) {
    return 'X'
  }
  if (m === 1) {
    return '/'
  }
  return ''
}

function numberLabel(n: number): string {
  if (n === 25) {
    return 'Bull'
  }
  return String(n)
}

function lensList(title: string, labels: string[]): string {
  const max = 6
  let start = 0
  if (labels.length > max) {
    start = lensSel - 2
    if (start < 0) {
      start = 0
    }
    if (start + max > labels.length) {
      start = labels.length - max
    }
  }
  const end = Math.min(start + max, labels.length)
  let head = title
  if (labels.length > max) {
    head += '   ' + (lensSel + 1) + '/' + labels.length
  }
  const lines: string[] = [head, '']
  for (let i = start; i < end; i++) {
    lines.push((i === lensSel ? '> ' : '  ') + labels[i])
  }
  return lines.join('\n')
}

function lensHome(): string {
  const labels: string[] = []
  for (const cat of CAT_ORDER) {
    labels.push(t(CAT_NAME[cat]))
  }
  return lensList(t('appTitle'), labels)
}

function lensCategory(): string {
  const list = gamesByCategory(activeCategory)
  const labels: string[] = []
  for (const def of list) {
    labels.push(t(def.name))
  }
  return lensList(t(CAT_NAME[activeCategory]), labels)
}

function lensConfirmQuit(): string {
  const labels = [t('resume'), t('quit')]
  const lines: string[] = [t('quitTitle'), '', t('quitWarning'), '']
  for (let i = 0; i < labels.length; i++) {
    lines.push((i === lensSel ? '> ' : '  ') + labels[i])
  }
  return lines.join('\n')
}

function lensMultOptions(): { label: string; toNum: number; dart: Dart | null }[] {
  const opts: { label: string; toNum: number; dart: Dart | null }[] = []
  opts.push({ label: t('lensSingle'), toNum: 1, dart: null })
  opts.push({ label: t('lensDouble'), toNum: 2, dart: null })
  opts.push({ label: t('lensTriple'), toNum: 3, dart: null })
  let cricket = false
  if (game && game.view().layout === 'cricket') {
    cricket = true
  }
  if (cricket) {
    opts.push({ label: t('bullEye'), toNum: 0, dart: { value: 25, mult: 2 } })
  } else {
    opts.push({ label: t('bull'), toNum: 0, dart: { value: 25, mult: 1 } })
    opts.push({ label: t('bullEye'), toNum: 0, dart: { value: 25, mult: 2 } })
  }
  opts.push({ label: t('miss'), toNum: 0, dart: { value: 0, mult: 1 } })
  return opts
}

function lensMultScreen(): string {
  const title = t('lensDart') + ' ' + (lensEditIndex + 1) + ':'
  const labels: string[] = []
  for (const o of lensMultOptions()) {
    labels.push(o.label)
  }
  return lensList(title, labels)
}

function lensNumValues(): number[] {
  const vals: number[] = []
  if (game && game.view().layout === 'cricket') {
    const nums = game.view().numbers
    if (nums) {
      for (const n of nums) {
        if (n !== 25) {
          vals.push(n)
        }
      }
    }
    return vals
  }
  for (let n = 20; n >= 1; n--) {
    vals.push(n)
  }
  return vals
}

function lensNumScreen(): string {
  let mlabel = t('lensSingle')
  if (lensEntryMult === 2) {
    mlabel = t('lensDouble')
  } else if (lensEntryMult === 3) {
    mlabel = t('lensTriple')
  }
  const title = t('lensDart') + ' ' + (lensEditIndex + 1) + ': ' + mlabel
  const labels: string[] = []
  for (const n of lensNumValues()) {
    labels.push(String(n))
  }
  return lensList(title, labels)
}

function cricketPanel(v: GameView): string {
  const numbers = v.numbers || []
  let active: PlayerView | null = null
  for (const p of v.players) {
    if (p.active) {
      active = p
    }
  }
  if (!active && v.players.length > 0) {
    active = v.players[0]
  }
  let marks: number[] = []
  if (active && active.marks) {
    marks = active.marks
  }
  const lines: string[] = []
  for (let i = 0; i < numbers.length; i++) {
    let m = 0
    if (i < marks.length) {
      m = marks[i]
    }
    if (m >= 3) {
      continue
    }
    const sym = lensMarkSymbol(m)
    let line = numberLabel(numbers[i])
    if (sym) {
      line += ' ' + sym
    }
    lines.push(line)
  }
  if (lines.length > PANEL_ROWS) {
    lines.length = PANEL_ROWS
  }
  return lines.join('\n')
}

function panelContent(): string {
  if (screen !== 'game' || !game) {
    return ''
  }
  const v = game.view()
  if (v.finished) {
    return ''
  }
  if (v.layout === 'cricket') {
    return cricketPanel(v)
  }
  const route = game.checkoutFor(pendingDarts)
  if (!route || route.length === 0) {
    return ''
  }
  const lines: string[] = []
  for (const d of route) {
    lines.push(dartLabel(d))
  }
  return lines.join('\n')
}

function lensContent(): string {
  if (screen === 'home') {
    return lensHome()
  }
  if (screen === 'category') {
    return lensCategory()
  }
  if (screen === 'game' && game) {
    if (confirmQuit) {
      return lensConfirmQuit()
    }
    if (lensEntry === 'mult') {
      return lensMultScreen()
    }
    if (lensEntry === 'num') {
      return lensNumScreen()
    }
    return game.lens(lensSel, pendingDarts)
  }
  return t('appTitle')
}

const GAME_ROWS = 4

function moveLens(delta: number) {
  let count = 0
  if (screen === 'home') {
    count = CAT_ORDER.length
  } else if (screen === 'category') {
    count = gamesByCategory(activeCategory).length
  } else if (screen === 'game') {
    if (!game) {
      return
    }
    if (confirmQuit) {
      count = 2
    } else if (game.view().finished) {
      return
    } else if (lensEntry === 'mult') {
      count = lensMultOptions().length
    } else if (lensEntry === 'num') {
      count = lensNumValues().length
    } else {
      count = GAME_ROWS
    }
  } else {
    return
  }
  if (count === 0) {
    return
  }
  lensSel += delta
  if (lensSel < 0) {
    lensSel = 0
  }
  if (lensSel >= count) {
    lensSel = count - 1
  }
  drawLens(lensContent())
}

function selectLens() {
  if (screen === 'game') {
    if (!game) {
      return
    }
    if (confirmQuit) {
      if (lensSel === 1) {
        quitGame()
      } else {
        resumeGame()
      }
      return
    }
    selectLensGame()
    return
  }
  if (screen === 'home') {
    activeCategory = CAT_ORDER[lensSel]
    screen = 'category'
    render()
  } else if (screen === 'category') {
    const def = gamesByCategory(activeCategory)[lensSel]
    if (def) {
      openGame(def)
    }
  }
}

function selectLensGame() {
  const v = game!.view()
  if (v.finished) {
    return
  }
  if (lensEntry === 'list') {
    if (lensSel === GAME_ROWS - 1) {
      confirmLensTurn()
      return
    }
    if (lensSel > pendingDarts.length) {
      return
    }
    lensEditIndex = lensSel
    lensEntry = 'mult'
    lensSel = 0
    drawLens(lensContent())
    return
  }
  if (lensEntry === 'mult') {
    const opt = lensMultOptions()[lensSel]
    if (!opt) {
      return
    }
    if (opt.dart) {
      commitLensDart(opt.dart)
    } else {
      lensEntryMult = opt.toNum
      lensEntry = 'num'
      lensSel = 0
      drawLens(lensContent())
    }
    return
  }
  if (lensEntry === 'num') {
    const values = lensNumValues()
    const num = values[lensSel]
    if (num === undefined) {
      return
    }
    commitLensDart({ value: num, mult: lensEntryMult })
  }
}

function commitLensDart(d: Dart) {
  lensEntry = 'list'
  if (lensEditIndex < pendingDarts.length) {
    pendingDarts[lensEditIndex] = d
    lensSel = lensEditIndex
    drawLens(lensContent())
    return
  }
  if (pendingDarts.length < 3) {
    pendingDarts.push(d)
  }
  let next = pendingDarts.length
  if (next > GAME_ROWS - 1) {
    next = GAME_ROWS - 1
  }
  lensSel = next
  drawLens(lensContent())
}

function confirmLensTurn() {
  const darts = pendingDarts
  pendingDarts = []
  for (const d of darts) {
    const before = game!.view()
    if (before.finished) {
      break
    }
    const beforeLen = before.turn.length
    game!.applyDart(d)
    const after = game!.view()
    if (after.finished) {
      break
    }
    if (after.turn.length <= beforeLen) {
      break
    }
  }
  const v = game!.view()
  if (!v.finished && v.turn.length > 0) {
    game!.commitTurn()
  }
  lensEntry = 'list'
  mult = 1
  lensSel = 0
  render()
}

function resumeGame() {
  confirmQuit = false
  lensEntry = 'list'
  lensSel = 0
  drawLens(lensContent())
}

function quitGame() {
  confirmQuit = false
  lensEntry = 'list'
  lensEditIndex = 0
  pendingDarts = []
  game = null
  lensSel = 0
  screen = 'category'
  render()
}

function backLens(): boolean {
  if (screen === 'game' && game) {
    if (lensEntry === 'num') {
      lensEntry = 'mult'
      lensSel = 0
      drawLens(lensContent())
      return true
    }
    if (lensEntry === 'mult') {
      lensEntry = 'list'
      let back = lensEditIndex
      if (back > GAME_ROWS - 1) {
        back = GAME_ROWS - 1
      }
      lensSel = back
      drawLens(lensContent())
      return true
    }
    if (confirmQuit) {
      resumeGame()
      return true
    }
    if (game.view().finished) {
      quitGame()
      return true
    }
    confirmQuit = true
    lensSel = 0
    drawLens(lensContent())
    return true
  }
  if (screen === 'category') {
    screen = 'home'
    render()
    return true
  }
  return false
}

function render() {
  if (screen === 'home') {
    renderHome()
  } else if (screen === 'category') {
    renderCategory()
  } else if (screen === 'game') {
    renderGame()
  }
}

function renderHome() {
  lensSel = 0
  let cards = ''
  for (const cat of CAT_ORDER) {
    const count = gamesByCategory(cat).length
    cards +=
      '<button class="cat-card" data-cat="' + cat + '">' +
      '<span class="cat-icon">' + CAT_ICON[cat] + '</span>' +
      '<span class="cat-name">' + esc(t(CAT_NAME[cat])) + '</span>' +
      '<span class="cat-blurb">' + esc(t(CAT_BLURB[cat])) + '</span>' +
      '<span class="cat-count">' + count + '</span>' +
      '</button>'
  }
  app.innerHTML =
    '<main class="screen home-screen">' +
    '<header class="home-hero"><div class="brand">' + esc(t('appTitle')) + '</div>' +
    '<p class="tagline">' + esc(t('tagline')) + '</p></header>' +
    '<div class="cat-grid">' + cards + '</div>' +
    '</main>'

  const buttons = app.querySelectorAll<HTMLButtonElement>('.cat-card')
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      activeCategory = b.dataset.cat as Category
      screen = 'category'
      render()
    })
  })
  drawLens(lensContent())
}

function renderCategory() {
  lensSel = 0
  const list = gamesByCategory(activeCategory)
  let rows = ''
  for (const def of list) {
    rows +=
      '<button class="game-row" data-id="' + def.id + '">' +
      '<span class="game-text"><span class="game-name">' + esc(t(def.name)) + '</span>' +
      '<span class="game-blurb">' + esc(t(def.blurb)) + '</span></span>' +
      '<span class="chevron">' + chevronRightIcon + '</span>' +
      '</button>'
  }
  app.innerHTML =
    '<main class="screen">' +
    '<header class="topbar"><button class="icon-btn" data-act="back"><span class="btn-ico">' + chevronLeftIcon + '</span>' + esc(t('back')) + '</button>' +
    '<div class="title">' + esc(t(CAT_NAME[activeCategory])) + '</div></header>' +
    '<div class="game-list">' + rows + '</div>' +
    '</main>'

  app.querySelector<HTMLButtonElement>('[data-act="back"]')!.addEventListener('click', function () {
    screen = 'home'
    render()
  })
  app.querySelectorAll<HTMLButtonElement>('.game-row').forEach(function (b) {
    b.addEventListener('click', function () {
      const def = findGame(b.dataset.id || '')
      if (def) {
        openGame(def)
      }
    })
  })
  drawLens(lensContent())
}

function openGame(def: GameDef) {
  activeDef = def
  setupOptions = {}
  for (const opt of def.options) {
    setupOptions[opt.key] = opt.def
  }
  startGame()
}

function startGame() {
  const def = activeDef!
  game = def.create([''], setupOptions)
  mult = 1
  lensSel = 0
  confirmQuit = false
  lensEntry = 'list'
  lensEditIndex = 0
  pendingDarts = []
  screen = 'game'
  render()
}

function playerCard(p: PlayerView): string {
  let cls = 'pcard'
  if (p.active) {
    cls += ' pcard-active'
  }
  if (p.winner) {
    cls += ' pcard-winner'
  }
  if (p.out) {
    cls += ' pcard-out'
  }
  let tag = ''
  if (p.out) {
    tag = '<span class="ptag ptag-out">' + esc(t('out')) + '</span>'
  }
  return (
    '<div class="' + cls + '">' +
    (tag ? '<div class="pcard-head">' + tag + '</div>' : '') +
    '<div class="pscore">' + esc(p.primary) + '</div>' +
    (p.secondary ? '<div class="psub">' + esc(p.secondary) + '</div>' : '') +
    '</div>'
  )
}

function scoreBoard(v: GameView): string {
  if (v.layout === 'cricket') {
    return cricketBoard(v)
  }
  let cards = ''
  for (const p of v.players) {
    cards += playerCard(p)
  }
  let grid = 'pgrid'
  if (v.players.length >= 3) {
    grid += ' pgrid-2'
  }
  if (v.players.length === 1) {
    grid += ' pgrid-1'
  }
  return '<div class="' + grid + '">' + cards + '</div>'
}

function infoBars(v: GameView): string {
  let bars = ''
  if (v.previous !== undefined) {
    bars +=
      '<div class="info-bar"><span class="info-label">' + esc(t('lensPreviousScore')) + '</span>' +
      '<span class="info-value">' + esc(v.previous) + '</span></div>'
  }
  if (v.average !== undefined) {
    bars +=
      '<div class="info-bar"><span class="info-label">' + esc(t('lensLegAverage')) + '</span>' +
      '<span class="info-value">' + esc(v.average) + '</span></div>'
  }
  let route: Dart[] | undefined = undefined
  if (game && !v.finished) {
    route = game.checkoutFor(pendingDarts)
  }
  if (route && route.length > 0) {
    let labels = ''
    for (const d of route) {
      if (labels) {
        labels += ' '
      }
      labels += dartLabel(d)
    }
    bars +=
      '<div class="info-bar"><span class="info-label">' + esc(t('checkout')) + '</span>' +
      '<span class="info-value">' + esc(labels) + '</span></div>'
  }
  if (!bars) {
    return ''
  }
  return '<div class="info-bars">' + bars + '</div>'
}

function cricketBoard(v: GameView): string {
  const numbers = v.numbers || []
  let head = '<th class="cnum-h"></th>'
  for (const p of v.players) {
    let cls = 'cplayer-h'
    if (p.active) {
      cls += ' cplayer-active'
    }
    if (p.winner) {
      cls += ' cplayer-winner'
    }
    head +=
      '<th class="' + cls + '"><div class="cscore">' + esc(p.primary) + '</div></th>'
  }
  let rows = ''
  for (let r = 0; r < numbers.length; r++) {
    let cells = '<td class="cnum">' + esc(numberLabel(numbers[r])) + '</td>'
    for (const p of v.players) {
      const m = p.marks ? p.marks[r] : 0
      const closed = m >= 3 ? ' cmark-closed' : ''
      cells += '<td class="cmark' + closed + '">' + markSymbol(m) + '</td>'
    }
    rows += '<tr>' + cells + '</tr>'
  }
  return '<table class="cricket"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table>'
}

function turnBar(v: GameView): string {
  let slots = ''
  for (let i = 0; i < 3; i++) {
    if (i < v.turn.length) {
      slots += '<span class="slot slot-filled">' + esc(v.turn[i].label) + '</span>'
    } else {
      slots += '<span class="slot"></span>'
    }
  }
  return (
    '<div class="turnbar">' +
    '<div class="slots">' + slots + '</div>' +
    '<div class="turntotal">' + v.turnTotal + '</div>' +
    '</div>'
  )
}

function keypad(): string {
  let mults = ''
  const labels: { m: number; key: string }[] = [
    { m: 1, key: 'single' },
    { m: 2, key: 'double' },
    { m: 3, key: 'triple' },
  ]
  for (const l of labels) {
    mults +=
      '<button class="mbtn ' + (mult === l.m ? 'mbtn-on' : '') + '" data-mult="' + l.m + '">' +
      esc(t(l.key as 'single')) + '</button>'
  }
  let nums = ''
  for (let n = 1; n <= 20; n++) {
    nums += '<button class="numbtn" data-num="' + n + '">' + n + '</button>'
  }
  return (
    '<div class="keypad">' +
    '<div class="mult-row">' + mults + '</div>' +
    '<div class="num-grid">' + nums + '</div>' +
    '<div class="bottom-row">' +
    '<button class="actbtn" data-bull="1">' + esc(t('bull')) + '</button>' +
    '<button class="actbtn" data-bull="2">' + esc(t('bullEye')) + '</button>' +
    '<button class="actbtn actbtn-miss" data-miss="1">' + esc(t('miss')) + '</button>' +
    '<button class="actbtn actbtn-next" data-act="next">' + esc(t('next')) + '<span class="btn-ico">' + chevronRightIcon + '</span></button>' +
    '</div>' +
    '</div>'
  )
}

function renderGame() {
  const v = game!.view()
  let banner = ''
  if (v.finished) {
    banner =
      '<div class="overlay"><div class="over-card">' +
      '<div class="over-winner">' + esc(t('gameOver')) + '</div>' +
      '<div class="over-actions">' +
      '<button class="primary-btn" data-act="rematch">' + esc(t('playAgain')) + '</button>' +
      '<button class="ghost-btn" data-act="home">' + esc(t('backToModes')) + '</button>' +
      '</div></div></div>'
  }

  app.innerHTML =
    '<main class="screen game-screen">' +
    '<header class="topbar"><button class="icon-btn" data-act="back"><span class="btn-ico">' + chevronLeftIcon + '</span>' + esc(t('home')) + '</button>' +
    '<div class="title">' + esc(v.title) + '</div>' +
    '<button class="icon-btn" data-act="undo"><span class="btn-ico">' + undoIcon + '</span>' + esc(t('undo')) + '</button></header>' +
    (v.hint ? '<div class="hint">' + esc(v.hint) + '</div>' : '<div class="hint hint-empty"></div>') +
    '<div class="board-wrap">' + scoreBoard(v) + infoBars(v) + '</div>' +
    (v.message ? '<div class="toast">' + esc(v.message) + '</div>' : '') +
    turnBar(v) +
    keypad() +
    banner +
    '</main>'

  bindGame(v)
  drawLens(lensContent())
}

function bindGame(v: GameView) {
  app.querySelector<HTMLButtonElement>('[data-act="back"]')!.addEventListener('click', function () {
    game = null
    screen = 'category'
    render()
  })
  app.querySelector<HTMLButtonElement>('[data-act="undo"]')!.addEventListener('click', function () {
    game!.undo()
    mult = 1
    render()
  })

  if (v.finished) {
    const rematch = app.querySelector<HTMLButtonElement>('[data-act="rematch"]')
    if (rematch) {
      rematch.addEventListener('click', function () {
        startGame()
      })
    }
    const home = app.querySelector<HTMLButtonElement>('[data-act="home"]')
    if (home) {
      home.addEventListener('click', function () {
        game = null
        screen = 'home'
        render()
      })
    }
    return
  }

  app.querySelectorAll<HTMLButtonElement>('[data-mult]').forEach(function (b) {
    b.addEventListener('click', function () {
      mult = parseInt(b.dataset.mult || '1', 10)
      render()
    })
  })
  app.querySelectorAll<HTMLButtonElement>('[data-num]').forEach(function (b) {
    b.addEventListener('click', function () {
      const n = parseInt(b.dataset.num || '0', 10)
      throwDart({ value: n, mult })
    })
  })
  app.querySelectorAll<HTMLButtonElement>('[data-bull]').forEach(function (b) {
    b.addEventListener('click', function () {
      const m = parseInt(b.dataset.bull || '1', 10)
      throwDart({ value: 25, mult: m })
    })
  })
  app.querySelector<HTMLButtonElement>('[data-miss]')!.addEventListener('click', function () {
    throwDart({ value: 0, mult: 1 })
  })
  app.querySelector<HTMLButtonElement>('[data-act="next"]')!.addEventListener('click', function () {
    game!.commitTurn()
    mult = 1
    render()
  })
}

function throwDart(d: Dart) {
  if (!game) {
    return
  }
  game.applyDart(d)
  mult = 1
  render()
}

render()
