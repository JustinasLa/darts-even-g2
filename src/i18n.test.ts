import { afterEach, describe, expect, it } from 'vitest'
import { getLang, LANGS, setLang, t } from './i18n'
import { GAMES } from './games'

afterEach(function () {
  setLang('en')
})

describe('localisation', function () {
  it('defaults to English and supports the advertised language', function () {
    expect(getLang()).toBe('en')
    expect(LANGS).toEqual([{ code: 'en', label: 'English' }])
    for (const language of LANGS) {
      setLang(language.code)
      expect(getLang()).toBe(language.code)
      expect(t('appTitle')).toBe('Darts')
      expect(t('gameOver')).toBe('Game over')
    }
  })

  it('provides names, descriptions and option labels for every game', function () {
    for (const def of GAMES) {
      expect(t(def.name)).toBeTruthy()
      expect(t(def.blurb)).toBeTruthy()
      for (const option of def.options) expect(t(option.label)).toBeTruthy()
    }
  })
})
