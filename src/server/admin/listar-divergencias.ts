import { db } from '../firebase-admin';
import type { BoletimGravado, Divergencia } from '../../domain/types';

export interface DivergenciaDetalhada extends Divergencia {
  /** Cadastro atual da urna, lido na hora (pode já ter mudado desde que a divergência foi criada). */
  atual?: BoletimGravado;
}

/** Lista as divergências pendentes e as resolvidas, com o cadastro atual de cada urna lido na hora. */
export async function listarDivergencias(): Promise<{ pendentes: DivergenciaDetalhada[]; resolvidas: DivergenciaDetalhada[] }> {
  const snap = await db().collection('divergencias').get();
  const todas = snap.docs.map(d => d.data() as Divergencia);

  const chaves = [...new Set(todas.map(d => d.key))];
  const boletins = new Map<string, BoletimGravado>();
  await Promise.all(
    chaves.map(async key => {
      const doc = await db().collection('boletins').doc(key).get();
      if (doc.exists) boletins.set(key, doc.data() as BoletimGravado);
    }),
  );

  const detalhadas: DivergenciaDetalhada[] = todas.map(d => ({ ...d, atual: boletins.get(d.key) }));
  return {
    pendentes: detalhadas.filter(d => d.status === 'pendente').sort((a, b) => a.criadoEm - b.criadoEm),
    resolvidas: detalhadas.filter(d => d.status === 'resolvida').sort((a, b) => (b.resolvidaEm ?? 0) - (a.resolvidaEm ?? 0)),
  };
}
