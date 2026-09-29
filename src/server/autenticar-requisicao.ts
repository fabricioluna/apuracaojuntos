import { auth, db } from './firebase-admin';

export class ErroAutenticacao extends Error {
  status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

export interface FiscalAutenticado {
  uid: string;
  nome: string;
  admin: boolean;
}

/**
 * Verifica o token do Firebase Auth enviado no cabeçalho Authorization e confere, ao vivo no Firestore,
 * que o fiscal continua ativo (não confia só na claim do token, que pode estar até 1h desatualizada).
 */
export async function exigirFiscal(headerAutorizacao: string | null): Promise<FiscalAutenticado> {
  const token = headerAutorizacao?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ErroAutenticacao(401, 'Faça login para continuar.');

  let decodificado;
  try {
    decodificado = await auth().verifyIdToken(token);
  } catch {
    throw new ErroAutenticacao(401, 'Sessão expirada. Faça login de novo.');
  }
  if (!decodificado.fiscal) throw new ErroAutenticacao(403, 'Esta conta não está autorizada como fiscal.');

  const doc = await db().collection('fiscais').doc(decodificado.uid).get();
  if (!doc.exists || doc.data()!.ativo !== true) {
    throw new ErroAutenticacao(403, 'Este cadastro de fiscal foi desativado.');
  }
  return { uid: decodificado.uid, nome: doc.data()!.nome as string, admin: doc.data()!.admin === true };
}

/** Como exigirFiscal, mas recusa quem não é administrador. */
export async function exigirAdmin(headerAutorizacao: string | null): Promise<FiscalAutenticado> {
  const f = await exigirFiscal(headerAutorizacao);
  if (!f.admin) throw new ErroAutenticacao(403, 'Esta ação é só do administrador.');
  return f;
}
