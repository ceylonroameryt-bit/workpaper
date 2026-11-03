import { redirect } from 'next/navigation';

// Adjustments now live in the journal register (JNL-04)
export default async function AdjustmentsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/engagements/${id}/journals`);
}
