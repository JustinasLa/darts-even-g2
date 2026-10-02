import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OsEventTypeList,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import type {
  CreateStartUpPageContainer,
  EvenAppBridge,
  EvenHubEvent,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { Game, GameView } from './games'

const sdk = vi.hoisted(function () {
  return {
    handler: undefined as ((event: EvenHubEvent) => void) | undefined,
    unsubscribe: vi.fn<() => void>(),
    bridge: {
      createStartUpPageContainer: vi.fn<(page: CreateStartUpPageContainer) => Promise<number>>(),
      textContainerUpgrade: vi.fn<(update: TextContainerUpgrade) => Promise<boolean>>(),
      onEvenHubEvent: vi.fn<(handler: (event: EvenHubEvent) => void) => () => void>(),
      shutDownPageContainer: vi.fn<(mode: number) => Promise<boolean>>(),
    },
  }
})

vi.mock('@evenrealities/even_hub_sdk', async function (importOriginal) {
  const actual = await importOriginal<typeof import('@evenrealities/even_hub_sdk')>()
  return { ...actual, waitForEvenAppBridge: vi.fn() }
})

let games: typeof import('./games')

beforeEach(async function () {
  vi.restoreAllMocks()
  vi.resetModules()
  document.body.innerHTML = '<div id="app"></div>'
  sdk.handler = undefined
  sdk.unsubscribe.mockReset()
  sdk.bridge.createStartUpPageContainer.mockReset().mockResolvedValue(0)
  sdk.bridge.textContainerUpgrade.mockReset().mockResolvedValue(true)
  sdk.bridge.shutDownPageContainer.mockReset().mockResolvedValue(true)
  sdk.bridge.onEvenHubEvent.mockReset().mockImplementation(function (handler) {
    sdk.handler = handler
    return sdk.unsubscribe
  })
  vi.mocked(waitForEvenAppBridge).mockReset().mockResolvedValue(sdk.bridge as unknown as EvenAppBridge)
  games = await import('./games')
})

afterEach(async function () {
  await flush()
  vi.restoreAllMocks()
})

async function flush(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

async function load(): Promise<void> {
  await import('./main')
  await flush()
}

async function click(selector: string): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>(selector)
  expect(button, selector).not.toBeNull()
  button!.click()
  await flush()
}

async function event(payload: { sysEvent?: { eventType?: number | null }; textEvent?: { eventType?: number | null } }): Promise<void> {
  expect(sdk.handler).toBeDefined()
  sdk.handler!(payload as EvenHubEvent)
  await flush()
}

async function tap(): Promise<void> {
  await event({ sysEvent: { eventType: OsEventTypeList.CLICK_EVENT } })
}

async function back(): Promise<void> {
  await event({ sysEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT } })
}

async function move(delta: number): Promise<void> {
  for (let i = 0; i < Math.abs(delta); i++) {
    await event({ textEvent: { eventType: delta < 0 ? OsEventTypeList.SCROLL_TOP_EVENT : OsEventTypeList.SCROLL_BOTTOM_EVENT } })
  }
}

function lens(id = 1): string {
  const updates = sdk.bridge.textContainerUpgrade.mock.calls.map(call => call[0])
  return updates.filter(update => update.containerID === id).at(-1)?.content || ''
}

async function open(id = '301'): Promise<void> {
  await click('[data-cat="' + games.findGame(id)!.category + '"]')
  await click('[data-id="' + id + '"]')
}

async function phoneDart(value: number, mult = 1): Promise<void> {
  if (value === 0) {
    await click('[data-miss]')
  } else if (value === 25) {
    await click('[data-bull="' + mult + '"]')
  } else {
    await click('[data-mult="' + mult + '"]')
    await click('[data-num="' + value + '"]')
  }
}

async function lensDart(multIndex: number, numberIndex?: number): Promise<void> {
  await tap()
  await move(multIndex)
  await tap()
  if (numberIndex !== undefined) {
    await move(numberIndex)
    await tap()
  }
}

async function winOnPhone(): Promise<void> {
  for (const [value, mult] of [[20, 3], [20, 3], [20, 3], [20, 3], [15, 3], [8, 2]]) {
    await phoneDart(value, mult)
  }
}

function fixture(view: Partial<GameView> = {}, route?: Game['checkoutFor']): Game {
  const value: GameView = {
    title: 'Fixture', hint: '', message: '', layout: 'score', turn: [], turnTotal: 0,
    finished: false, winner: null,
    players: [{ name: 'A', primary: '40', secondary: '', active: true, winner: false, out: false }],
    ...view,
  }
  return {
    applyDart: vi.fn(), commitTurn: vi.fn(), undo: vi.fn(), view: () => value,
    lens: vi.fn(() => 'Fixture scoreboard'), checkoutFor: route || vi.fn(() => undefined),
  }
}

function useGame(game: Game, id = '301'): void {
  vi.spyOn(games.findGame(id)!, 'create').mockReturnValue(game)
}

describe('Even G2 bridge', function () {
  it('creates the body and side panel with the expected geometry and event capture', async function () {
    await load()
    expect(waitForEvenAppBridge).toHaveBeenCalledOnce()
    expect(sdk.bridge.createStartUpPageContainer).toHaveBeenCalledOnce()
    expect(sdk.bridge.createStartUpPageContainer.mock.calls[0][0]).toMatchObject({
      containerTotalNum: 2,
      textObject: [
        { containerID: 1, containerName: 'body', xPosition: 0, yPosition: 0, width: 472, height: 288, paddingLength: 4, isEventCapture: 1, content: 'Darts\n\nPick a mode and start throwing' },
        { containerID: 2, containerName: 'panel', xPosition: 480, yPosition: 0, width: 96, height: 288, paddingLength: 4, isEventCapture: 0, content: '' },
      ],
    })
    expect(lens()).toBe('Darts\n\n> X01\n  Cricket')
    expect(lens(2)).toBe('')
    expect(document.querySelectorAll('[data-cat]')).toHaveLength(2)
  })

  it('reports a failed startup result', async function () {
    sdk.bridge.createStartUpPageContainer.mockResolvedValue(1)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await load()
    expect(error).toHaveBeenCalledWith('createStartUpPageContainer failed:', 1)
    expect(lens()).toContain('Darts')
  })

  it('serializes lens updates and snapshots the panel for each draw', async function () {
    let release!: (value: boolean) => void
    sdk.bridge.textContainerUpgrade.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    await load()
    expect(sdk.bridge.textContainerUpgrade).toHaveBeenCalledTimes(1)
    await click('[data-cat="x01"]')
    expect(sdk.bridge.textContainerUpgrade).toHaveBeenCalledTimes(1)
    release(true)
    await flush()
    expect(sdk.bridge.textContainerUpgrade.mock.calls.map(([update]) => [update.containerID, update.content])).toEqual([
      [1, 'Darts\n\n> X01\n  Cricket'], [2, ''],
      [1, 'X01\n\n> 301\n  501\n  701\n  901'], [2, ''],
    ])
  })

  it.each([undefined, null])('treats a missing system event type (%s) as a tap', async function (eventType) {
    await load()
    await event({ sysEvent: { eventType } } as EvenHubEvent)
    expect(lens()).toContain('> 301')
  })

  it('ignores absent, untyped text, and unrelated events', async function () {
    await load()
    const calls = sdk.bridge.textContainerUpgrade.mock.calls.length
    for (const payload of [{}, { textEvent: {} }, { textEvent: { eventType: null } }, { sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT } }]) {
      await event(payload as EvenHubEvent)
    }
    expect(sdk.bridge.textContainerUpgrade).toHaveBeenCalledTimes(calls)
  })

  it.each([OsEventTypeList.SYSTEM_EXIT_EVENT, OsEventTypeList.ABNORMAL_EXIT_EVENT])('unsubscribes on exit event %s', async function (eventType) {
    await load()
    await event({ sysEvent: { eventType } })
    expect(sdk.unsubscribe).toHaveBeenCalledOnce()
    expect(sdk.bridge.shutDownPageContainer).not.toHaveBeenCalled()
  })

  it('requests shutdown when double tapped on home', async function () {
    await load()
    await back()
    expect(sdk.unsubscribe).toHaveBeenCalledOnce()
    expect(sdk.bridge.shutDownPageContainer).toHaveBeenCalledWith(1)
  })

  it('accepts double taps from text events and gives them priority over scrolling', async function () {
    await load()
    await tap()
    await event({ textEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT } })
    expect(lens()).toContain('Darts')
    await event({ sysEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT }, textEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT } })
    expect(sdk.bridge.shutDownPageContainer).toHaveBeenCalledOnce()
  })
})

describe('phone scoreboard', function () {
  it('navigates categories, modes and back buttons', async function () {
    await load()
    await click('[data-cat="cricket"]')
    expect(document.querySelectorAll('[data-id]')).toHaveLength(4)
    expect(lens()).toContain('Standard Cricket')
    await click('[data-act="back"]')
    expect(document.querySelector('.brand')!.textContent).toBe('Darts')
    await open('501')
    expect(document.querySelector('.pscore')!.textContent).toBe('501')
    await click('[data-act="back"]')
    expect(lens()).toContain('> 301')
  })

  it('scores singles, doubles, triples, bulls and misses and undoes a dart', async function () {
    await load()
    await open()
    await phoneDart(20, 3)
    expect(document.querySelector('.pscore')!.textContent).toBe('241')
    expect(document.querySelector('.slot-filled')!.textContent).toBe('T20')
    expect(document.querySelector('[data-mult="1"]')!.classList).toContain('mbtn-on')
    await click('[data-act="undo"]')
    expect(document.querySelector('.pscore')!.textContent).toBe('301')
    await phoneDart(25)
    await phoneDart(25, 2)
    await phoneDart(0)
    expect(document.querySelector('.pscore')!.textContent).toBe('226')
    expect(lens()).toContain('Previous Score: 75')
    await phoneDart(20, 2)
    await click('[data-act="next"]')
    expect(lens()).toContain('Previous Score: 40')
    await phoneDart(1)
    expect(document.querySelector('.pscore')!.textContent).toBe('185')
  })

  it('mirrors checkout suggestions to the phone and side panel and clears on a bust', async function () {
    await load()
    await open()
    for (let i = 0; i < 3; i++) await phoneDart(20, 3)
    expect(lens(2)).toBe('T20\nT19\nD2')
    expect(document.querySelector('.info-bars')!.textContent).toContain('CheckoutT20 T19 D2')
    await phoneDart(20, 3)
    await phoneDart(20, 3)
    expect(document.querySelector('.toast')!.textContent).toBe('BUST')
    expect(lens()).toContain('Previous Score: BUST')
    expect(lens(2)).toBe('T20\nT19\nD2')
  })

  it('offers a rematch after a win and returns to home', async function () {
    await load()
    await open()
    await winOnPhone()
    expect(document.querySelector('.pcard-winner')).not.toBeNull()
    expect(document.querySelector('.over-winner')!.textContent).toBe('Game over')
    expect(lens(2)).toBe('')
    await click('[data-act="rematch"]')
    expect(document.querySelector('.overlay')).toBeNull()
    expect(document.querySelector('.pscore')!.textContent).toBe('301')
    await winOnPhone()
    await click('[data-act="home"]')
    expect(document.querySelector('.brand')!.textContent).toBe('Darts')
  })

  it('renders cricket marks on both surfaces and removes closed panel numbers', async function () {
    await load()
    await open('cricket')
    expect(lens(2)).toBe('20\n19\n18\n17\n16\n15\nBull')
    await phoneDart(20)
    expect(lens(2)).toContain('20 /')
    expect(document.querySelector('.cmark-ico')!.innerHTML).toContain('<svg')
    await phoneDart(20)
    expect(lens(2)).toContain('20 X')
    await phoneDart(20)
    expect(document.querySelector('.cmark-closed')).not.toBeNull()
    expect(lens(2)).not.toContain('20')
    expect(document.querySelector('.cplayer-active')).not.toBeNull()
  })

  it('limits tactics targets to the side panel height', async function () {
    await load()
    await open('tactics')
    expect(lens(2).split('\n')).toEqual(['20', '19', '18', '17', '16', '15', '14', '13', '12', '11'])
    expect(document.querySelectorAll('.cricket tbody tr')).toHaveLength(12)
  })

  it('renders multiple players, status tags, messages and escaped text', async function () {
    useGame(fixture({
      title: '<b>&"', hint: '<hint>', message: '<message>',
      players: [
        { name: 'A', primary: '<score>', secondary: '<detail>', active: true, winner: false, out: false },
        { name: 'B', primary: '20', secondary: '', active: false, winner: true, out: false },
        { name: 'C', primary: '0', secondary: '', active: false, winner: false, out: true },
      ],
    }))
    await load()
    await open()
    expect(document.querySelector('.pgrid-2')).not.toBeNull()
    expect(document.querySelector('.title')!.textContent).toBe('<b>&"')
    expect(document.querySelector('.title b')).toBeNull()
    expect(document.querySelector('.psub')!.textContent).toBe('<detail>')
    expect(document.querySelector('.hint')!.textContent).toBe('<hint>')
    expect(document.querySelector('.toast')!.textContent).toBe('<message>')
    expect(document.querySelector('.pcard-out .ptag')!.textContent).toBe('OUT')
    expect(document.querySelector('.info-bars')).toBeNull()
  })

  it('renders cricket winners and safely handles absent target data', async function () {
    useGame(fixture({
      layout: 'cricket',
      players: [{ name: 'A', primary: '', secondary: '', active: false, winner: true, out: false }],
    }), 'cricket')
    await load()
    await open('cricket')
    expect(document.querySelector('.cplayer-winner')).not.toBeNull()
    expect(document.querySelectorAll('.cricket tbody tr')).toHaveLength(0)
    expect(lens(2)).toBe('')
  })

  it('handles missing cricket marks and a board with no active player', async function () {
    useGame(fixture({
      layout: 'cricket', numbers: [20, 25],
      players: [{ name: 'A', primary: '0', secondary: '', active: false, winner: false, out: false }],
    }), 'cricket')
    await load()
    await open('cricket')
    expect(lens(2)).toBe('20\nBull')
    expect(document.querySelectorAll('.cmark-ico')).toHaveLength(0)
  })

  it('handles an empty cricket scoreboard', async function () {
    useGame(fixture({ layout: 'cricket', numbers: [20], players: [] }), 'cricket')
    await load()
    await open('cricket')
    expect(lens(2)).toBe('20')
  })

  it('omits empty checkout routes from both surfaces', async function () {
    useGame(fixture({}, () => []))
    await load()
    await open()
    expect(lens(2)).toBe('')
    expect(document.querySelector('.info-bars')).toBeNull()
  })

  it('ignores a mode button whose id is missing or unknown', async function () {
    await load()
    await click('[data-cat="x01"]')
    const mode = document.querySelector<HTMLButtonElement>('[data-id="301"]')!
    mode.removeAttribute('data-id')
    mode.click()
    await flush()
    expect(document.querySelector('.game-list')).not.toBeNull()
    mode.dataset.id = 'unknown'
    mode.click()
    await flush()
    expect(document.querySelector('.game-list')).not.toBeNull()
  })

  it('uses safe defaults when keypad attributes are missing', async function () {
    await load()
    await open()
    const multiplier = document.querySelector<HTMLButtonElement>('[data-mult="3"]')!
    multiplier.removeAttribute('data-mult')
    multiplier.click()
    await flush()
    expect(document.querySelector('[data-mult="1"]')!.classList).toContain('mbtn-on')
    const number = document.querySelector<HTMLButtonElement>('[data-num="20"]')!
    number.removeAttribute('data-num')
    number.click()
    await flush()
    expect(document.querySelector('.pscore')!.textContent).toBe('301')
    expect(document.querySelector('.slot-filled')!.textContent).toBe('—')
    const bull = document.querySelector<HTMLButtonElement>('[data-bull="2"]')!
    bull.removeAttribute('data-bull')
    bull.click()
    await flush()
    expect(document.querySelector('.pscore')!.textContent).toBe('276')
  })

  it('ignores a detached keypad button after leaving the game', async function () {
    await load()
    await open()
    const stale = document.querySelector<HTMLButtonElement>('[data-num="20"]')!
    await click('[data-act="back"]')
    const calls = sdk.bridge.textContainerUpgrade.mock.calls.length
    stale.click()
    await flush()
    expect(sdk.bridge.textContainerUpgrade).toHaveBeenCalledTimes(calls)
    expect(document.querySelector('.game-list')).not.toBeNull()
  })
})

describe('G2 gesture navigation and dart entry', function () {
  it('ignores selection and scrolling when a cricket board has no number targets', async function () {
    useGame(fixture({ layout: 'cricket' }), 'cricket')
    await load()
    await open('cricket')
    await tap()
    await tap()
    const calls = sdk.bridge.textContainerUpgrade.mock.calls.length
    expect(lens()).toBe('Dart 1: Single\n')
    await move(1)
    await tap()
    expect(sdk.bridge.textContainerUpgrade).toHaveBeenCalledTimes(calls)
  })

  it('clamps category and mode selections and starts the selected game', async function () {
    await load()
    await move(-1)
    expect(lens()).toContain('> X01')
    await move(3)
    expect(lens()).toContain('> Cricket')
    await tap()
    await move(5)
    expect(lens()).toContain('> Random Cricket')
    await move(-2)
    expect(lens()).toContain('> No Score Cricket')
    await tap()
    expect(document.querySelector('.cricket')).not.toBeNull()
  })

  it('stages, edits and confirms a three-dart turn', async function () {
    await load()
    await tap()
    await tap()
    await lensDart(2, 0)
    expect(lens()).toContain('Dart 1: T20')
    expect(document.querySelector('.pscore')!.textContent).toBe('301')
    await move(-1)
    await lensDart(1, 0)
    expect(lens()).toContain('Dart 1: D20')
    await move(1)
    await lensDart(0, 1)
    await lensDart(4)
    expect(lens()).toContain('Dart 3: Bull')
    expect(lens()).toContain('> Confirm Score')
    await tap()
    expect(document.querySelector('.pscore')!.textContent).toBe('192')
    expect(lens()).toContain('Previous Score: 109')
    expect(lens()).toContain('> Dart 1: ')
  })

  it('requires the next unfilled row and commits empty or partial turns', async function () {
    await load()
    await open()
    await move(2)
    const previous = lens()
    await tap()
    expect(lens()).toBe(previous)
    await move(1)
    await tap()
    expect(document.querySelector('.pscore')!.textContent).toBe('301')
    await lensDart(3)
    await move(2)
    await tap()
    expect(document.querySelector('.pscore')!.textContent).toBe('276')
    expect(lens()).toContain('Previous Score: 25')
  })

  it('scrolls the number window and uses the chosen multiplier', async function () {
    await load()
    await open()
    await tap()
    await tap()
    expect(lens()).toContain('Dart 1: Single   1/20')
    await move(10)
    expect(lens()).toContain('11/20')
    expect(lens()).toContain('> 10')
    await move(15)
    expect(lens()).toContain('20/20')
    expect(lens()).toContain('> 1')
    await tap()
    expect(lens()).toContain('Dart 1: 1')
  })

  it('backs out of number and multiplier entry to the original dart row', async function () {
    await load()
    await open()
    await lensDart(5)
    await tap()
    await move(1)
    await tap()
    expect(lens()).toContain('Dart 2: Double')
    await back()
    expect(lens()).toContain('> Single')
    await back()
    expect(lens()).toContain('> Dart 2: ')
  })

  it('offers resume and quit, preserving staged darts on resume', async function () {
    await load()
    await open()
    await lensDart(5)
    await back()
    expect(lens()).toContain('Quit game?')
    await tap()
    expect(lens()).toContain('Dart 1: —')
    await back()
    await move(1)
    expect(lens()).toContain('> Quit')
    await back()
    expect(lens()).toContain('Dart 1: —')
    await back()
    await move(1)
    await tap()
    expect(lens()).toContain('> 301')
    await back()
    expect(lens()).toContain('> X01')
  })

  it('uses cricket targets and a single bull choice', async function () {
    await load()
    await open('cricket')
    await tap()
    expect(lens()).toBe('Dart 1:\n\n> Single\n  Double\n  Triple\n  Bull\n  Miss')
    await move(2)
    await tap()
    expect(lens()).toContain('Dart 1: Triple\n\n> 20')
    expect(lens()).not.toContain('25')
    await move(5)
    await tap()
    expect(lens()).toContain('Dart 1: T15')
    await lensDart(3)
    await lensDart(4)
    await tap()
    expect(lens(2)).not.toContain('15')
    expect(lens(2)).toContain('Bull /')
  })

  it('stops a staged turn at a bust', async function () {
    await load()
    await open()
    for (let i = 0; i < 3; i++) await phoneDart(20, 3)
    await lensDart(2, 0)
    await lensDart(2, 0)
    await lensDart(5)
    await tap()
    expect(document.querySelector('.pscore')!.textContent).toBe('121')
    expect(lens()).toContain('Previous Score: BUST')
    expect(document.querySelectorAll('.slot-filled')).toHaveLength(0)
  })

  it('stops at a staged checkout and leaves a finished game on double tap', async function () {
    await load()
    await open()
    for (const [value, mult] of [[20, 3], [20, 3], [20, 3], [20, 3], [15, 3]]) await phoneDart(value, mult)
    await lensDart(1, 12)
    await lensDart(5)
    await lensDart(5)
    await tap()
    expect(document.querySelector('.overlay')).not.toBeNull()
    const calls = sdk.bridge.textContainerUpgrade.mock.calls.length
    await move(1)
    await tap()
    expect(sdk.bridge.textContainerUpgrade).toHaveBeenCalledTimes(calls)
    await back()
    expect(lens()).toContain('> 301')
  })
})
