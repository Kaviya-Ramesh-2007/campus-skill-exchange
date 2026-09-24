import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Campus Skill Exchange',
    template: '%s | Campus Skill Exchange',
  },
  description: 'A peer-to-peer skill exchange platform. Learn. Teach. Exchange. Grow.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
