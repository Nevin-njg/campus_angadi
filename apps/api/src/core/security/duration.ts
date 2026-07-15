const multipliers: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
}

export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value)
  if (!match) throw new Error(`Unsupported duration: ${value}`)
  const amount = Number(match[1])
  const unit = match[2]
  const multiplier = unit ? multipliers[unit] : undefined
  if (!multiplier) throw new Error(`Unsupported duration unit: ${unit ?? ''}`)
  return amount * multiplier
}
