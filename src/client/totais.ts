'use client';
// Leitura em tempo real dos totais por cargo e do mapa de urnas. Só lê documentos agregados
// (públicos por regra do Firestore); nunca lê boletins individuais.
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { clientDb } from './firebase';
import type { CargoId } from '../bu/types';

export interface MelhorUrna {
  votos: number;
  zona: number;
  secao: number;
}

export interface TotaisCargo {
  turno: number;
  cargo: CargoId;
  urnas: number;
  votos: Record<string, number>;
  legenda: Record<string, number>;
  branco: number;
  nulo: number;
  total: number;
  lidera: Record<string, number>;
  melhor: Record<string, MelhorUrna>;
  atualizadoEm: number;
}

export function usarTotaisCargo(turno: number, cargoId: CargoId): { totais: TotaisCargo | null; carregando: boolean } {
  const [totais, setTotais] = useState<TotaisCargo | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    return onSnapshot(
      doc(clientDb, 'totais', `${turno}_${cargoId}`),
      snap => {
        setTotais(snap.exists() ? (snap.data() as TotaisCargo) : null);
        setCarregando(false);
      },
      () => setCarregando(false),
    );
  }, [turno, cargoId]);

  return { totais, carregando };
}

export interface MapaTurno {
  secoes: Record<string, 'ok' | 'div'>;
  ultimo?: { zona: number; secao: number; turno: number; em: number };
}

export function usarMapa(turno: number): { mapa: MapaTurno | null } {
  const [mapa, setMapa] = useState<MapaTurno | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(clientDb, 'mapa', String(turno)),
        snap => setMapa(snap.exists() ? (snap.data() as MapaTurno) : null),
        () => setMapa(null),
      ),
    [turno],
  );

  return { mapa };
}
