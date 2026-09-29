import { CARGOS_ORDEM } from '../bu/cargos';
import { compararBoletins } from '../domain/comparar';
import { melhorasDeMelhorUrna, vencedorDaUrna } from '../domain/lideranca';
import type { BoletimGravado, DecisaoDivergencia, Divergencia } from '../domain/types';
import { db } from './firebase-admin';
import { ajustarLidera, ajustarTotais, aplicarMelhorUrna, atualizarMapa, lerMelhorAtual } from './totais';

export class ErroDivergencia extends Error {}

/**
 * Decisão do administrador sobre uma divergência. "Manter" só fecha o registro. "Usar o novo" substitui
 * o boletim, recalcula os totais na mesma transação (subtrai os votos antigos, soma os novos), guarda
 * o cadastro anterior para auditoria, e encerra sozinhas as outras divergências pendentes da mesma urna
 * que passem a conferir com o cadastro validado.
 */
export async function resolverDivergencia(divergenciaId: string, decisao: DecisaoDivergencia, admin: { uid: string; nome: string }): Promise<void> {
  const divRef = db().collection('divergencias').doc(divergenciaId);

  await db().runTransaction(async t => {
    const divSnap = await t.get(divRef);
    if (!divSnap.exists) throw new ErroDivergencia('Divergência não encontrada.');
    const div = divSnap.data() as Divergencia;
    if (div.status !== 'pendente') throw new ErroDivergencia('Esta divergência já foi resolvida por outra pessoa.');

    const boletimRef = db().collection('boletins').doc(div.key);
    const boletimSnap = await t.get(boletimRef);
    if (!boletimSnap.exists) throw new ErroDivergencia('O boletim desta divergência não existe mais.');
    const atual = boletimSnap.data() as BoletimGravado;

    const outrasSnap = await t.get(db().collection('divergencias').where('key', '==', div.key).where('status', '==', 'pendente'));

    // Leituras de "melhor urna" antes de qualquer escrita (regra das transações do Firestore).
    const melhorAtualPorCargo: Partial<Record<(typeof CARGOS_ORDEM)[number], Awaited<ReturnType<typeof lerMelhorAtual>>>> = {};
    if (decisao === 'novo') {
      for (const cargoId of CARGOS_ORDEM) {
        if (div.novo.cargos[cargoId]) melhorAtualPorCargo[cargoId] = await lerMelhorAtual(t, div.novo.turno, cargoId);
      }
    }

    const agora = Date.now();
    t.update(divRef, { status: 'resolvida', decisao, resolvidaPor: admin.nome, resolvidaEm: agora });

    const encerradas = new Set<string>();
    if (decisao === 'novo') {
      for (const cargoId of CARGOS_ORDEM) {
        const antigo = atual.cargos[cargoId];
        if (antigo) {
          ajustarTotais(t, atual.turno, cargoId, antigo, -1, 0);
          ajustarLidera(t, atual.turno, cargoId, vencedorDaUrna(antigo), -1);
        }
        const novoCargo = div.novo.cargos[cargoId];
        if (novoCargo) {
          ajustarTotais(t, div.novo.turno, cargoId, novoCargo, 1, 0);
          ajustarLidera(t, div.novo.turno, cargoId, vencedorDaUrna(novoCargo), 1);
          aplicarMelhorUrna(t, div.novo.turno, cargoId, melhorasDeMelhorUrna(novoCargo, atual.zona, atual.secao, melhorAtualPorCargo[cargoId]!));
        }
      }
      t.set(boletimRef.collection('versoes').doc(), { ...atual, substituidoEm: agora, substituidoPor: admin.nome });
      t.set(boletimRef, { ...div.novo, id: div.key, corrigidoPor: admin.nome, corrigidoEm: agora, fiscalAnteriorId: atual.fiscalId });

      for (const doc of outrasSnap.docs) {
        if (doc.id === divRef.id) continue;
        const outra = doc.data() as Divergencia;
        if (compararBoletins(div.novo, outra.novo).length === 0) {
          t.update(doc.ref, { status: 'resolvida', decisao: 'novo', resolvidaPor: admin.nome, resolvidaEm: agora, observacao: 'Confere com o cadastro validado.' });
          encerradas.add(doc.id);
        }
      }
    }

    const aindaPendentes = outrasSnap.docs.some(d => d.id !== divRef.id && !encerradas.has(d.id));
    atualizarMapa(t, atual.turno, atual.zona, atual.secao, aindaPendentes ? 'div' : 'ok');
  });
}
