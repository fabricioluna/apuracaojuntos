import { CARGO_CODIGO, NOME_CARGO, TIPO_CARGO } from '../bu/cargos';
import type { CargoId } from '../bu/types';
import type { CargoEntrada } from './types';

/**
 * O que o fiscal digita para um cargo, olhando o papel. O total não é digitado: é sempre a soma de
 * candidatos + legenda + brancos + nulos (decisão da responsável pelo projeto — menos um campo pra
 * preencher e pra bater errado). Campo em branco conta como zero (sinalizado na interface, não
 * aqui — ver src/ui/DigitarBoletim.tsx); só valor negativo ou fracionado é recusado.
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
    const valores = [...Object.values(d.votos), ...Object.values(d.legenda ?? {}), d.branco, d.nulo];
    if (valores.some(v => !Number.isInteger(v) || v < 0)) {
      mensagens.push(`${NOME_CARGO[id]}: há valores negativos ou fracionados.`);
      continue;
    }
    const somaVotos = soma(d.votos);
    const somaLegenda = soma(d.legenda);
    cargos[id] = {
      codigo: CARGO_CODIGO[id],
      id,
      tipo: TIPO_CARGO[id],
      votos: d.votos,
      legenda: d.legenda ?? {},
      branco: d.branco,
      nulo: d.nulo,
      total: somaVotos + somaLegenda + d.branco + d.nulo,
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
