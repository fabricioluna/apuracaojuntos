// Gera uma planilha Excel pra apuração manual (plano B, se o app ficar fora do ar no dia da
// eleição) — pedido da responsável pelo projeto. Uma aba por cargo, uma linha por seção (já
// ordenada pelo número da seção), uma coluna por candidato da lista curada (src/domain/
// acompanhados.ts — só os favoritos, não a lista oficial inteira). A planilha é só o molde: fica
// em branco, pra alguém preencher à mão o que ler de cada boletim impresso. As linhas de TOTAL e
// "Total da seção" têm fórmulas de verdade (SUM), que o Excel calcula sozinho ao abrir — não são
// valores fixos, então continuam corretas conforme as células forem preenchidas.
//
// Uso: node scripts/gerar-planilha-plano-b.mjs
// Saída: docs/plano-b-apuracao.xlsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { utils as xlsxUtils, writeFile as xlsxWriteFile } from 'xlsx';

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

function nomeCandidato(cargoId, numero) {
  return candidatos[cargoId]?.[numero] ?? `Candidato ${numero}`;
}

const zona = cidade.zonas[0];
const secoes = [...zona.secoes].sort((a, b) => a.secao - b.secao);

const livro = xlsxUtils.book_new();

const capa = xlsxUtils.aoa_to_sheet([
  ['Plano B — apuração manual (Construindo Juntos)'],
  [],
  ['Pra usar se o app ficar fora do ar no dia da eleição.'],
  ['Uma aba por cargo. Cada linha é uma seção; cada coluna, um candidato da lista de favoritos.'],
  ['Preencha o número de votos de cada candidato em cada seção, olhando o boletim impresso.'],
  ['A linha "TOTAL" (logo abaixo do cabeçalho) soma sozinha — não precisa calcular na mão.'],
  ['A coluna "Total da seção" soma os favoritos daquela seção, só pra conferir se bateu com o que o boletim mostra pra esses candidatos.'],
  [],
  [`Pesqueira/PE, Zona ${zona.zona}, ${secoes.length} seções.`],
  [`Gerado em ${new Date().toLocaleDateString('pt-BR')}.`],
]);
capa['!cols'] = [{ wch: 90 }];
xlsxUtils.book_append_sheet(livro, capa, 'Leia primeiro');

for (const cargo of CARGOS) {
  const favoritos = ACOMPANHADOS[cargo.id] ?? [];
  if (favoritos.length === 0) continue;

  const PRIMEIRA_LINHA_DADOS = 3; // 1=cabeçalho, 2=TOTAL, 3+=seções
  const ultimaLinhaDados = PRIMEIRA_LINHA_DADOS + secoes.length - 1;
  const primeiraColCandidato = 3; // A=Zona, B=Seção, C=Local — candidatos a partir de D (índice 3)
  const colTotalSecao = primeiraColCandidato + favoritos.length;

  const cabecalho = [
    'Zona',
    'Seção',
    'Local de votação',
    ...favoritos.map(c => `${nomeCandidato(cargo.id, c.numero)} (${c.numero})`),
    'Total da seção (só favoritos)',
  ];

  const linhaTotal = [
    '',
    '',
    'TOTAL',
    ...favoritos.map((_, i) => {
      const col = xlsxUtils.encode_col(primeiraColCandidato + i);
      return { t: 'n', f: `SUM(${col}${PRIMEIRA_LINHA_DADOS}:${col}${ultimaLinhaDados})` };
    }),
    { t: 'n', f: `SUM(${xlsxUtils.encode_col(colTotalSecao)}${PRIMEIRA_LINHA_DADOS}:${xlsxUtils.encode_col(colTotalSecao)}${ultimaLinhaDados})` },
  ];

  const linhasSecoes = secoes.map((s, i) => {
    const linha = PRIMEIRA_LINHA_DADOS + i;
    const colIni = xlsxUtils.encode_col(primeiraColCandidato);
    const colFim = xlsxUtils.encode_col(primeiraColCandidato + favoritos.length - 1);
    return [zona.zona, s.secao, s.nomeLocal ?? '', ...favoritos.map(() => null), { t: 'n', f: `SUM(${colIni}${linha}:${colFim}${linha})` }];
  });

  const aba = xlsxUtils.aoa_to_sheet([cabecalho, linhaTotal, ...linhasSecoes]);
  aba['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 30 }, ...favoritos.map(() => ({ wch: 22 })), { wch: 14 }];
  xlsxUtils.book_append_sheet(livro, aba, cargo.nome.slice(0, 31));
}

const saida = path.join(RAIZ, 'docs/plano-b-apuracao.xlsx');
xlsxWriteFile(livro, saida);
console.log('Planilha gerada em', saida);
console.log(`${secoes.length} seções, ${CARGOS.length} cargos.`);
