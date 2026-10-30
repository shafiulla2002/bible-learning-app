import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bible Institute Management Platform',
  description: 'Enterprise LMS for Bible Institutes, Faculty and Learners',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#F8FAFC]">{children}</body>
    </html>
  );
}
