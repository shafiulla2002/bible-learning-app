import { redirect } from 'next/navigation';

export default function HomePage() {
  // Public website is postponed; root redirects straight to Login / Portal selector
  redirect('/login');
}
