import { expandDiscordHandles } from '@/lib/quotations'

describe('expandDiscordHandles', () => {
  const users = [
    { handle: 'anil', discordUserId: '111' },
    { handle: 'nishi', discordUserId: '222' },
  ]

  it('expands known @handles to Discord mentions', () => {
    const { discordBody, mentionedHandles } = expandDiscordHandles('Hey @anil please check', users)
    expect(discordBody).toBe('Hey <@111> please check')
    expect(mentionedHandles).toEqual(['anil'])
  })

  it('leaves unknown handles alone', () => {
    const { discordBody, mentionedHandles } = expandDiscordHandles('ping @nobody', users)
    expect(discordBody).toBe('ping @nobody')
    expect(mentionedHandles).toEqual([])
  })

  it('expands multiple handles case-insensitively', () => {
    const { discordBody, mentionedHandles } = expandDiscordHandles('@Anil and @NISHI', users)
    expect(discordBody).toBe('<@111> and <@222>')
    expect(mentionedHandles.sort()).toEqual(['anil', 'nishi'])
  })
})
