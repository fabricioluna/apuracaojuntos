// Gera um NOVO código de login para um fiscal (ou o administrador) já cadastrado, substituindo o
// hash antigo — para quando o código mostrado uma vez foi perdido. Não precisa apagar/recriar o
// cadastro (mantém nome, claim admin e histórico). Imprime o código novo uma única vez.
// Uso: node scripts/trocar-codigo.mjs "Nome exatamente como está em fiscais"
import crypto from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { carregarEnvLocal } from './lib/env.mjs';

carregarEnvLocal();
const nome = process.argv[2];
if (!nome) { console.error('Uso: node scripts/trocar-codigo.mjs "Nome exatamente como está em fiscais"'); process.exit(1); }

const usaEmulador = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(usaEmulador ? { projectId: process.env.FIREBASE_PROJECT_ID ?? 'apuracaojuntos' } : { credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) });

const db = getFirestore();
const achados = await db.collection('fiscais').where('nome', '==', nome).get();
if (achados.empty) { console.error(`Ninguém encontrado em "fiscais" com o nome "${nome}".`); process.exit(1); }
if (achados.size > 1) { console.error(`${achados.size} cadastros com esse nome — apague a ambiguidade antes (veja os IDs no console do Firebase).`); process.exit(1); }

function gerarCodigo(digitos = 6) {
  return String(crypto.randomInt(0, 10 ** digitos)).padStart(digitos, '0');
}
const hashCodigo = codigo => crypto.createHash('sha256').update(codigo.trim()).digest('hex');

const doc = achados.docs[0];
const codigo = gerarCodigo();
await doc.ref.update({ codigoHash: hashCodigo(codigo) });

console.log(`Novo código${usaEmulador ? ' (emulador)' : ''} para "${nome}": ${codigo}`);
console.log('O código antigo parou de funcionar. Guarde este num gerenciador de senhas — ele não fica salvo em texto puro em lugar nenhum.');
process.exit(0);
