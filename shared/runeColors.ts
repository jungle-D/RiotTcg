export const RUNE_COLORS = ['red', 'blue', 'green', 'purple', 'orange', 'yellow'] as const

export type RuneColor = (typeof RUNE_COLORS)[number]

export function emptyRuneEnergy(): Record<RuneColor, number> {
  return Object.fromEntries(RUNE_COLORS.map((color) => [color, 0])) as Record<RuneColor, number>
}
