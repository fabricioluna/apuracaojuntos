import type { Metadata } from 'next';
import { Archivo, Instrument_Sans } from 'next/font/google';
import { Cabecalho } from '../src/ui/Cabecalho';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['wdth'],
  variable: '--font-display',
  display: 'swap',
});
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-texto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Construindo Juntos: apuração paralela',
  description: 'Totalização paralela e não oficial de votos, com boletins de urna enviados por fiscais.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${instrumentSans.variable}`}>
      <body>
        <Cabecalho />
        {children}
      </body>
    </html>
  );
}
