export const ROLES = ['owner', 'planner', 'coordinator', 'viewer'] as const
export type EventRole = (typeof ROLES)[number]

const permissions = {
  'event.read': ['owner', 'planner', 'coordinator', 'viewer'],
  'event.update': ['owner', 'planner'],
  'event.delete': ['owner'],
  'preferences.update': ['owner', 'planner'],
  'plan.generate': ['owner', 'planner'],
  'plan.approve': ['owner', 'planner'],
  'budget.write': ['owner', 'planner'],
  'task.write': ['owner', 'planner', 'coordinator'],
  'vendor.write': ['owner', 'planner', 'coordinator'],
  'guest.write': ['owner', 'planner', 'coordinator'],
  'team.manage': ['owner'],
} as const

export type Permission = keyof typeof permissions

export function can(role: EventRole | null | undefined, permission: Permission) {
  if (!role) return false
  return (permissions[permission] as readonly EventRole[]).includes(role)
}
