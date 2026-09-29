// Inicialização única do Firebase Admin SDK, reaproveitada entre chamadas na mesma instância serverless.
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function lerVariaveis() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Faltam as variáveis do Firebase Admin (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). ' +
        'Rode scripts/env-da-chave.mjs com a chave da conta de serviço.',
    );
  }
  return { projectId, clientEmail, privateKey };
}

function obterApp(): App {
  const existente = getApps()[0];
  if (existente) return existente;
  // Com o emulador, o Admin SDK não precisa de credenciais reais (basta apontar o projeto).
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'apuracaojuntos' });
  }
  return initializeApp({ credential: cert(lerVariaveis()) });
}

export const db = () => getFirestore(obterApp());
export const auth = () => getAuth(obterApp());
