// Cadastra um fiscal (ou o administrador, com --admin) e imprime o código UMA vez, para você repassar
// à pessoa por um canal seguro (o código não fica salvo em lugar nenhum além do hash no Firestore).
// Uso: node scripts/cadastrar-fiscal.mjs "Nome da pessoa" [--admin]
import crypto from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { carregarEnvLocal } from './lib/env.mjs';

carregarEnvLocal();
const nome = process.argv[2];
const admin = process.argv.includes('--admin');
if (!nome) { console.error('Uso: node scripts/cadastrar-fiscal.mjs "Nome da pessoa" [--admin]'); process.exit(1); }

const usaEmulador = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(usaEmulador ? { projectId: process.env.FIREBASE_PROJECT_ID ?? 'apuracaojuntos' } : { credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) });

function gerarCodigo(digitos = 6) {
  return String(crypto.randomInt(0, 10 ** digitos)).padStart(digitos, '0');
}
const hashCodigo = codigo => crypto.createHash('sha256').update(codigo.trim()).digest('hex');

const codigo = gerarCodigo();
const ref = await getFirestore().collection('fiscais').add({
  nome,
  admin,
  ativo: true,
  codigoHash: hashCodigo(codigo),
  criadoPor: 'script (cadastrar-fiscal.mjs)',
  criadoEm: Date.now(),
});

console.log(`Cadastrado${usaEmulador ? ' no emulador' : ''}: ${nome}${admin ? ' (administrador)' : ''}`);
console.log(`Código: ${codigo}`);
console.log(`Documento: fiscais/${ref.id}`);
console.log('Repasse o código a essa pessoa por um canal seguro (WhatsApp, por exemplo). Ele não é gravado em texto puro em lugar nenhum.');
process.exit(0);
