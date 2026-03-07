import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the actual login component to prevent server-side rendering
const LoginContent = dynamic(() => import('./LoginContent'), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-gov-grey-50" />,
});

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gov-grey-50" />}>
      <LoginContent />
    </Suspense>
  );
}
