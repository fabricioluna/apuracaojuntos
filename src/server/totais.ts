import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import type { CargoApurado, CargoId } from '../bu/types';
import type { MelhorUrna } from '../domain/lideranca';

function refTotais(turno: number, cargoId: CargoId) {
  return db().collection('totais').doc(`${turno}_${cargoId}`);
}

/** Lê o "melhor" registrado hoje para um cargo, para comparar antes de decidir se uma urna o supera. */
export async function lerMelhorAtual(t: Transaction, turno: number, cargoId: CargoId): Promise<Record<string, MelhorUrna>> {
  const doc = await t.get(refTotais(turno, cargoId));
  return (doc.data()?.melhor as Record<string, MelhorUrna>) ?? {};
}

/** Soma (ou subtrai) 1 no contador de "em quantas urnas lidera" do vencedor desta urna. */
export function ajustarLidera(t: Transaction, turno: number, cargoId: CargoId, vencedor: string | undefined, sinal: 1 | -1): void {
  if (!vencedor) return;
  t.set(refTotais(turno, cargoId), { lidera: { [vencedor]: FieldValue.increment(sinal) } }, { merge: true });
}

/** Aplica as melhorias de "melhor urna" já calculadas (ver src/domain/lideranca.ts). */
export function aplicarMelhorUrna(t: Transaction, turno: number, cargoId: CargoId, melhorias: Record<string, MelhorUrna>): void {
  if (Object.keys(melhorias).length === 0) return;
  t.set(refTotais(turno, cargoId), { melhor: melhorias }, { merge: true });
}

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
