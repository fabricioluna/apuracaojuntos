// Gera uma planilha Excel pra apuração manual (plano B, se o app ficar fora do ar no dia da
// eleição) — pedido da responsável pelo projeto. Uma aba por cargo, uma linha por seção (já
// ordenada pelo número da seção), uma coluna por candidato da lista curada (src/domain/
// acompanhados.ts — só os favoritos, não a lista oficial inteira), ordenadas pelo número do
// candidato (como é impresso no boletim). A planilha é só o molde: fica em branco, pra alguém
// preencher à mão o que ler de cada boletim impresso. As linhas de TOTAL e a coluna "Total da
// seção" têm fórmulas de verdade (SUM), que o Excel calcula sozinho ao abrir.
//
// Usa exceljs (não a biblioteca "xlsx" dos outros scripts): é a que sustenta cor/estilo de verdade
// no arquivo — testei a "xlsx" antes e ela simplesmente ignora qualquer estilo gravado (é uma
// limitação da versão gratuita/community, não bug nosso). Ver CLAUDE.md.
//
// Uso: node scripts/gerar-planilha-plano-b.mjs
// Saída: docs/plano-b-apuracao.xlsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const candidatos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/candidatos.json'), 'utf8'));
const cidade = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/cidade/pesqueira.json'), 'utf8'));

const CARGOS = [
  { id: 'presidente', nome: 'Presidente' },
  { id: 'governador', nome: 'Governador' },
  { id: 'senador', nome: 'Senador' },
  { id: 'federal', nome: 'Deputado Federal' },
  { id: 'estadual', nome: 'Deputado Estadual' },
];

// Mesma lista de src/domain/acompanhados.ts — duplicada aqui de propósito (script Node avulso, sem
// compilar TypeScript só por isso). Se a lista de favoritos mudar lá, repetir aqui e regerar.
const ACOMPANHADOS = {
  presidente: [{ numero: '13' }, { numero: '22' }],
  governador: [{ numero: '50' }, { numero: '40' }, { numero: '55', destaque: true }],
  senador: [{ numero: '111' }, { numero: '130', destaque: true }, { numero: '123' }, { numero: '222' }, { numero: '555', destaque: true }],
  federal: [{ numero: '2222' }, { numero: '1314' }, { numero: '4004' }, { numero: '2256' }, { numero: '1111' }, { numero: '2000' }, { numero: '1010', destaque: true }],
  estadual: [
    { numero: '22222' },
    { numero: '40400' },
    { numero: '11555' },
    { numero: '13123' },
    { numero: '40444', destaque: true },
    { numero: '10000' },
    { numero: '20120', destaque: true },
    { numero: '20123' },
    { numero: '40123' },
    { numero: '40555' },
  ],
};

// Cores da marca (ver CLAUDE.md > Visual). ARGB (exceljs exige o par alfa "FF" na frente).
const ROXO_PROFUNDO = 'FF4C0166';
const ROXO = 'FF7602BD';
const VERDE = 'FF00FF05';
const FUNDO_CLARO = 'FFF3EAFB';
const BRANCO = 'FFFFFFFF';
const LINHA_PAR = 'FFF8F3FC'; // listrado bem sutil, só pra guiar o olho nas 180 linhas

function nomeCandidato(cargoId, numero) {
  return candidatos[cargoId]?.[numero] ?? `Candidato ${numero}`;
}

function letraColuna(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const bordaFina = { style: 'thin', color: { argb: 'FFDDD3E8' } };
const todasBordas = { top: bordaFina, left: bordaFina, bottom: bordaFina, right: bordaFina };

const zona = cidade.zonas[0];
const secoes = [...zona.secoes].sort((a, b) => a.secao - b.secao);

const livro = new ExcelJS.Workbook();
livro.creator = 'Construindo Juntos';
livro.created = new Date();

// --- Capa ---
const capa = livro.addWorksheet('Leia primeiro', { properties: { tabColor: { argb: ROXO } } });
capa.columns = [{ width: 100 }];
const linhasCapa = [
  ['Plano B — apuração manual (Construindo Juntos)', true, 16, ROXO_PROFUNDO],
  [null],
  ['Pra usar se o app ficar fora do ar no dia da eleição.'],
  ['Uma aba por cargo. Cada linha é uma seção; cada coluna, um candidato da lista de favoritos — ordenados pelo número, igual sai impresso no boletim.'],
  ['Preencha o número de votos de cada candidato em cada seção, olhando o boletim impresso.'],
  ['A linha "TOTAL" (logo abaixo do cabeçalho, sempre visível) soma sozinha — não precisa calcular na mão.'],
  ['A coluna "Total da seção" soma os favoritos daquela seção, só pra conferir se bateu com o que o boletim mostra pra esses candidatos.'],
  ['Candidatos com fundo verde são os marcados como "destaque" no painel Favoritos do site.'],
  [null],
  [`Pesqueira/PE, Zona ${zona.zona}, ${secoes.length} seções.`],
  [`Gerado em ${new Date().toLocaleDateString('pt-BR')}.`],
];
for (const [texto, titulo, tamanho, cor] of linhasCapa) {
  const linha = capa.addRow([texto ?? '']);
  const cel = linha.getCell(1);
  cel.alignment = { wrapText: true, vertical: 'top' };
  if (titulo) cel.font = { bold: true, size: tamanho, color: { argb: cor } };
}
capa.getRow(1).height = 26;

for (const cargo of CARGOS) {
  const favoritos = [...(ACOMPANHADOS[cargo.id] ?? [])].sort((a, b) => Number(a.numero) - Number(b.numero));
  if (favoritos.length === 0) continue;

  const aba = livro.addWorksheet(cargo.nome.slice(0, 31), {
    properties: { tabColor: { argb: ROXO } },
    views: [{ state: 'frozen', xSplit: 3, ySplit: 2, showGridLines: false }],
  });

  const PRIMEIRA_LINHA_DADOS = 3; // 1=cabeçalho, 2=TOTAL, 3+=seções
  const ultimaLinhaDados = PRIMEIRA_LINHA_DADOS + secoes.length - 1;
  const primeiraColCandidato = 4; // A=Zona, B=Seção, C=Local — candidatos a partir de D
  const colTotalSecao = primeiraColCandidato + favoritos.length;

  aba.columns = [
    { header: 'Zona', width: 7 },
    { header: 'Seção', width: 9 },
    { header: 'Local de votação', width: 32 },
    ...favoritos.map(c => ({ header: `${c.numero} — ${nomeCandidato(cargo.id, c.numero)}`, width: 22 })),
    { header: 'Total da seção', width: 15 },
  ];

  // --- Linha 1: cabeçalho ---
  const cabecalho = aba.getRow(1);
  cabecalho.height = 42;
  cabecalho.eachCell(cell => {
    cell.font = { bold: true, color: { argb: BRANCO }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO_PROFUNDO } };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
  favoritos.forEach((c, i) => {
    if (!c.destaque) return;
    const cel = cabecalho.getCell(primeiraColCandidato + i);
    cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    cel.font = { bold: true, color: { argb: ROXO_PROFUNDO }, size: 11 };
  });

  // --- Linha 2: TOTAL (fórmulas somando cada coluna nas 180 linhas de seção) ---
  const linhaTotal = aba.addRow(['', '', 'TOTAL']);
  linhaTotal.height = 22;
  favoritos.forEach((_c, i) => {
    const col = letraColuna(primeiraColCandidato + i);
    linhaTotal.getCell(primeiraColCandidato + i).value = { formula: `SUM(${col}${PRIMEIRA_LINHA_DADOS}:${col}${ultimaLinhaDados})` };
  });
  const colTotalLetra = letraColuna(colTotalSecao);
  linhaTotal.getCell(colTotalSecao).value = { formula: `SUM(${colTotalLetra}${PRIMEIRA_LINHA_DADOS}:${colTotalLetra}${ultimaLinhaDados})` };
  linhaTotal.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true, color: { argb: ROXO_PROFUNDO } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FUNDO_CLARO } };
    cell.numFmt = '#,##0';
    cell.border = { ...todasBordas, bottom: { style: 'medium', color: { argb: ROXO } } };
  });
  linhaTotal.getCell(3).numFmt = '@'; // "TOTAL" é texto, não número

  // --- Linhas de seção ---
  const colIniLetra = letraColuna(primeiraColCandidato);
  const colFimLetra = letraColuna(primeiraColCandidato + favoritos.length - 1);
  secoes.forEach((s, i) => {
    const linha = aba.addRow([zona.zona, s.secao, s.nomeLocal ?? '']);
    const numLinha = PRIMEIRA_LINHA_DADOS + i;
    linha.getCell(colTotalSecao).value = { formula: `SUM(${colIniLetra}${numLinha}:${colFimLetra}${numLinha})` };
    const corFundo = i % 2 === 1 ? LINHA_PAR : BRANCO;
    linha.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = todasBordas;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundo } };
      if (colNumber === 1 || colNumber === 2) cell.alignment = { horizontal: 'center' };
      if (colNumber >= primeiraColCandidato) cell.numFmt = '#,##0';
    });
    linha.getCell(colTotalSecao).font = { italic: true, color: { argb: ROXO_PROFUNDO } };
  });
  for (let c = primeiraColCandidato; c < colTotalSecao; c++) {
    aba.getCell(1, c); // garante que a coluna existe antes do autofilter abaixo
  }
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colTotalSecao } };
}

const saida = path.join(RAIZ, 'docs/plano-b-apuracao.xlsx');
await livro.xlsx.writeFile(saida);
console.log('Planilha gerada em', saida);
console.log(`${secoes.length} seções, ${CARGOS.length} cargos.`);
