import type { Metadata, Viewport } from 'next';
import { Archivo, Instrument_Sans } from 'next/font/google';
import { Cabecalho } from '../src/ui/Cabecalho';
import { RegistrarPWA } from '../src/ui/RegistrarPWA';
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
  appleWebApp: { title: 'Construindo Juntos', statusBarStyle: 'black-translucent' },
};

// Cor da barra do navegador/status bar quando o app está aberto, e do splash screen ao instalar
// (ver também app/manifest.ts, que define background/theme separados pro ícone instalado).
export const viewport: Viewport = {
  themeColor: '#1a052d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${instrumentSans.variable}`}>
      <body>
        <RegistrarPWA />
        <Cabecalho />
        {children}
      </body>
    </html>
  );
}
