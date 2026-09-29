import { db } from '../firebase-admin';
import { gerarCodigo, hashCodigo } from '../fiscal-auth';

export interface FiscalResumo {
  id: string;
  nome: string;
  ativo: boolean;
  admin: boolean;
  criadoPor: string;
  criadoEm: number;
}

export async function listarFiscais(): Promise<FiscalResumo[]> {
  const snap = await db().collection('fiscais').get();
  return snap.docs
    .map(d => {
      const v = d.data();
      return { id: d.id, nome: v.nome, ativo: v.ativo === true, admin: v.admin === true, criadoPor: v.criadoPor, criadoEm: v.criadoEm };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Cadastra um fiscal e devolve o código em texto puro (só desta vez; não fica salvo em lugar nenhum). */
export async function cadastrarFiscal(nome: string, admin: boolean, criadoPor: string): Promise<{ id: string; codigo: string }> {
  const codigo = gerarCodigo();
  const ref = await db()
    .collection('fiscais')
    .add({ nome, admin, ativo: true, codigoHash: hashCodigo(codigo), criadoPor, criadoEm: Date.now() });
  return { id: ref.id, codigo };
}

export async function definirAtivo(id: string, ativo: boolean): Promise<void> {
  await db().collection('fiscais').doc(id).update({ ativo });
}
