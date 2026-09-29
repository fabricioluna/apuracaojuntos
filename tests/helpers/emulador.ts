import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import { connectAuthEmulator, inMemoryPersistence, initializeAuth, signInWithCustomToken } from 'firebase/auth';
import { db, auth as adminAuth } from '../../src/server/firebase-admin';
import { hashCodigo } from '../../src/server/fiscal-auth';
import { autenticarFiscal } from '../../src/server/fiscal-auth';

const PROJECT = () => process.env.FIREBASE_PROJECT_ID!;

/** Apaga todos os documentos do Firestore e todas as contas do Auth, só no emulador. */
export async function limparEmulador(): Promise<void> {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT()}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT()}/accounts`, { method: 'DELETE' });
}

let clientApp: ReturnType<typeof initClientApp> | undefined;
function obterClientApp() {
  if (!clientApp) {
    clientApp = getClientApps()[0] ?? initClientApp({ projectId: PROJECT(), apiKey: 'fake-api-key-emulador' });
  }
  return clientApp;
}

/** Cadastra um fiscal direto no Firestore (sem passar pelo script) e devolve o código gerado. */
export async function seedFiscal(nome: string, opcoes: { admin?: boolean; ativo?: boolean } = {}): Promise<{ uid: string; codigo: string }> {
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const ref = await db().collection('fiscais').add({
    nome,
    admin: opcoes.admin ?? false,
    ativo: opcoes.ativo ?? true,
    codigoHash: hashCodigo(codigo),
    criadoPor: 'teste',
    criadoEm: Date.now(),
  });
  return { uid: ref.id, codigo };
}

/** Faz o login completo (código -> custom token -> troca real no Auth emulator) e devolve um ID token válido. */
export async function loginComoFiscal(nome: string, opcoes: { admin?: boolean; ativo?: boolean } = {}): Promise<{ uid: string; idToken: string; nome: string }> {
  const { uid, codigo } = await seedFiscal(nome, opcoes);
  const r = await autenticarFiscal(codigo, 'teste');
  if (!r.ok) throw new Error('Falha ao autenticar no teste: ' + r.mensagem);

  const auth = initializeAuth(obterClientApp(), { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const cred = await signInWithCustomToken(auth, r.token);
  const idToken = await cred.user.getIdToken();
  return { uid, idToken, nome: r.nome };
}

export { adminAuth };
