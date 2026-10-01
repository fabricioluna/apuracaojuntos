import { CARGO_CODIGO, CARGOS_ORDEM, TIPO_CARGO } from '../../bu/cargos';
import type { CargoId } from '../../bu/types';
import { chaveUrna } from '../../domain/comparar';
import type { CargoEntrada } from '../../domain/types';
import { gravarBoletim } from '../gravar-boletim';
import { CABECALHO_CSV } from './exportar-apuracao';

export class ErroImportarApuracao extends Error {}

export interface ResultadoImportacao {
  processados: number;
  novos: number;
  iguais: number;
  divergentes: number;
  erros: string[];
}

/** Parser de CSV simples (RFC4180: aspas duplas, "" escapando aspas dentro de um campo). Só precisa
 * lidar com o que o Excel/LibreOffice gravam de volta — não é um parser genérico pra qualquer CSV. */
function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else dentroAspas = false;
      } else campo += c;
    } else if (c === '"') dentroAspas = true;
    else if (c === ',') {
      linha.push(campo);
      campo = '';
    } else if (c === '\r') {
      /* ignorado: a quebra de linha de verdade é o \n que vem a seguir */
    } else if (c === '\n') {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter(l => l.length > 1 || l[0] !== '');
}

interface CargoMontado {
  votos: Record<string, number>;
  legenda: Record<string, number>;
  branco: number;
  nulo: number;
}

/**
 * Lê um CSV no formato de exportarApuracao e grava cada urna de volta, passando pela mesma
 * gravarBoletim de sempre — por isso ganha de graça a regra central (urna repetida vira divergência
 * se os números não baterem, "igual" se baterem) em vez de sobrescrever qualquer coisa às cegas.
 * A pessoa que importa fica registrada como fiscalId/fiscalNome de cada boletim importado (o nome
 * original de quem enviou, se existir no CSV, fica só como anotação no nome — não dá pra "ressuscitar"
 * a identidade de quem enviou de verdade).
 */
export async function importarApuracao(csvTexto: string, admin: { uid: string; nome: string }): Promise<ResultadoImportacao> {
  const linhas = parseCsv(csvTexto);
  const [cabecalho, ...dados] = linhas;
  if (!cabecalho || CABECALHO_CSV.some((c, i) => cabecalho[i] !== c)) {
    throw new ErroImportarApuracao('Cabeçalho do CSV não é o esperado. Use um arquivo exportado por este sistema (aba Ajustes > Exportar).');
  }

  const porUrna = new Map<string, { zona: number; secao: number; turno: 1 | 2; fiscalNome: string; cargos: Partial<Record<CargoId, CargoMontado>> }>();

  for (const linha of dados) {
    const [zonaTxt, secaoTxt, turnoTxt, cargoTxt, tipo, numero, votosTxt, fiscalNome] = linha;
    const zona = Number(zonaTxt);
    const secao = Number(secaoTxt);
    const turno = Number(turnoTxt);
    const votos = Number(votosTxt);
    if (!Number.isInteger(zona) || !Number.isInteger(secao) || (turno !== 1 && turno !== 2) || !Number.isInteger(votos)) continue;
    if (!CARGOS_ORDEM.includes(cargoTxt as CargoId)) continue;
    const cargoId = cargoTxt as CargoId;

    const chave = chaveUrna(zona, secao, turno);
    if (!porUrna.has(chave)) porUrna.set(chave, { zona, secao, turno, fiscalNome: fiscalNome || 'Desconhecido', cargos: {} });
    const urna = porUrna.get(chave)!;
    urna.cargos[cargoId] ??= { votos: {}, legenda: {}, branco: 0, nulo: 0 };
    const c = urna.cargos[cargoId]!;
    if (tipo === 'candidato' && numero) c.votos[numero] = votos;
    else if (tipo === 'legenda' && numero) c.legenda[numero] = votos;
    else if (tipo === 'branco') c.branco = votos;
    else if (tipo === 'nulo') c.nulo = votos;
  }

  let novos = 0;
  let iguais = 0;
  let divergentes = 0;
  const erros: string[] = [];

  for (const urna of porUrna.values()) {
    const cargos: Partial<Record<CargoId, CargoEntrada>> = {};
    for (const cargoId of CARGOS_ORDEM) {
      const c = urna.cargos[cargoId];
      if (!c) continue;
      const somaVotos = Object.values(c.votos).reduce((a, b) => a + b, 0);
      const somaLegenda = Object.values(c.legenda).reduce((a, b) => a + b, 0);
      cargos[cargoId] = {
        codigo: CARGO_CODIGO[cargoId],
        id: cargoId,
        tipo: TIPO_CARGO[cargoId],
        votos: c.votos,
        legenda: c.legenda,
        branco: c.branco,
        nulo: c.nulo,
        total: somaVotos + somaLegenda + c.branco + c.nulo,
        nominais: somaVotos,
        legendaTotal: somaLegenda,
        aptos: 0,
        origem: 'importado',
      };
    }
    try {
      const resultado = await gravarBoletim(
        { zona: urna.zona, secao: urna.secao, turno: urna.turno, cargos },
        { uid: admin.uid, nome: `${admin.nome} (importado de CSV; original: ${urna.fiscalNome})` },
      );
      if (resultado.status === 'novo') novos++;
      else if (resultado.status === 'igual') iguais++;
      else divergentes++;
    } catch (e) {
      erros.push(`Zona ${urna.zona}, seção ${urna.secao}: ${e instanceof Error ? e.message : 'erro desconhecido'}.`);
    }
  }

  return { processados: porUrna.size, novos, iguais, divergentes, erros };
}
