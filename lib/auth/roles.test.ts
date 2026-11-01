import { describe, expect, it } from 'vitest'
import { can } from './roles'

describe('roles', () => {
  it('keeps viewers read-only and owners fully capable', () => {
    expect(can('viewer', 'event.read')).toBe(true)
    expect(can('viewer', 'budget.write')).toBe(false)
    expect(can('coordinator', 'task.write')).toBe(true)
    expect(can('coordinator', 'plan.approve')).toBe(false)
    expect(can('owner', 'event.delete')).toBe(true)
  })
})
