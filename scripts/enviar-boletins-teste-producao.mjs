// Envia boletins digitados, com candidatos e seções reais e votos plausíveis, pra PRODUÇÃO de
// verdade (login real + POST /api/boletins), pra testar a contagem (totais/lidera/melhor
// urna/mapa) sem esperar o dia da eleição. Usa o fiscal "Teste de contagem (apagar depois)",
// cadastrado com scripts/cadastrar-fiscal.mjs.
//
// Uso: node scripts/enviar-boletins-teste-producao.mjs <codigo-do-fiscal> [quantidade=10]
//
// Os candidatos da lista curada (src/domain/acompanhados.ts, "destaque: true") sempre entram, com
// votação puxada pra cima — pra uma demonstração (painel ao vivo) mostrar nomes reconhecíveis
// liderando, em vez de só números aleatórios. O boletim impresso simulado continua com o aviso
// "BOLETIM SIMULADO" bem visível (ver CLAUDE.md) — isso não muda; o que muda aqui é só a
// distribuição de votos entre candidatos de verdade, pra um teste/demonstração mais realista.
//
// Depois de conferir no site: zerar a apuração pela aba Ajustes > "Zona de risco" do painel do
// administrador (ou excluir boletim a boletim na aba Boletins), e excluir o fiscal de teste na
// aba Fiscais (zerar não apaga fiscais).
import fs from 'node:fs';
import { carregarEnvLocal } from './lib/env.mjs';

// Mesmos números de src/domain/acompanhados.ts — duplicado aqui de propósito: este é um script
// Node avulso (.mjs), sem compilar TypeScript só pra reaproveitar essa lista pequena e estável.
const ACOMPANHADOS = {
  presidente: [{ numero: '13', destaque: false }, { numero: '22', destaque: false }],
  governador: [{ numero: '50', destaque: false }, { numero: '40', destaque: false }, { numero: '55', destaque: true }],
  senador: [
    { numero: '111', destaque: false },
    { numero: '130', destaque: true },
    { numero: '123', destaque: false },
    { numero: '222', destaque: false },
    { numero: '555', destaque: true },
  ],
  federal: [
    { numero: '2222', destaque: false },
    { numero: '1314', destaque: false },
    { numero: '4004', destaque: false },
    { numero: '2256', destaque: false },
    { numero: '1111', destaque: false },
    { numero: '2000', destaque: false },
    { numero: '1010', destaque: true },
  ],
  estadual: [
    { numero: '22222', destaque: false },
    { numero: '40400', destaque: false },
    { numero: '11555', destaque: false },
    { numero: '13123', destaque: false },
    { numero: '40444', destaque: true },
    { numero: '10000', destaque: false },
    { numero: '20120', destaque: true },
    { numero: '20123', destaque: false },
    { numero: '40123', destaque: false },
    { numero: '40555', destaque: false },
  ],
};

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

/** Monta a lista de candidatos de um cargo: todos os acompanhados (destaque ou não) primeiro, mais
 * `qtdExtras` outros candidatos reais sorteados — e um peso de voto maior pra quem é "destaque", pra
 * puxar esses nomes pra cima na apuração (útil numa demonstração: mostra gente reconhecível
 * liderando, não só números aleatórios). */
function candidatosComPeso(cargoId, qtdExtras) {
  const acompanhados = ACOMPANHADOS[cargoId] ?? [];
  const jaEscolhidos = new Set(acompanhados.map((c) => c.numero));
  const restantesPool = candidatosDoCargo(cargoId).filter((n) => !jaEscolhidos.has(n));
  const extras = amostra(restantesPool, qtdExtras).map((numero) => ({ numero, destaque: false }));
  return [...acompanhados, ...extras].map((c) => ({ ...c, peso: c.destaque ? 4 + Math.random() * 3 : 0.4 + Math.random() }));
}

/** Distribui `totalAlvo` votos entre `itens` (cada um com `.peso`), proporcional ao peso — o
 * último item absorve o resto da divisão, então a soma bate exatamente com `totalAlvo`. */
function distribuirPorPeso(itens, totalAlvo) {
  const somaPesos = itens.reduce((a, it) => a + it.peso, 0) || 1;
  const votos = {};
  let restante = totalAlvo;
  itens.forEach((it, i) => {
    const v = i === itens.length - 1 ? restante : Math.max(0, Math.round((it.peso / somaPesos) * totalAlvo));
    votos[it.numero] = Math.min(v, Math.max(0, restante));
    restante -= votos[it.numero];
  });
  return votos;
}

// Cargo majoritário (presidente/governador/senador): candidatos reais com votos, branco, nulo.
function gerarMajoritario(cargoId, totalAlvo, qtdExtras) {
  const itens = candidatosComPeso(cargoId, qtdExtras);
  const votosValidos = Math.round(totalAlvo * (0.75 + Math.random() * 0.15));
  const votos = distribuirPorPeso(itens, votosValidos);
  const restante = totalAlvo - votosValidos; // a folga entre comparecimento e votos válidos vira brancos/nulos
  const branco = Math.floor(restante * Math.random() * 0.6);
  const nulo = Math.max(0, restante - branco);
  return { votos, branco, nulo };
}

// Cargo proporcional (federal/estadual): candidatos (acompanhados primeiro) + legenda de partido real.
function gerarProporcional(cargoId, totalAlvo, qtdExtras) {
  const itens = candidatosComPeso(cargoId, qtdExtras);
  const partidosDisponiveis = Object.keys(partidosDoCargo(cargoId));
  const partidosEscolhidos = amostra(partidosDisponiveis, Math.min(3, partidosDisponiveis.length));

  const votosValidos = Math.round(totalAlvo * (0.7 + Math.random() * 0.15));
  const votosCandidatos = Math.round(votosValidos * (0.75 + Math.random() * 0.15));
  const votos = distribuirPorPeso(itens, votosCandidatos);

  const legenda = {};
  let restanteLegenda = votosValidos - votosCandidatos;
  partidosEscolhidos.forEach((p, i) => {
    const v = i === partidosEscolhidos.length - 1 ? restanteLegenda : Math.floor((restanteLegenda / partidosEscolhidos.length) * Math.random());
    legenda[p] = Math.max(0, Math.min(v, restanteLegenda));
    restanteLegenda -= legenda[p];
  });

  // Folga entre comparecimento e votos válidos, mais o que sobrou de legenda (se o último partido
  // não consumiu tudo) — tudo isso vira brancos/nulos, pra soma bater com totalAlvo exatamente.
  const restante = totalAlvo - votosValidos + restanteLegenda;
  const branco = Math.floor(restante * Math.random() * 0.6);
  const nulo = Math.max(0, restante - branco);
  return { votos, legenda, branco, nulo };
}

function gerarDigitado(aptos) {
  const comparecimento = Math.floor(aptos * (0.55 + Math.random() * 0.3));
  return {
    presidente: gerarMajoritario('presidente', comparecimento, 1 + aleatorio(2)),
    governador: gerarMajoritario('governador', comparecimento, 1 + aleatorio(2)),
    senador: gerarMajoritario('senador', Math.floor(comparecimento * (1.4 + Math.random() * 0.5)), 1 + aleatorio(2)),
    federal: gerarProporcional('federal', comparecimento, 1 + aleatorio(2)),
    estadual: gerarProporcional('estadual', comparecimento, 1 + aleatorio(2)),
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
