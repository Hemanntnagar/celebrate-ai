import { describe, expect, it } from 'vitest'
import { parseGuestCsv } from './csv'

describe('parseGuestCsv', () => {
  it('imports named guests and reports missing names', () => {
    const result = parseGuestCsv('full_name,email,plus_ones\nAsha Rao,asha@example.com,1\n,,0')
    expect(result.guests).toEqual([{ full_name: 'Asha Rao', email: 'asha@example.com', phone: undefined, household: undefined, dietary: undefined, plus_ones: 1, notes: undefined }])
    expect(result.errors[0]).toContain('missing a name')
  })

  it('requires a name column', () => {
    expect(parseGuestCsv('email\na@b.com').errors[0]).toMatch(/name/)
  })
})
