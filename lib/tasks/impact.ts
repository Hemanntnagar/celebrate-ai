export type TaskNode = { id: string; title: string; due_date?: string | null }
export type Dependency = { task_id: string; depends_on_id: string }

export function hasCycle(dependencies: Dependency[], extra?: Dependency) {
  const edges = extra ? [...dependencies, extra] : dependencies
  const graph = new Map<string, string[]>()
  for (const edge of edges) {
    const list = graph.get(edge.depends_on_id) ?? []
    list.push(edge.task_id)
    graph.set(edge.depends_on_id, list)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const walk = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    for (const next of graph.get(id) ?? []) if (walk(next)) return true
    visiting.delete(id)
    visited.add(id)
    return false
  }
  return [...new Set(edges.flatMap((edge) => [edge.task_id, edge.depends_on_id]))].some(walk)
}

export function assessScheduleImpact(tasks: TaskNode[], dependencies: Dependency[], changedId: string, newDueDate: string) {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const outgoing = new Map<string, string[]>()
  for (const edge of dependencies) {
    const list = outgoing.get(edge.depends_on_id) ?? []
    list.push(edge.task_id)
    outgoing.set(edge.depends_on_id, list)
  }
  const toLocalDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const toStamp = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const changed = byId.get(changedId)
  const previous = changed?.due_date ? toLocalDate(changed.due_date).getTime() : null
  const next = toLocalDate(newDueDate)
  const deltaDays = previous == null ? 0 : Math.round((next.getTime() - previous) / 86400000)
  const affected: Array<{ id: string; title: string; previous_due: string | null; suggested_due: string }> = []
  const queue = [...(outgoing.get(changedId) ?? [])]
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const task = byId.get(id)
    if (task) {
      const base = task.due_date ? toLocalDate(task.due_date) : new Date(next)
      if (task.due_date) base.setDate(base.getDate() + deltaDays)
      affected.push({
        id: task.id,
        title: task.title,
        previous_due: task.due_date ?? null,
        suggested_due: toStamp(base),
      })
    }
    queue.push(...(outgoing.get(id) ?? []))
  }
  return { deltaDays, affected }
}
