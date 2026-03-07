'use client';

import { AuthProvider } from '../components/providers/AuthProvider';
import { ThemeProvider } from '../components/providers/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  );
}
