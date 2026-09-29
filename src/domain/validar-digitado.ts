import { CARGO_CODIGO, NOME_CARGO, TIPO_CARGO } from '../bu/cargos';
import type { CargoId } from '../bu/types';
import type { CargoEntrada } from './types';

/**
 * O que o fiscal digita para um cargo, olhando o papel. Mesmas regras de soma do decodificador
 * (candidatos + legenda + brancos + nulos = total).
 *
 * Importante: no boletim real, os QR Codes não são um por cargo (são pedaços de texto em sequência).
 * Se um QR Code está ilegível, normalmente não dá para aproveitar parte da leitura: o fiscal digita
 * o boletim inteiro. Por isso aqui não existe mistura de um cargo por QR Code e outro digitado.
 */
export interface CargoDigitado {
  votos: Record<string, number>;
  legenda?: Record<string, number>;
  branco: number;
  nulo: number;
  total: number;
}

const soma = (r: Record<string, number> | undefined) => Object.values(r ?? {}).reduce((a, b) => a + b, 0);

export function validarCargosDigitados(
  digitado: Partial<Record<CargoId, CargoDigitado>>,
  exigidos: CargoId[],
): { ok: true; cargos: Partial<Record<CargoId, CargoEntrada>> } | { ok: false; mensagens: string[] } {
  const mensagens: string[] = [];
  const cargos: Partial<Record<CargoId, CargoEntrada>> = {};

  for (const id of exigidos) {
    const d = digitado[id];
    if (!d) { mensagens.push(`Falta digitar ${NOME_CARGO[id]}.`); continue; }
    if (TIPO_CARGO[id] === 'majoritario' && d.legenda && Object.keys(d.legenda).length) {
      mensagens.push(`${NOME_CARGO[id]} não tem votos de legenda.`);
      continue;
    }
    const valores = [...Object.values(d.votos), ...Object.values(d.legenda ?? {}), d.branco, d.nulo, d.total];
    if (valores.length === 0 || valores.some(v => !Number.isInteger(v) || v < 0)) {
      mensagens.push(`${NOME_CARGO[id]}: há valores vazios, negativos ou fracionados.`);
      continue;
    }
    const somaVotos = soma(d.votos), somaLegenda = soma(d.legenda);
    if (somaVotos + somaLegenda + d.branco + d.nulo !== d.total) {
      mensagens.push(`${NOME_CARGO[id]}: a soma dos votos (${somaVotos + somaLegenda + d.branco + d.nulo}) não bate com o total digitado (${d.total}).`);
      continue;
    }
    cargos[id] = {
      codigo: CARGO_CODIGO[id],
      id,
      tipo: TIPO_CARGO[id],
      votos: d.votos,
      legenda: d.legenda ?? {},
      branco: d.branco,
      nulo: d.nulo,
      total: d.total,
      nominais: somaVotos,
      legendaTotal: somaLegenda,
      aptos: 0,
      origem: 'digitado',
    };
  }

  for (const id of Object.keys(digitado) as CargoId[]) {
    if (!exigidos.includes(id)) mensagens.push(`${NOME_CARGO[id]} não é apurado neste turno.`);
  }

  return mensagens.length ? { ok: false, mensagens } : { ok: true, cargos };
}
