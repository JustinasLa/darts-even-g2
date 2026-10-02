export type Lang = 'en'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
]

const en = {
  appTitle: 'Darts',
  tagline: 'Pick a mode and start throwing',

  catX01: 'X01',
  catCricket: 'Cricket',
  catX01Blurb: 'Count down to zero',
  catCricketBlurb: 'Close numbers, rack up points',

  back: 'Back',
  home: 'Home',
  players: 'Players',
  player: 'Player',
  addPlayer: 'Add player',
  start: 'Start',
  options: 'Options',
  on: 'On',
  off: 'Off',

  optDoubleOut: 'Double out',
  optDoubleIn: 'Double in',
  optLegs: 'Legs to win',
  optSets: 'Sets to win',

  lensCurrentScore: 'Current Score',
  lensPreviousScore: 'Previous Score',
  lensLegAverage: 'Leg Average',
  lensDart: 'Dart',
  lensConfirmScore: 'Confirm Score',
  lensSingle: 'Single',
  lensDouble: 'Double',
  lensTriple: 'Triple',

  single: 'S',
  double: 'D',
  triple: 'T',
  miss: 'Miss',
  bull: '25',
  bullEye: 'Bull',
  undo: 'Undo',
  next: 'Next',

  left: 'Left',
  score: 'Score',
  darts: 'Darts',
  bust: 'BUST',
  out: 'OUT',
  checkout: 'Checkout',
  noCheckout: 'No checkout',

  gameOver: 'Game over',
  wins: 'wins',
  rematch: 'Rematch',
  playAgain: 'Play again',
  backToModes: 'Back to Gamemode selection',
  quitTitle: 'Quit game?',
  quitWarning: "You'll lose progress",
  resume: 'Resume',
  quit: 'Quit',
  standings: 'Standings',
  bestOf: 'Best of',
  avgPerDart: 'Avg / dart',
  avgPerTurn: 'Avg / turn',

  startBull: 'Hit a double to start',

  game_301_name: '301',
  game_301_blurb: 'Race from 301 to zero',
  game_501_name: '501',
  game_501_blurb: 'The classic 501 leg',
  game_701_name: '701',
  game_701_blurb: 'A longer 701 grind',
  game_901_name: '901',
  game_901_blurb: 'Marathon 901',

  game_cricket_name: 'Standard Cricket',
  game_cricket_blurb: 'Close 15-20 and bull, score points',
  game_noscore_name: 'No Score Cricket',
  game_noscore_blurb: 'First to close every number',
  game_tactics_name: 'Tactics',
  game_tactics_blurb: 'Cricket on 10-20 and bull',
  game_random_name: 'Random Cricket',
  game_random_blurb: 'Seven random targets',
}

export type StringKey = keyof typeof en

const STRINGS: Record<Lang, Record<StringKey, string>> = { en }

let current: Lang = 'en'

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  current = lang
}

export function t(key: StringKey): string {
  return STRINGS[current][key]
}
