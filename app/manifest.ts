// PWA instalável (pedido original, ver CLAUDE.md > Stack). Os ícones vêm de app/icon.tsx
// (gerados em /icon/192 e /icon/512 — conferido em `next build`, ver Route (app)).
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Construindo Juntos — Apuração',
    short_name: 'Construindo Juntos',
    description: 'Totalização paralela e não oficial de votos, feita por fiscais e voluntários.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3eafb',
    theme_color: '#1a052d',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
