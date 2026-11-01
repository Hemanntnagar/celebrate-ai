import { describe, expect, it } from 'vitest'
import { assessScheduleImpact, hasCycle } from './impact'

describe('task dependencies', () => {
  it('rejects cyclic dependencies', () => {
    expect(hasCycle([{ task_id: 'b', depends_on_id: 'a' }], { task_id: 'a', depends_on_id: 'b' })).toBe(true)
    expect(hasCycle([{ task_id: 'b', depends_on_id: 'a' }], { task_id: 'c', depends_on_id: 'b' })).toBe(false)
  })

  it('suggests later dates when a predecessor slips', () => {
    const impact = assessScheduleImpact(
      [
        { id: 'a', title: 'Book venue', due_date: '2026-05-01' },
        { id: 'b', title: 'Send invites', due_date: '2026-05-10' },
      ],
      [{ task_id: 'b', depends_on_id: 'a' }],
      'a',
      '2026-05-04',
    )
    expect(impact.deltaDays).toBe(3)
    expect(impact.affected[0]?.suggested_due).toBe('2026-05-13')
  })
})
