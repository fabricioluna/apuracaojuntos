import { CARGOS_ORDEM } from '../bu/cargos';
import { chaveUrna, compararBoletins, impressaoDigital } from '../domain/comparar';
import type { BoletimEntrada, BoletimGravado, ResultadoEnvio } from '../domain/types';
import { db } from './firebase-admin';
import { ajustarTotais, atualizarMapa } from './totais';

function paraBoletimGravado(entrada: BoletimEntrada, extra: Pick<BoletimGravado, 'id' | 'fiscalId' | 'fiscalNome' | 'enviadoEm'>): BoletimGravado {
  const base: BoletimGravado = { ...extra, zona: entrada.zona, secao: entrada.secao, turno: entrada.turno, cargos: entrada.cargos };
  // O Firestore recusa campos com valor undefined; um boletim digitado não tem origemBU nem assinatura.
  return entrada.origemBU ? { ...base, assinatura: entrada.origemBU.assinatura } : base;
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
      t.set(ref, novo);
      for (const cargoId of CARGOS_ORDEM) {
        const cargo = entrada.cargos[cargoId];
        if (cargo) ajustarTotais(t, entrada.turno, cargoId, cargo, 1, 1);
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
