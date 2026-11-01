export type ImportedGuest = {
  full_name: string
  email?: string
  phone?: string
  household?: string
  dietary?: string
  plus_ones: number
  notes?: string
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

export function parseGuestCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return { guests: [] as ImportedGuest[], errors: ['The file is empty.'] }
  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/\s+/g, '_'))
  const nameIndex = headers.findIndex((header) => ['full_name', 'name', 'guest'].includes(header))
  if (nameIndex < 0) return { guests: [] as ImportedGuest[], errors: ['A name or full_name column is required.'] }
  const guests: ImportedGuest[] = []
  const errors: string[] = []
  lines.slice(1).forEach((line, index) => {
    const cells = splitCsvLine(line)
    const full_name = cells[nameIndex] ?? ''
    if (!full_name) {
      errors.push(`Row ${index + 2} is missing a name.`)
      return
    }
    const value = (key: string) => {
      const at = headers.indexOf(key)
      return at >= 0 ? cells[at] || undefined : undefined
    }
    guests.push({
      full_name,
      email: value('email'),
      phone: value('phone'),
      household: value('household'),
      dietary: value('dietary'),
      plus_ones: Number(value('plus_ones') ?? 0) || 0,
      notes: value('notes'),
    })
  })
  return { guests, errors }
}

export function buildInvitation(eventName: string, guestName: string, token: string, origin: string) {
  const url = `${origin}/invite/${token}`
  const subject = `You’re invited to ${eventName}`
  const preview_html = `<article style="font-family:Georgia,serif;color:#24221e;padding:32px;background:#f8f6f1"><p style="letter-spacing:.14em;text-transform:uppercase;color:#b86b4f;font-size:12px">Celebrate AI</p><h1 style="font-weight:400">Dear ${guestName},</h1><p>You are invited to ${eventName}. Please RSVP so we can save your place.</p><p><a href="${url}" style="background:#24221e;color:#fff;padding:12px 18px;text-decoration:none">RSVP now</a></p></article>`
  return { subject, preview_html, url }
}
