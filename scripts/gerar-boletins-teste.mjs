// Gera boletins de urna SINTÉTICOS pra teste — mas com QR Code de verdade, que o nosso próprio
// decodificador (src/bu) aceita e decodifica normalmente. Usa os candidatos oficiais de
// data/candidatos.json e as seções reais de Pesqueira (data/cidade/pesqueira.json), com votos
// sorteados.
//
// FASE:S (simulado) de propósito, não FASE:O — o servidor recusa boletins fora de FASE:O em
// produção a não ser que PERMITIR_BU_TESTE esteja ligado (ver src/domain/validar-boletim.ts e
// CLAUDE.md > Decisões aprovadas). Assim, mesmo por engano, estes boletins nunca entram na
// apuração de verdade — só servem pra testar a leitura (câmera, foto, IA).
//
// Uso: node scripts/gerar-boletins-teste.mjs [quantidade]
// Saída: docs/boletins-teste/<secao>/ — um PNG por QR Code, um relatorio.html (texto + QR
// embutido) e um dados.json (gabarito, pra conferir o que cada forma de leitura devolveu).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const candidatos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/candidatos.json'), 'utf8'));
const cidade = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/cidade/pesqueira.json'), 'utf8'));

// Mesmos números de src/domain/acompanhados.ts — duplicado aqui de propósito (script Node avulso,
// sem compilar TypeScript só por isso). Usado pra puxar esses candidatos pra liderança nos boletins
// gerados, sem fixar um resultado (ainda sorteado, só com o peso pendendo pra eles).
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

const CARGOS = [
  { id: 'presidente', codigo: 1, tipo: 0, nome: 'Presidente' },
  { id: 'governador', codigo: 3, tipo: 0, nome: 'Governador' },
  { id: 'senador', codigo: 5, tipo: 0, nome: 'Senador' },
  { id: 'federal', codigo: 6, tipo: 1, nome: 'Deputado Federal' },
  { id: 'estadual', codigo: 7, tipo: 1, nome: 'Deputado Estadual' },
];

const sorteioInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
function sorteiaSemRepetir(lista, n) {
  const copia = [...lista];
  const saida = [];
  for (let i = 0; i < n && copia.length > 0; i++) {
    const idx = Math.floor(Math.random() * copia.length);
    saida.push(copia.splice(idx, 1)[0]);
  }
  return saida;
}

function sha512Hex(texto) {
  return crypto.createHash('sha512').update(texto, 'utf8').digest('hex').toUpperCase();
}

/** Divide o conteúdo em N QR Codes (cortando só em espaços, pra remontar igual ao original) e
 * calcula a cadeia de hashes exatamente como src/bu/hash.ts confere. */
function montarPartesQR(conteudo, numPartes) {
  const palavras = conteudo.split(' ');
  const porParte = Math.max(1, Math.ceil(palavras.length / numPartes));
  const blocos = [];
  for (let i = 0; i < palavras.length; i += porParte) blocos.push(palavras.slice(i, i + porParte).join(' '));

  let acumulado = '';
  const textos = [];
  for (let i = 0; i < blocos.length; i++) {
    const dados = blocos[i];
    const entrada = acumulado === '' ? dados : `${acumulado} ${dados}`;
    const hash = sha512Hex(entrada);
    acumulado = `${entrada} HASH:${hash}`;
    const ehUltima = i === blocos.length - 1;
    const assi = ehUltima ? ` ASSI:${crypto.randomBytes(64).toString('hex').toUpperCase()}` : '';
    textos.push(`QRBU:${i + 1}:${blocos.length} VRQR:6.0 ${dados} HASH:${hash}${assi}`);
  }
  return textos;
}

/** Monta o bloco de um cargo majoritário: candidatos soltos, sem PART. */
function blocoMajoritario(cargo, votosPorCandidato, aptos, branco, nulo) {
  const nomi = Object.values(votosPorCandidato).reduce((a, b) => a + b, 0);
  const totc = nomi + branco + nulo;
  const candidatosTxt = Object.entries(votosPorCandidato).map(([n, v]) => `${n}:${v}`).join(' ');
  return {
    texto: `IDEL:1 MAJO CARG:${cargo.codigo} TIPO:0 ${candidatosTxt} APTA:${aptos} NOMI:${nomi} BRAN:${branco} NULO:${nulo} TOTC:${totc}`,
    resumo: { votos: votosPorCandidato, legenda: {}, branco, nulo, total: totc },
  };
}

/** Monta o bloco de um cargo proporcional: candidatos agrupados por partido (2 primeiros dígitos
 * do número, igual à convenção real do TSE), com legenda por partido. */
function blocoProporcional(cargo, votosPorCandidato, legendaPorPartido, aptos, branco, nulo) {
  const porPartido = new Map();
  for (const [numero, votos] of Object.entries(votosPorCandidato)) {
    const partido = numero.slice(0, 2);
    if (!porPartido.has(partido)) porPartido.set(partido, {});
    porPartido.get(partido)[numero] = votos;
  }
  for (const partido of Object.keys(legendaPorPartido)) if (!porPartido.has(partido)) porPartido.set(partido, {});

  let nomi = 0;
  const blocosPartido = [];
  for (const [partido, cands] of porPartido) {
    const candidatosTxt = Object.entries(cands).map(([n, v]) => `${n}:${v}`).join(' ');
    const somaPartido = Object.values(cands).reduce((a, b) => a + b, 0);
    const legp = legendaPorPartido[partido] ?? 0;
    nomi += somaPartido;
    blocosPartido.push(`PART:${partido}${candidatosTxt ? ' ' + candidatosTxt : ''} LEGP:${legp} TOTP:${somaPartido + legp}`);
  }
  const legc = Object.values(legendaPorPartido).reduce((a, b) => a + b, 0);
  const totc = nomi + legc + branco + nulo;
  // O decodificador (src/bu/content.ts) só devolve os partidos com legenda > 0 no resultado final
  // (mesmo que o wire format sempre traga LEGP:0 explícito) — o gabarito precisa bater com isso.
  const legendaFinal = Object.fromEntries(Object.entries(legendaPorPartido).filter(([, v]) => v > 0));
  return {
    texto: `IDEL:2 PROP CARG:${cargo.codigo} TIPO:1 ${blocosPartido.join(' ')} APTA:${aptos} NOMI:${nomi} LEGC:${legc} BRAN:${branco} NULO:${nulo} TOTC:${totc}`,
    resumo: { votos: votosPorCandidato, legenda: legendaFinal, branco, nulo, total: totc },
  };
}

/** Candidatos de um cargo: todo acompanhado (destaque ou não) entra sempre, mais alguns extras
 * sorteados — cada um com um peso de voto (bem maior pra quem é "destaque"), pra puxar esses nomes
 * pra liderança sem fixar o resultado (ainda sorteado, só com a balança pendendo pra eles). */
function candidatosComPeso(cargoId, qtdExtras) {
  const lista = candidatos[cargoId] ?? {};
  const numerosCandidatos = Object.keys(lista).filter(k => !k.startsWith('p'));
  const acompanhados = ACOMPANHADOS[cargoId] ?? [];
  const jaEscolhidos = new Set(acompanhados.map(c => c.numero));
  const restantesPool = numerosCandidatos.filter(n => !jaEscolhidos.has(n));
  const extras = sorteiaSemRepetir(restantesPool, qtdExtras).map(numero => ({ numero, destaque: false }));
  return [...acompanhados, ...extras].map(c => ({ ...c, peso: c.destaque ? 4 + Math.random() * 3 : 0.4 + Math.random() }));
}

/** Distribui `totalVotos` entre `itens` (cada um com `.peso`) proporcional ao peso — o último item
 * absorve o resto da divisão, então a soma bate exatamente com `totalVotos`. */
function distribuirPorPeso(itens, totalVotos) {
  const somaPesos = itens.reduce((a, it) => a + it.peso, 0) || 1;
  const votos = {};
  let restante = totalVotos;
  itens.forEach((it, i) => {
    const v = i === itens.length - 1 ? restante : Math.max(0, Math.round((it.peso / somaPesos) * totalVotos));
    votos[it.numero] = Math.min(v, Math.max(0, restante));
    restante -= votos[it.numero];
  });
  return votos;
}

function gerarCargo(cargo, aptos) {
  const lista = candidatos[cargo.id] ?? {};
  const branco = sorteioInt(0, 6);
  const nulo = sorteioInt(0, 6);

  if (cargo.tipo === 0) {
    const nExtras = cargo.id === 'senador' ? sorteioInt(1, 2) : sorteioInt(0, 2);
    const itens = candidatosComPeso(cargo.id, nExtras);
    const totalNominal = itens.length * sorteioInt(8, 25);
    const votos = distribuirPorPeso(itens, totalNominal);
    return blocoMajoritario(cargo, votos, aptos, branco, nulo);
  }

  const nExtras = sorteioInt(1, 3);
  const itens = candidatosComPeso(cargo.id, nExtras);
  const totalNominal = itens.length * sorteioInt(6, 20);
  const votos = distribuirPorPeso(itens, totalNominal);
  const escolhidos = itens.map(it => it.numero);
  const partidosEnvolvidos = new Set(escolhidos.map(n => n.slice(0, 2)));
  // Sorteia legenda pra alguns partidos envolvidos, e também pra 0-2 partidos sem candidato sorteado.
  const numerosPartido = Object.keys(lista).filter(k => k.startsWith('p')).map(k => k.slice(1));
  for (const extra of sorteiaSemRepetir(numerosPartido, sorteioInt(0, 2))) partidosEnvolvidos.add(extra);
  const legenda = {};
  for (const partido of partidosEnvolvidos) if (Math.random() < 0.7) legenda[partido] = sorteioInt(0, 10);

  return blocoProporcional(cargo, votos, legenda, aptos, branco, nulo);
}

function nomeOuNumero(cargoId, numero) {
  return candidatos[cargoId]?.[numero] ?? `Candidato ${numero}`;
}
function nomePartidoOuNumero(cargoId, numero) {
  return candidatos[cargoId]?.[`p${numero}`] ?? `Partido ${numero}`;
}

function gerarRelatorioHtml({ secao, nomeLocal, zona, aptos, comparecimento, faltosos, cargos, qrDataUrls }) {
  const dataPleito = '04/10/2026';
  const blocoCargo = (cargo, resumo) => {
    const linhasCandidatos = Object.entries(resumo.votos)
      .map(([n, v]) => `  ${nomeOuNumero(cargo.id, n).padEnd(28)} ${n.padStart(5)}  ${String(v).padStart(4)}`)
      .join('\n');
    const linhasLegenda = Object.entries(resumo.legenda)
      .filter(([, v]) => v > 0)
      .map(([n, v]) => `  Legenda: ${nomePartidoOuNumero(cargo.id, n).padEnd(20)} ${n.padStart(5)}  ${String(v).padStart(4)}`)
      .join('\n');
    return `----------${cargo.nome.toUpperCase()}----------
${linhasCandidatos || '  Não há votos nominais'}
${linhasLegenda}
  Brancos${' '.repeat(34)}${String(resumo.branco).padStart(4)}
  Nulos${' '.repeat(36)}${String(resumo.nulo).padStart(4)}
  Total Apurado${' '.repeat(28)}${String(resumo.total).padStart(4)}
`;
  };

  const texto = `Justiça Eleitoral
Boletim de Urna — SIMULADO (gerado pra teste, não é um boletim real)

Eleições Gerais 2026 — 1º Turno (${dataPleito})
Município: PESQUEIRA (PE)          Zona: ${zona}   Seção: ${secao}
Local de votação: ${nomeLocal}

Eleitores aptos: ${aptos}    Comparecimento: ${comparecimento}    Faltosos: ${faltosos}

${cargos.map(({ cargo, resumo }) => blocoCargo(cargo, resumo)).join('\n')}`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><style>
  body { background:#fff; margin:0; padding:32px; font-family: 'Courier New', monospace; font-size:14px; color:#111; white-space:pre; }
  .selo { background:#ffe0e8; color:#b00035; display:inline-block; padding:4px 10px; border-radius:6px; font-weight:bold; margin-bottom:12px; white-space:normal; }
  .qrs { display:flex; flex-wrap:wrap; gap:16px; margin-top:24px; white-space:normal; }
  .qrs figure { margin:0; text-align:center; font-size:12px; }
  /* Tamanho nativo (500x500, igual ao gerado), de propósito — sem CSS width/height pra
     redimensionar. Deixar o navegador reamostrar a imagem (mesmo com "pixelated") borra os módulos
     de QR Codes mais densos (boletins com mais candidatos) o bastante pra ficarem ilegíveis depois
     de printar a tela. Veja CLAUDE.md > "Gerador de boletins de teste". */
  .qrs img { image-rendering:pixelated; }
</style></head>
<body>
<div class="selo">⚠ BOLETIM SIMULADO — gerado só pra teste, não é uma urna real (FASE:S)</div>
${texto}
<div class="qrs">
${qrDataUrls.map((url, i) => `  <figure><img src="${url}"><figcaption>QR ${i + 1} de ${qrDataUrls.length}</figcaption></figure>`).join('\n')}
</div>
</body></html>`;
}

async function gerarUrna(secaoInfo, zona, pastaBase, numPartesQR) {
  const aptos = secaoInfo.aptos;
  const comparecimento = Math.round(aptos * (0.4 + Math.random() * 0.4));
  const faltosos = aptos - comparecimento;
  const idue = String(sorteioInt(10000000, 99999999));

  const partesConteudo = [];
  const cargosGerados = [];
  for (const cargo of CARGOS) {
    const { texto, resumo } = gerarCargo(cargo, aptos);
    partesConteudo.push(texto);
    cargosGerados.push({ cargo, resumo });
  }

  const cabecalho = `ORIG:VOTA FASE:S PROC:123 PLEI:456 DTPL:20261004 TURN:1 UNFE:PE MUNI:25178 ZONA:${zona} SECA:${secaoInfo.secao} IDUE:${idue} APTO:${aptos} COMP:${comparecimento} FALT:${faltosos}`;
  const conteudo = `${cabecalho} ${partesConteudo.join(' ')}`;

  const textosQR = montarPartesQR(conteudo, numPartesQR);

  const pasta = path.join(pastaBase, String(secaoInfo.secao));
  fs.mkdirSync(pasta, { recursive: true });

  const qrDataUrls = [];
  for (let i = 0; i < textosQR.length; i++) {
    const arquivo = path.join(pasta, `qr-${i + 1}-de-${textosQR.length}.png`);
    await QRCode.toFile(arquivo, textosQR[i], { errorCorrectionLevel: 'M', margin: 2, width: 500 });
    // Precisa ser denso o bastante pra continuar escaneável depois de printar a tela ou fotografar
    // (um QR Code com muito conteúdo — proporcionais com vários candidatos — já nasce com mais
    // módulos; exibido pequeno demais, cada módulo vira menos de um pixel na captura e some).
    qrDataUrls.push(await QRCode.toDataURL(textosQR[i], { errorCorrectionLevel: 'M', margin: 2, width: 500 }));
  }

  const html = gerarRelatorioHtml({
    secao: secaoInfo.secao,
    nomeLocal: secaoInfo.nomeLocal,
    zona,
    aptos,
    comparecimento,
    faltosos,
    cargos: cargosGerados,
    qrDataUrls,
  });
  fs.writeFileSync(path.join(pasta, 'relatorio.html'), html);

  const gabarito = {
    zona,
    secao: secaoInfo.secao,
    turno: 1,
    fase: 'S',
    nomeLocal: secaoInfo.nomeLocal,
    aptos,
    comparecimento,
    faltosos,
    numeroQRCodes: textosQR.length,
    cargos: Object.fromEntries(cargosGerados.map(({ cargo, resumo }) => [cargo.id, resumo])),
    textosQR,
  };
  fs.writeFileSync(path.join(pasta, 'dados.json'), JSON.stringify(gabarito, null, 1));

  return { secao: secaoInfo.secao, pasta, numeroQRCodes: textosQR.length };
}

async function main() {
  const quantidade = Number(process.argv[2]) || 10;
  const zona = cidade.zonas[0];
  const secoesEscolhidas = sorteiaSemRepetir(zona.secoes, quantidade).sort((a, b) => a.secao - b.secao);

  const pastaBase = path.join(RAIZ, 'docs/boletins-teste');
  fs.rmSync(pastaBase, { recursive: true, force: true });
  fs.mkdirSync(pastaBase, { recursive: true });

  const resumo = [];
  for (let i = 0; i < secoesEscolhidas.length; i++) {
    // Varia 1, 2 e 3 QR Codes entre as urnas, pra testar tanto o caso de 1 QR só quanto o de
    // acumular várias leituras.
    const numPartesQR = [1, 1, 2, 2, 3][i % 5];
    const r = await gerarUrna(secoesEscolhidas[i], zona.zona, pastaBase, numPartesQR);
    resumo.push(r);
    console.log(`Seção ${r.secao}: ${r.numeroQRCodes} QR Code(s) → docs/boletins-teste/${r.secao}/`);
  }

  console.log(`\n${resumo.length} boletins de teste gerados em docs/boletins-teste/.`);
  console.log('Cada pasta tem: qr-N-de-M.png (pra escanear/fotografar), relatorio.html (texto + QR, pra tirar print ou fotografar a tela) e dados.json (gabarito).');
}

main();
