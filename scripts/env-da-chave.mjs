// Lê o arquivo JSON da conta de serviço do Firebase e grava as três variáveis FIREBASE_* no .env.local,
// sem mostrar a chave na tela. Mantenha o arquivo JSON FORA da pasta do projeto.
// Uso: node scripts/env-da-chave.mjs "C:\caminho\para\apuracaojuntos-firebase-adminsdk-xxxx.json"
import fs from 'node:fs';

const caminho = process.argv[2];
if (!caminho) { console.error('Uso: node scripts/env-da-chave.mjs <arquivo-da-chave.json>'); process.exit(1); }

const chave = JSON.parse(fs.readFileSync(caminho, 'utf8'));
for (const campo of ['project_id', 'client_email', 'private_key']) {
  if (!chave[campo]) { console.error(`O arquivo não tem o campo ${campo}. É mesmo a chave da conta de serviço?`); process.exit(1); }
}

const novas = {
  FIREBASE_PROJECT_ID: chave.project_id,
  FIREBASE_CLIENT_EMAIL: chave.client_email,
  // Quebras de linha viram \n para caber numa linha do .env; o servidor desfaz isso ao ler.
  FIREBASE_PRIVATE_KEY: `"${chave.private_key.replace(/\n/g, '\\n')}"`,
};

const arquivo = '.env.local';
const linhas = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8').split(/\r?\n/) : [];
for (const [nome, valor] of Object.entries(novas)) {
  const i = linhas.findIndex(l => l.startsWith(nome + '='));
  if (i >= 0) linhas[i] = `${nome}=${valor}`; else linhas.push(`${nome}=${valor}`);
}
fs.writeFileSync(arquivo, linhas.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n');
console.log(`Gravado em ${arquivo}: FIREBASE_PROJECT_ID (${chave.project_id}), FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.`);
