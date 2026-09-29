'use client';
// Inicialização única do Firebase no navegador. Valores públicos (não são segredo).
import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps()[0] ?? initializeApp(config);
export const clientAuth = getAuth(app);
export const clientDb = getFirestore(app);
export const clientStorage = getStorage(app);

// Só liga nos emuladores locais com a variável explícita (nunca em produção). O SDK do servidor
// usa FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST; o do navegador precisa destas chamadas,
// que só existem uma vez por app (daí o sinalizador global).
declare global {
  // eslint-disable-next-line no-var
  var __cjEmuladoresLigados: boolean | undefined;
}
if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && typeof window !== 'undefined' && !globalThis.__cjEmuladoresLigados) {
  globalThis.__cjEmuladoresLigados = true;
  connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);
  connectStorageEmulator(clientStorage, '127.0.0.1', 9199);
}
