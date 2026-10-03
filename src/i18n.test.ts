import { describe, expect, it } from 'vitest'
import { t } from './i18n'
import { GAMES } from './games'

describe('localisation', function () {
  it('provides English app and dart-entry labels', function () {
    expect(t('appTitle')).toBe('Darts')
    expect(t('gameOver')).toBe('Game over')
    expect(t('single')).toBe('S')
    expect(t('double')).toBe('D')
    expect(t('triple')).toBe('T')
    expect(t('miss')).toBe('Miss')
    expect(t('bull')).toBe('25')
    expect(t('bullEye')).toBe('Bull')
  })

  it('provides names, descriptions and option labels for every game', function () {
    for (const def of GAMES) {
      expect(t(def.name)).toBeTruthy()
      expect(t(def.blurb)).toBeTruthy()
      for (const option of def.options) expect(t(option.label)).toBeTruthy()
    }
  })
})
