import { FieldValue } from 'firebase-admin/firestore';
import { CARGOS_ORDEM } from '../../bu/cargos';
import { vencedorDaUrna } from '../../domain/lideranca';
import type { BoletimGravado } from '../../domain/types';
import { db } from '../firebase-admin';
import { ajustarLidera, ajustarTotais } from '../totais';

export class ErroExcluirBoletim extends Error {}

/**
 * Exclui um boletim de vez e desfaz a contribuição dele nos totais/lidera/mapa, na mesma transação
 * (regra inversa de gravarBoletim — mesmo padrão de ajustarTotais/ajustarLidera com sinal -1 já usado
 * em resolver-divergencia.ts). Também apaga qualquer divergência pendente ligada a essa urna: não faz
 * mais sentido resolver uma divergência contra um boletim que não existe mais.
 *
 * Limitação aceita, igual à de resolver-divergencia.ts: "melhor urna" não é recalculada pra trás. Se
 * este boletim era o "melhor" de algum candidato, o registro fica desatualizado até outra urna
 * superá-lo — recalcular exigiria varrer todos os boletins restantes.
 */
export async function excluirBoletim(id: string): Promise<void> {
  const ref = db().collection('boletins').doc(id);

  await db().runTransaction(async t => {
    const snap = await t.get(ref);
    if (!snap.exists) throw new ErroExcluirBoletim('Boletim não encontrado.');
    const atual = snap.data() as BoletimGravado;

    // Leituras antes de qualquer escrita (regra das transações do Firestore).
    const divergenciasSnap = await t.get(db().collection('divergencias').where('key', '==', id).where('status', '==', 'pendente'));
    const versoesSnap = await t.get(ref.collection('versoes'));

    for (const cargoId of CARGOS_ORDEM) {
      const cargo = atual.cargos[cargoId];
      if (!cargo) continue;
      ajustarTotais(t, atual.turno, cargoId, cargo, -1, -1);
      ajustarLidera(t, atual.turno, cargoId, vencedorDaUrna(cargo), -1);
    }
    t.set(db().collection('mapa').doc(String(atual.turno)), { secoes: { [`${atual.zona}-${atual.secao}`]: FieldValue.delete() } }, { merge: true });
    for (const doc of divergenciasSnap.docs) t.delete(doc.ref);
    for (const doc of versoesSnap.docs) t.delete(doc.ref);
    t.delete(ref);
  });
}
