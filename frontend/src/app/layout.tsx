import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kwitt Portfolio',
  description: 'AI-Powered Portfolio',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased bg-primary text-white">
        {children}
      </body>
    </html>
  );
}