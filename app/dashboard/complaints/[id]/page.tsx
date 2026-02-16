'use client';

import { useParams } from 'next/navigation';
import { ComplaintDetailView } from '../../../../components/dashboard/ComplaintDetailView';

export default function ComplaintDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <ComplaintDetailView complaintId={id} />;
}
