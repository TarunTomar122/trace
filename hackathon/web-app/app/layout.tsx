import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YapTrap — YouTube to Character',
  description: 'Turn any YouTube video into a talking character',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
