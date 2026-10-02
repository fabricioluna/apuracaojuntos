// Envia boletins digitados, com candidatos e seções reais e votos plausíveis, pra PRODUÇÃO de
// verdade (login real + POST /api/boletins), pra testar a contagem (totais/lidera/melhor
// urna/mapa) sem esperar o dia da eleição. Usa o fiscal "Teste de contagem (apagar depois)",
// cadastrado com scripts/cadastrar-fiscal.mjs.
//
// Uso: node scripts/enviar-boletins-teste-producao.mjs <codigo-do-fiscal> [quantidade=10]
//
// Depois de conferir no site: zerar a apuração pela aba Ajustes > "Zona de risco" do painel do
// administrador (ou excluir boletim a boletim na aba Boletins), e excluir o fiscal de teste na
// aba Fiscais (zerar não apaga fiscais).
import fs from 'node:fs';
import { carregarEnvLocal } from './lib/env.mjs';

carregarEnvLocal();

const BASE = process.env.CJ_URL_PRODUCAO ?? 'https://apuracaojuntos.vercel.app';
const CODIGO_FISCAL = process.argv[2];
const QUANTIDADE = Number(process.argv[3] ?? 10);
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

if (!CODIGO_FISCAL) {
  console.error('Uso: node scripts/enviar-boletins-teste-producao.mjs <codigo-do-fiscal> [quantidade=10]');
  process.exit(1);
}
if (!API_KEY) {
  console.error('NEXT_PUBLIC_FIREBASE_API_KEY não encontrada em .env.local.');
  process.exit(1);
}

const candidatos = JSON.parse(fs.readFileSync('data/candidatos.json', 'utf8'));
const cidade = JSON.parse(fs.readFileSync('data/cidade/pesqueira.json', 'utf8'));
const secoesTodas = cidade.zonas[0].secoes;

function aleatorio(max) {
  return Math.floor(Math.random() * (max + 1));
}
function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
function amostra(lista, n) {
  return embaralhar(lista).slice(0, n);
}

function candidatosDoCargo(cargoId) {
  return Object.keys(candidatos[cargoId]).filter((k) => !k.startsWith('p'));
}
function partidosDoCargo(cargoId) {
  const mapa = {};
  for (const [k, v] of Object.entries(candidatos[cargoId])) if (k.startsWith('p')) mapa[k.slice(1)] = v;
  return mapa;
}

// Cargo majoritário (presidente/governador/senador): candidatos reais com votos, branco, nulo.
function gerarMajoritario(cargoId, totalAlvo, qtdCandidatos) {
  const nums = amostra(candidatosDoCargo(cargoId), qtdCandidatos);
  const votos = {};
  let restante = totalAlvo;
  for (let i = 0; i < nums.length; i++) {
    const max = i === nums.length - 1 ? Math.floor(restante * 0.6) : Math.floor((restante / (nums.length - i)) * (0.6 + Math.random() * 0.8));
    const v = Math.max(0, Math.min(max, restante));
    votos[nums[i]] = v;
    restante -= v;
  }
  const branco = Math.floor(restante * Math.random() * 0.6);
  restante -= branco;
  const nulo = Math.max(0, restante);
  return { votos, branco, nulo };
}

// Cargo proporcional (federal/estadual): candidatos + legenda de partido real.
function gerarProporcional(cargoId, totalAlvo, qtdCandidatos) {
  const nums = amostra(candidatosDoCargo(cargoId), qtdCandidatos);
  const partidosDisponiveis = Object.keys(partidosDoCargo(cargoId));
  const partidosEscolhidos = amostra(partidosDisponiveis, Math.min(3, partidosDisponiveis.length));

  const votos = {};
  let restante = totalAlvo;
  for (let i = 0; i < nums.length; i++) {
    const max = Math.floor((restante / (nums.length - i + partidosEscolhidos.length)) * (0.5 + Math.random()));
    const v = Math.max(0, Math.min(max, restante));
    votos[nums[i]] = v;
    restante -= v;
  }
  const legenda = {};
  for (const p of partidosEscolhidos) {
    const max = Math.floor((restante / 3) * Math.random());
    const v = Math.max(0, Math.min(max, restante));
    legenda[p] = v;
    restante -= v;
  }
  const branco = Math.floor(restante * Math.random() * 0.6);
  restante -= branco;
  const nulo = Math.max(0, restante);
  return { votos, legenda, branco, nulo };
}

function gerarDigitado(aptos) {
  const comparecimento = Math.floor(aptos * (0.55 + Math.random() * 0.3));
  return {
    presidente: gerarMajoritario('presidente', comparecimento, 1 + aleatorio(2)),
    governador: gerarMajoritario('governador', comparecimento, 1 + aleatorio(2)),
    senador: gerarMajoritario('senador', Math.floor(comparecimento * (1.4 + Math.random() * 0.5)), 2 + aleatorio(2)),
    federal: gerarProporcional('federal', comparecimento, 2 + aleatorio(3)),
    estadual: gerarProporcional('estadual', comparecimento, 2 + aleatorio(3)),
  };
}

async function login() {
  const r1 = await fetch(`${BASE}/api/auth/entrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: CODIGO_FISCAL }),
  });
  if (!r1.ok) throw new Error(`Login falhou: ${r1.status} ${await r1.text()}`);
  const { token: customToken } = await r1.json();

  const r2 = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!r2.ok) throw new Error(`Troca de token falhou: ${r2.status} ${await r2.text()}`);
  const { idToken } = await r2.json();
  return idToken;
}

async function main() {
  const idToken = await login();
  console.log(`Login ok. Enviando ${QUANTIDADE} boletins para ${BASE}...\n`);

  const secoesEscolhidas = amostra(secoesTodas, QUANTIDADE);
  for (const sec of secoesEscolhidas) {
    const digitado = gerarDigitado(sec.aptos);
    const corpo = { zona: 55, secao: sec.secao, turno: 1, digitado };
    const r = await fetch(`${BASE}/api/boletins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(corpo),
    });
    const dados = await r.json().catch(() => ({}));
    console.log(`Seção ${sec.secao} (${sec.nomeLocal}): HTTP ${r.status} ->`, JSON.stringify(dados.resultado ?? dados.erro ?? dados));
  }
}

main().catch((e) => {
  console.error('ERRO:', e);
  process.exit(1);
});
