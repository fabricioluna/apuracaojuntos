'use client';
import { useEffect } from 'react';

// Registra o service worker (public/sw.js) assim que a página carrega. Precisa existir um service
// worker com um listener de "fetch" pra o navegador considerar o site instalável (critério do
// Chrome) — o worker em si só repassa as requisições pra rede, sem cache: quem cuida do cenário
// offline é a fila em IndexedDB (src/client/fila-offline.ts), não o service worker.
export function RegistrarPWA() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
