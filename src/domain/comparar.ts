import crypto from 'node:crypto';
import { CARGOS_ORDEM, NOME_CARGO } from '../bu/cargos';
import type { CargoApurado } from '../bu/types';
import type { BoletimGravado, DiferencaCampo } from './types';

export const chaveUrna = (zona: number, secao: number, turno: number): string => `${zona}-${secao}-${turno}`;

/**
 * Compara dois boletins campo a campo: cada candidato, cada legenda, brancos, nulos e total de cada
 * cargo. Ignora fiscal, horário, origem e assinatura, como pede a regra de divergência.
 */
export function compararBoletins(a: BoletimGravado, b: BoletimGravado): DiferencaCampo[] {
  const diffs: DiferencaCampo[] = [];
  for (const id of CARGOS_ORDEM) {
    const x = a.cargos[id], y = b.cargos[id];
    if (!x || !y) {
      if (!!x !== !!y) diffs.push({ cargo: id, campo: 'Cargo', atual: x ? 'lido' : 'ausente', novo: y ? 'lido' : 'ausente' });
      continue;
    }
    compararCargo(id, x, y, diffs);
  }
  return diffs;
}

function compararCargo(id: DiferencaCampo['cargo'], x: CargoApurado, y: CargoApurado, diffs: DiferencaCampo[]): void {
  const numeros = new Set([...Object.keys(x.votos), ...Object.keys(y.votos)]);
  for (const n of numeros) {
    const va = x.votos[n] ?? 0, vb = y.votos[n] ?? 0;
    if (va !== vb) diffs.push({ cargo: id, campo: `Candidato ${n}`, atual: va, novo: vb });
  }
  const partidos = new Set([...Object.keys(x.legenda), ...Object.keys(y.legenda)]);
  for (const p of partidos) {
    const va = x.legenda[p] ?? 0, vb = y.legenda[p] ?? 0;
    if (va !== vb) diffs.push({ cargo: id, campo: `Legenda do partido ${p}`, atual: va, novo: vb });
  }
  const campos: Array<[keyof CargoApurado, string]> = [
    ['branco', 'Brancos'],
    ['nulo', 'Nulos'],
    ['total', 'Total apurado'],
  ];
  for (const [k, rotulo] of campos) {
    if (x[k] !== y[k]) diffs.push({ cargo: id, campo: rotulo, atual: x[k] as number, novo: y[k] as number });
  }
}

/** Mensagem em português para um conjunto de diferenças, usada nos avisos ao fiscal e ao administrador. */
export function resumoDiferencas(diffs: DiferencaCampo[]): string {
  return diffs
    .slice(0, 6)
    .map(d => `${NOME_CARGO[d.cargo]}, ${d.campo}: era ${d.atual}, agora ${d.novo}`)
    .join('; ');
}

/**
 * Impressão digital de um boletim normalizado (mesmos campos que compararBoletins olha), para detectar
 * um envio divergente repetido sem duplicar o registro de divergência.
 */
export function impressaoDigital(b: BoletimGravado): string {
  const normal = CARGOS_ORDEM.map(id => {
    const c = b.cargos[id];
    if (!c) return `${id}:ausente`;
    const votos = Object.entries(c.votos).sort(([a], [b2]) => a.localeCompare(b2)).map(([n, v]) => `${n}=${v}`).join(',');
    const legenda = Object.entries(c.legenda).sort(([a], [b2]) => a.localeCompare(b2)).map(([n, v]) => `${n}=${v}`).join(',');
    return `${id}:${votos}|${legenda}|${c.branco}|${c.nulo}|${c.total}`;
  }).join(';');
  return crypto.createHash('sha256').update(normal).digest('hex').slice(0, 16);
}
