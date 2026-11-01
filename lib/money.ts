export function toMinor(amount: number) {
  return Math.round(amount * 100)
}

export function fromMinor(minor: number) {
  return minor / 100
}

export function formatMoney(minor: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(fromMinor(minor ?? 0))
}

export function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return 'Not set'
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, options ?? { month: 'short', day: 'numeric', year: 'numeric' })
}
