import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Construindo Juntos: apuração paralela',
  description: 'Totalização paralela e não oficial de votos, com boletins de urna enviados por fiscais.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
