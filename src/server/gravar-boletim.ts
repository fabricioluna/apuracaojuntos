import { CARGOS_ORDEM } from '../bu/cargos';
import { chaveUrna, compararBoletins, impressaoDigital } from '../domain/comparar';
import { melhorasDeMelhorUrna, vencedorDaUrna } from '../domain/lideranca';
import type { BoletimEntrada, BoletimGravado, ResultadoEnvio } from '../domain/types';
import { db } from './firebase-admin';
import { ajustarLidera, ajustarTotais, aplicarMelhorUrna, atualizarMapa, lerMelhorAtual } from './totais';

function paraBoletimGravado(entrada: BoletimEntrada, extra: Pick<BoletimGravado, 'id' | 'fiscalId' | 'fiscalNome' | 'enviadoEm'>): BoletimGravado {
  let base: BoletimGravado = { ...extra, zona: entrada.zona, secao: entrada.secao, turno: entrada.turno, cargos: entrada.cargos };
  // O Firestore recusa campos com valor undefined; por isso só incluímos cada campo opcional quando existe.
  if (entrada.origemBU) base = { ...base, assinatura: entrada.origemBU.assinatura };
  if (entrada.fotoPaths?.length) base = { ...base, fotoPaths: entrada.fotoPaths };
  return base;
}

/**
 * Regra central: uma urna só entra uma vez. Grava o boletim e atualiza os totais na mesma transação
 * (urna nova), ou compara campo a campo e cria/atualiza a divergência (urna já cadastrada), sem nunca
 * sobrescrever o cadastro existente. Ver a regra completa em CLAUDE.md.
 */
export async function gravarBoletim(
  entrada: BoletimEntrada,
  fiscal: { uid: string; nome: string },
): Promise<ResultadoEnvio> {
  const id = chaveUrna(entrada.zona, entrada.secao, entrada.turno);
  const ref = db().collection('boletins').doc(id);
  const agora = Date.now();
  const novo = paraBoletimGravado(entrada, { id, fiscalId: fiscal.uid, fiscalNome: fiscal.nome, enviadoEm: agora });

  return db().runTransaction(async t => {
    const atualSnap = await t.get(ref);

    if (!atualSnap.exists) {
      // Todas as leituras (inclusive as de "melhor urna" de cada cargo) precisam vir antes de
      // qualquer escrita nesta transação.
      const melhorAtualPorCargo: Partial<Record<(typeof CARGOS_ORDEM)[number], Awaited<ReturnType<typeof lerMelhorAtual>>>> = {};
      for (const cargoId of CARGOS_ORDEM) {
        if (entrada.cargos[cargoId]) melhorAtualPorCargo[cargoId] = await lerMelhorAtual(t, entrada.turno, cargoId);
      }

      t.set(ref, novo);
      for (const cargoId of CARGOS_ORDEM) {
        const cargo = entrada.cargos[cargoId];
        if (!cargo) continue;
        ajustarTotais(t, entrada.turno, cargoId, cargo, 1, 1);
        ajustarLidera(t, entrada.turno, cargoId, vencedorDaUrna(cargo), 1);
        aplicarMelhorUrna(t, entrada.turno, cargoId, melhorasDeMelhorUrna(cargo, entrada.zona, entrada.secao, melhorAtualPorCargo[cargoId]!));
      }
      atualizarMapa(t, entrada.turno, entrada.zona, entrada.secao, 'ok', true);
      return { status: 'novo' };
    }

    const atual = atualSnap.data() as BoletimGravado;
    const diffs = compararBoletins(atual, novo);
    if (diffs.length === 0) {
      return { status: 'igual', fiscalNome: atual.fiscalNome, enviadoEm: atual.enviadoEm };
    }

    const fingerprint = impressaoDigital(novo);
    const divRef = db().collection('divergencias').doc(`${id}_${fingerprint}`);
    const divSnap = await t.get(divRef);
    if (divSnap.exists && divSnap.data()!.status === 'pendente') {
      return { status: 'divergente', diffs, jaAvisado: true };
    }

    t.set(divRef, { id: divRef.id, key: id, novo, diffs, status: 'pendente', criadoEm: agora });
    atualizarMapa(t, entrada.turno, entrada.zona, entrada.secao, 'div');
    return { status: 'divergente', diffs, jaAvisado: false };
  });
}
