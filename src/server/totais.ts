import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import type { CargoApurado, CargoId } from '../bu/types';

/**
 * Soma (ou subtrai, com sinal -1) os votos de um cargo aos documentos de totais, dentro da transação.
 * Usa incrementos em campos de mapa aninhado (votos.<numero>, legenda.<numero>): testado no emulador,
 * um incremento só toca a chave indicada e funciona mesmo se o documento ainda não existir.
 */
export function ajustarTotais(t: Transaction, turno: number, cargoId: CargoId, cargo: CargoApurado, sinal: 1 | -1, deltaUrnas: number): void {
  const ref = db().collection('totais').doc(`${turno}_${cargoId}`);
  const votos: Record<string, ReturnType<typeof FieldValue.increment>> = {};
  for (const [n, v] of Object.entries(cargo.votos)) if (v !== 0) votos[n] = FieldValue.increment(sinal * v);
  const legenda: Record<string, ReturnType<typeof FieldValue.increment>> = {};
  for (const [n, v] of Object.entries(cargo.legenda)) if (v !== 0) legenda[n] = FieldValue.increment(sinal * v);

  t.set(
    ref,
    {
      turno,
      cargo: cargoId,
      urnas: FieldValue.increment(deltaUrnas),
      votos,
      legenda,
      branco: FieldValue.increment(sinal * cargo.branco),
      nulo: FieldValue.increment(sinal * cargo.nulo),
      total: FieldValue.increment(sinal * cargo.total),
      atualizadoEm: Date.now(),
    },
    { merge: true },
  );
}

export function atualizarMapa(t: Transaction, turno: number, zona: number, secao: number, status: 'ok' | 'div', ultimo?: boolean): void {
  const ref = db().collection('mapa').doc(String(turno));
  const dados: Record<string, unknown> = { secoes: { [`${zona}-${secao}`]: status } };
  if (ultimo) dados.ultimo = { zona, secao, turno, em: Date.now() };
  t.set(ref, dados, { merge: true });
}
