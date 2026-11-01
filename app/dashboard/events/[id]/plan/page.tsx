import { PlannerPanel } from '@/components/planner-panel'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PlannerPanel eventId={id} />
}
