import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db } from './firebase-admin';

const MAX_TENTATIVAS = 8;
const JANELA_MS = 15 * 60 * 1000;

export function hashCodigo(codigo: string): string {
  return crypto.createHash('sha256').update(codigo.trim()).digest('hex');
}

/** Gera um código numérico aleatório (não usa Math.random, que não é seguro para isto). */
export function gerarCodigo(digitos = 6): string {
  const max = 10 ** digitos;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(digitos, '0');
}

export type ResultadoLogin = { ok: true; token: string; nome: string; admin: boolean } | { ok: false; mensagem: string };

/**
 * Confere o código contra a lista de fiscais e, se válido, devolve um token do Firebase Auth (custom token).
 * `identificador` é usado só para limitar tentativas (ex.: o IP da requisição); nunca é gravado com o código.
 */
export async function autenticarFiscal(codigo: string, identificador: string): Promise<ResultadoLogin> {
  if (!/^\d{4,10}$/.test(codigo.trim())) return { ok: false, mensagem: 'Código inválido.' };

  const bloqueado = await estaBloqueado(identificador);
  if (bloqueado) return { ok: false, mensagem: 'Muitas tentativas com este código. Aguarde alguns minutos e tente de novo.' };

  const cont = db().collection('fiscais');
  const achou = await cont.where('codigoHash', '==', hashCodigo(codigo)).limit(1).get();
  if (achou.empty || achou.docs[0]!.data().ativo !== true) {
    await registrarTentativa(identificador);
    return { ok: false, mensagem: 'Código incorreto ou desativado. Confira com quem organiza a fiscalização.' };
  }

  const doc = achou.docs[0]!;
  const { nome, admin = false } = doc.data() as { nome: string; admin?: boolean };

  // Garante que o usuário já existe no Auth antes de gravar a claim, inclusive no primeiro login
  // desta pessoa. Sem isso, a claim só pegaria a partir do segundo login, e uma renovação silenciosa
  // do token (depois de ~1h com o app aberto) perderia "admin" e "nome" antes disso. A conferência de
  // ativo/admin ao vivo no Firestore (exigirFiscal) continua sendo a autorização que vale de verdade;
  // isto é só para a interface não errar o que mostra.
  await auth()
    .getUser(doc.id)
    .catch(() => auth().createUser({ uid: doc.id }));
  await auth().setCustomUserClaims(doc.id, { fiscal: true, admin, nome });
  const token = await auth().createCustomToken(doc.id, { fiscal: true, admin, nome });

  await limparTentativas(identificador);
  return { ok: true, token, nome, admin };
}

async function estaBloqueado(identificador: string): Promise<boolean> {
  const doc = await db().collection('tentativasLogin').doc(identificador).get();
  if (!doc.exists) return false;
  const { contagem, inicioJanela } = doc.data() as { contagem: number; inicioJanela: number };
  return Date.now() - inicioJanela < JANELA_MS && contagem >= MAX_TENTATIVAS;
}

async function registrarTentativa(identificador: string): Promise<void> {
  const ref = db().collection('tentativasLogin').doc(identificador);
  await db().runTransaction(async t => {
    const doc = await t.get(ref);
    const agora = Date.now();
    if (!doc.exists || agora - (doc.data()!.inicioJanela as number) >= JANELA_MS) {
      t.set(ref, { contagem: 1, inicioJanela: agora });
    } else {
      t.update(ref, { contagem: FieldValue.increment(1) });
    }
  });
}

async function limparTentativas(identificador: string): Promise<void> {
  await db().collection('tentativasLogin').doc(identificador).delete().catch(() => {});
}
