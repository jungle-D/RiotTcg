export const RUNE_COLORS = ['red', 'blue', 'green', 'purple', 'orange', 'yellow'] as const

export type RuneColor = (typeof RUNE_COLORS)[number]

export const RUNE_COLOR_LABELS: Record<RuneColor, string> = {
  red: '红',
  blue: '蓝',
  green: '绿',
  purple: '紫',
  orange: '橙',
  yellow: '黄',
}

export function isRuneColor(value: string): value is RuneColor {
  return (RUNE_COLORS as readonly string[]).includes(value)
}

export function emptyRuneEnergy(): Record<RuneColor, number> {
  return Object.fromEntries(RUNE_COLORS.map((color) => [color, 0])) as Record<RuneColor, number>
}
