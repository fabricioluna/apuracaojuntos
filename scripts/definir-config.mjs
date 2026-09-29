// Grava config/publico no Firestore a partir de data/cidade/<municipio>.json.
// Uso: node scripts/definir-config.mjs data/cidade/pesqueira.json
// Se as variáveis FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST estiverem definidas, grava no
// emulador local em vez do projeto real (útil para testes).
import fs from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { carregarEnvLocal } from './lib/env.mjs';

carregarEnvLocal();
const arquivo = process.argv[2];
if (!arquivo) { console.error('Uso: node scripts/definir-config.mjs <arquivo-da-cidade.json>'); process.exit(1); }

const cidade = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

const usaEmulador = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(usaEmulador ? { projectId: process.env.FIREBASE_PROJECT_ID ?? 'apuracaojuntos' } : { credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) });

// Estes três valores não vêm do CSV do TSE; confirme-os antes de rodar em produção (ver CLAUDE.md).
const UF = process.env.CIDADE_UF ?? 'PE';
const CODIGO_MUNICIPIO = Number(process.env.CIDADE_CODIGO_MUNICIPIO ?? 25178);
const TURNO = Number(process.env.CIDADE_TURNO ?? 1);

const config = {
  uf: UF,
  municipio: CODIGO_MUNICIPIO,
  nomeMunicipio: cidade.municipio,
  turno: TURNO,
  // nomeLocal identifica o local de votação (escola, colégio...), para o painel público mostrar
  // quais localidades ainda faltam, não só números de zona/seção.
  zonas: cidade.zonas.map(z => ({
    zona: z.zona,
    secoes: z.secoes.map(s => ({ secao: s.secao, aptos: s.aptos, ...(s.nomeLocal ? { nomeLocal: s.nomeLocal } : {}) })),
  })),
  cargosPorTurno: {
    1: ['presidente', 'governador', 'senador', 'federal', 'estadual'],
    2: ['presidente'], // ajuste depois se o 2º turno também tiver governador
  },
};

await getFirestore().collection('config').doc('publico').set(config);
const totalSecoes = config.zonas.reduce((a, z) => a + z.secoes.length, 0);
console.log(`config/publico gravado${usaEmulador ? ' (emulador)' : ''}: ${config.nomeMunicipio}/${UF}, ${config.zonas.length} zona(s), ${totalSecoes} seções, ${TURNO}º turno.`);
process.exit(0);
