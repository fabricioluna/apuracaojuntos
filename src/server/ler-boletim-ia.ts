// Leitura da foto do boletim por IA (Gemini), só quando o QR Code não dá certo. Ver CLAUDE.md >
// "Leitura da foto por IA" pra análise completa (por que IA em vez de OCR, e por que o resultado
// nunca grava direto). A chave fica só em GEMINI_API_KEY (variável de ambiente do servidor).
import { CARGOS_ORDEM, NOME_CARGO, TIPO_CARGO } from '../bu/cargos';
import type { CargoId } from '../bu/types';

export class ErroLeituraIA extends Error {}

// "-latest" é um apelido que o Google aponta sozinho pro modelo flash atual — evita que o nome
// fique obsoleto e comece a dar 404 (já aconteceu uma vez com um nome fixo, ao testar).
const MODELO = 'gemini-flash-latest';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const PROMPT = `Você está lendo a foto de um Boletim de Urna (BU) oficial do TSE (Brasil) — o relatório impresso pela urna eletrônica ao final da votação numa seção eleitoral.

O boletim tem uma seção por cargo: Presidente, Governador, Senador, Deputado Federal, Deputado Estadual. Cada seção lista:
- Candidatos com voto: o número do candidato (2 a 5 dígitos, dependendo do cargo) e a quantidade de votos.
- Só nos cargos proporcionais (Deputado Federal e Deputado Estadual): "Legenda" / votos de partido — número do partido (2 dígitos) e a quantidade.
- "Brancos" e "Nulos": a quantidade de cada um.

Leia os valores exatamente como estão impressos. Se um número ou uma quantidade estiver ilegível, borrado ou você não tiver certeza, NÃO invente — omita esse item (é muito melhor faltar um dado do que inventar um valor errado, porque isto conta votos de verdade).

Devolva SÓ um JSON (sem markdown, sem comentário, sem texto antes ou depois), neste formato exato:
{
  "cargos": {
    "presidente": { "votos": { "<numero>": <votos> }, "branco": <n>, "nulo": <n> },
    "governador": { "votos": { "<numero>": <votos> }, "branco": <n>, "nulo": <n> },
    "senador": { "votos": { "<numero>": <votos> }, "branco": <n>, "nulo": <n> },
    "federal": { "votos": { "<numero>": <votos> }, "legenda": { "<numero>": <votos> }, "branco": <n>, "nulo": <n> },
    "estadual": { "votos": { "<numero>": <votos> }, "legenda": { "<numero>": <votos> }, "branco": <n>, "nulo": <n> }
  }
}

Inclua dentro de "cargos" só os cargos que você realmente consegue ver nessa foto. Dentro de cada cargo, omita "branco"/"nulo" se não tiver certeza do valor (em vez de arriscar um número). "legenda" só existe em federal/estadual.`;

/** Mais solto que CargoDigitado (src/domain/validar-digitado.ts): aqui branco/nulo podem faltar —
 * "não consegui ler com confiança" é uma informação valiosa, não um zero disfarçado. */
export interface SugestaoCargo {
  votos: Record<string, number>;
  legenda?: Record<string, number>;
  branco?: number;
  nulo?: number;
}

export interface ResultadoLeituraIA {
  cargos: Partial<Record<CargoId, SugestaoCargo>>;
  avisos: string[];
}

export async function lerBoletimComIA(imagemBase64: string, mimeType: string): Promise<ResultadoLeituraIA> {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) throw new ErroLeituraIA('A leitura por IA não está configurada neste servidor (falta a variável GEMINI_API_KEY). Digite os valores olhando o boletim.');

  let resp: Response;
  try {
    resp = await fetch(`${URL_BASE}/${MODELO}:generateContent?key=${chave}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imagemBase64 } }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
  } catch {
    throw new ErroLeituraIA('Não consegui falar com o serviço de leitura por IA agora. Tente de novo ou digite os valores.');
  }

  if (!resp.ok) {
    const corpo = await resp.text().catch(() => '');
    throw new ErroLeituraIA(`O serviço de leitura por IA recusou a foto (código ${resp.status}). ${corpo.slice(0, 200)}`);
  }

  const dados: unknown = await resp.json();
  const texto = extrairTexto(dados);
  if (!texto) throw new ErroLeituraIA('A IA não devolveu nenhum resultado pra essa foto. Tente tirar de novo, com mais luz e menos inclinação.');

  return interpretarResposta(texto);
}

function extrairTexto(dados: unknown): string | undefined {
  const candidatos = (dados as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidatos)) return undefined;
  const partes = (candidatos[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(partes)) return undefined;
  const texto = (partes[0] as { text?: unknown })?.text;
  return typeof texto === 'string' ? texto : undefined;
}

/** Separado de lerBoletimComIA pra poder testar a interpretação sem chamar a API de verdade. */
export function interpretarResposta(texto: string): ResultadoLeituraIA {
  const limpo = texto
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '');

  let json: unknown;
  try {
    json = JSON.parse(limpo);
  } catch {
    throw new ErroLeituraIA('A IA devolveu um resultado que não consegui entender. Tente de novo ou digite os valores.');
  }

  const bruto = (json as { cargos?: unknown })?.cargos;
  if (!bruto || typeof bruto !== 'object') throw new ErroLeituraIA('A IA não encontrou nenhum cargo legível nessa foto.');

  const cargos: Partial<Record<CargoId, SugestaoCargo>> = {};
  const avisos: string[] = [];

  for (const cargoId of CARGOS_ORDEM) {
    const c = (bruto as Record<string, unknown>)[cargoId] as { votos?: unknown; legenda?: unknown; branco?: unknown; nulo?: unknown } | undefined;
    if (!c || typeof c !== 'object') continue;

    const votos = numerosValidos(c.votos);
    const legenda = TIPO_CARGO[cargoId] === 'proporcional' ? numerosValidos(c.legenda) : undefined;
    const branco = numeroValido(c.branco);
    const nulo = numeroValido(c.nulo);

    if (Object.keys(votos).length === 0 && branco === undefined && nulo === undefined && (!legenda || Object.keys(legenda).length === 0)) continue;

    cargos[cargoId] = { votos, ...(legenda && Object.keys(legenda).length ? { legenda } : {}), ...(branco !== undefined ? { branco } : {}), ...(nulo !== undefined ? { nulo } : {}) };
    if (branco === undefined || nulo === undefined) {
      avisos.push(`${NOME_CARGO[cargoId]}: não consegui ler brancos e/ou nulos com confiança — confira esses campos (ficam em branco, marcados pra você conferir).`);
    }
  }

  if (Object.keys(cargos).length === 0) {
    throw new ErroLeituraIA('Não consegui ler nenhum valor com confiança nessa foto. Tente de novo (mais luz, menos inclinação) ou digite os valores olhando o papel.');
  }

  return { cargos, avisos };
}

function numeroValido(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 ? v : undefined;
}

function numerosValidos(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object') return {};
  const saida: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(v as Record<string, unknown>)) {
    const n = numeroValido(valor);
    if (/^\d+$/.test(chave) && n !== undefined) saida[chave] = n;
  }
  return saida;
}
