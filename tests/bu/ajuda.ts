import fs from 'node:fs';
import path from 'node:path';
import { criarProvedorChaves } from '../../src/bu';
import type { BoletimDecodificado } from '../../src/bu';
import { decodificarBU } from '../../src/bu';

const pasta = path.join(__dirname, '..', 'fixtures');

/** QR Codes dos boletins de exemplo do TSE de 2018 (formato VRQR 1.5), extraídos dos PDFs. */
export const exemplos2018: Record<string, string[]> = JSON.parse(fs.readFileSync(path.join(pasta, 'bu-2018.json'), 'utf8'));

/** Exemplo pequeno do manual do TSE de 2026 (formato VRQR 6.0). */
export const exemplos2026: Record<string, string[]> = JSON.parse(fs.readFileSync(path.join(pasta, 'bu-2026.json'), 'utf8'));

/** Chaves públicas simuladas de 2018, conferidas contra a lista de hashes do TSE. */
export const chaves2018 = criarProvedorChaves(
  { 'sacqrcode.pub': new Uint8Array(fs.readFileSync(path.join(pasta, 'chaves', 'sacqrcode.pub'))) },
  fs.readFileSync(path.join(pasta, 'chaves', 'chavesqrcodesimulado.sha512'), 'utf8'),
);

/** Decodifica e exige sucesso. */
export function decodificarOk(partes: string[], chaves = chaves2018): BoletimDecodificado {
  const r = decodificarBU(partes, { chaves });
  if (!r.ok) throw new Error('Esperava sucesso, mas: ' + r.erros.map(e => e.mensagem).join(' | '));
  return r.boletim;
}
