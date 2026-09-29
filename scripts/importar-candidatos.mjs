// Gera data/candidatos.json a partir das planilhas de candidatos exportadas do portal de dados
// abertos do TSE (divulgacandcontas.tse.jus.br), uma por cargo majoritário/proporcional da UF.
//
// Uso: node scripts/importar-candidatos.mjs docs/CANDIDATOS-PE-*.xlsx
//
// Cada planilha tem as colunas "Nome Urna", "Coligação", "Totalização" e "Partido" (este último,
// apesar do nome, traz o NÚMERO do candidato, não o número do partido). O cargo de cada planilha é
// descoberto pela quantidade de dígitos do número do candidato (ver src/bu/cargos.ts):
//   2 dígitos = presidente/governador (majoritário)   4 dígitos = deputado federal (proporcional)
//   3 dígitos = senador (majoritário)                 5 dígitos = deputado estadual (proporcional)
// Presidente não tem planilha por UF (é nacional); a lista fica em PRESIDENTES abaixo, porque não
// veio de nenhum arquivo fornecido — conferida por pesquisa em setembro de 2026 (ver CLAUDE.md).
import fs from 'node:fs';
import XLSX from 'xlsx';

// TSE validou 12 candidaturas a presidente em 2026 (uma 13ª, Pablo Marçal/PRTB, foi indeferida).
// Fonte: notícias do TSE de setembro de 2026. Vale conferir a grafia do nome de urna antes de usar
// numa eleição de verdade.
const PRESIDENTES = {
  '13': 'LULA',
  '14': 'RENAN SANTOS',
  '16': 'HERTZ DIAS',
  '21': 'EDMILSON COSTA',
  '22': 'FLÁVIO BOLSONARO',
  '27': 'CLARIANA BARÃO',
  '29': 'RUI COSTA PIMENTA',
  '30': 'ZEMA',
  '35': 'WILSON GRASSI',
  '55': 'RONALDO CAIADO',
  '70': 'AUGUSTO CURY',
  '80': 'SAMARA MARTINS',
};

const CARGO_POR_DIGITOS = { 2: 'governador', 3: 'senador', 4: 'federal', 5: 'estadual' };
const PROPORCIONAIS = new Set(['federal', 'estadual']);

const arquivos = process.argv.slice(2);
if (!arquivos.length) {
  console.error('Uso: node scripts/importar-candidatos.mjs <planilha1.xlsx> [planilha2.xlsx ...]');
  process.exit(1);
}

const candidatos = { presidente: { ...PRESIDENTES } };
const contagem = { presidente: Object.keys(PRESIDENTES).length };

for (const caminho of arquivos) {
  const planilha = XLSX.readFile(caminho);
  const linhas = XLSX.utils.sheet_to_json(planilha.Sheets[planilha.SheetNames[0]], { header: 1 });
  const [cabecalho, ...dados] = linhas;
  const iNome = cabecalho.indexOf('Nome Urna');
  const iColigacao = cabecalho.indexOf('Coligação');
  const iStatus = cabecalho.indexOf('Totalização');
  const iNumero = cabecalho.indexOf('Partido'); // ver nota no topo do arquivo
  if (iNome < 0 || iNumero < 0) throw new Error(`${caminho}: não achei as colunas "Nome Urna"/"Partido". Cabeçalho: ${cabecalho}`);

  const statusPorNumero = {}; // pra decidir uma substituição (candidato trocado, mesmo número)
  let cargo;
  for (const linha of dados) {
    const numero = linha[iNumero];
    if (numero === undefined || numero === null || linha[iNome] === undefined) continue;
    const numeroTxt = String(numero);
    const cargoDaLinha = CARGO_POR_DIGITOS[numeroTxt.length];
    if (!cargoDaLinha) throw new Error(`${caminho}: número de candidato com formato inesperado (${numeroTxt}).`);
    if (cargo && cargo !== cargoDaLinha) throw new Error(`${caminho}: mistura números de cargos diferentes (${cargo} e ${cargoDaLinha}). Confira a planilha.`);
    cargo = cargoDaLinha;

    candidatos[cargo] ??= {};
    const statusAtual = String(linha[iStatus] ?? '');
    const jaTinha = candidatos[cargo][numeroTxt];
    if (jaTinha && jaTinha !== linha[iNome]) {
      // Duas pessoas com o mesmo número: provável substituição (uma delas "Inapto"). Fica a
      // "Concorrendo"; se as duas estiverem no mesmo estado, não dá pra decidir sozinho.
      const statusAnterior = statusPorNumero[numeroTxt];
      if (statusAtual === 'Concorrendo' && statusAnterior !== 'Concorrendo') {
        // troca para a candidatura ativa
      } else if (statusAnterior === 'Concorrendo' && statusAtual !== 'Concorrendo') {
        continue; // mantém a que já estava ativa
      } else {
        throw new Error(`${caminho}: número ${numeroTxt} tem "${jaTinha}" (${statusAnterior}) e "${linha[iNome]}" (${statusAtual}) — não dá pra saber qual manter.`);
      }
    }
    candidatos[cargo][numeroTxt] = linha[iNome];
    statusPorNumero[numeroTxt] = statusAtual;

    // Nos cargos proporcionais, extrai "NN-SIGLA" da coligação para os nomes de partido (usados na
    // barra "Votos de legenda" do painel). Uma coligação sem parênteses é um partido isolado: o
    // próprio texto já é a sigla, e o número do partido são os dois primeiros dígitos do candidato.
    if (PROPORCIONAIS.has(cargo)) {
      const coligacao = String(linha[iColigacao] ?? '').trim();
      const chave = num => `p${num}`;
      if (coligacao.includes('(')) {
        for (const m of coligacao.matchAll(/(\d{2})-([^/)]+)/g)) {
          candidatos[cargo][chave(m[1])] = m[2].trim();
        }
      } else if (coligacao) {
        candidatos[cargo][chave(numeroTxt.slice(0, 2))] = coligacao;
      }
    }
  }
  contagem[cargo] = (contagem[cargo] ?? 0) + dados.length;
  console.log(`${caminho}: ${dados.length} linhas → ${cargo}`);
}

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/candidatos.json', JSON.stringify(candidatos, null, 1) + '\n');
console.log('data/candidatos.json gravado.');
for (const [cargo, dados] of Object.entries(candidatos)) {
  const nums = Object.keys(dados).filter(k => !k.startsWith('p'));
  const partidos = Object.keys(dados).filter(k => k.startsWith('p'));
  console.log(`  ${cargo}: ${nums.length} candidatos${partidos.length ? `, ${partidos.length} partidos` : ''}`);
}
