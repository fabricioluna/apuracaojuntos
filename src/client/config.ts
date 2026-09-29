'use client';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { clientDb } from './firebase';
import type { ConfigCidade } from '../domain/types';

/** config/publico é de leitura pública (ver firestore.rules): não precisa de login para ler. */
export function usarConfigCidade(): { config: ConfigCidade | null; carregando: boolean } {
  const [config, setConfig] = useState<ConfigCidade | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(
    () =>
      onSnapshot(
        doc(clientDb, 'config', 'publico'),
        snap => {
          setConfig(snap.exists() ? (snap.data() as ConfigCidade) : null);
          setCarregando(false);
        },
        () => setCarregando(false),
      ),
    [],
  );

  return { config, carregando };
}
