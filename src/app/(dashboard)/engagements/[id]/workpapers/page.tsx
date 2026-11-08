'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { allWorkflowsOf, workflowsOf } from '@/lib/workflows';

/** Working papers are managed on the year's workflow; older links land there. */
export default function WorkingPapersRedirect() {
  const params = useParams();
  const router = useRouter();
  const engagementId = params?.id as string;

  useEffect(() => {
    const wf = workflowsOf(engagementId)[0] ?? allWorkflowsOf(engagementId)[0];
    router.replace(wf ? `/engagements/${engagementId}/workflows/${wf.id}` : `/engagements/${engagementId}`);
  }, [engagementId, router]);

  return null;
}
