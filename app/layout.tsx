import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '../components/providers/AuthProvider';

export const metadata: Metadata = {
  title: 'Regulatory Complaint Triage Platform',
  description: 'AI-powered complaint triage and management for government regulators',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
