import fs from 'node:fs';
import { expect, it } from 'vitest';
import { exemplos2018, decodificarOk } from './ajuda';

const nomes: Record<string, string> = { PRESIDENTE: 'presidente', GOVERNADOR: 'governador', SENADOR: 'senador', 'DEPUTADO FEDERAL': 'federal', 'DEPUTADO ESTADUAL': 'estadual' };

// Confere o que o decodificador leu do QR Code com o relatório impresso pela urna (.imgbu), uma fonte independente.
// Só roda quando os exemplos do TSE estão na pasta docs/ (não vão para o repositório).
const temExemplos = fs.existsSync('docs/tse-exemplos-boletim-urna-eleicoes-2018');

it.skipIf(!temExemplos)('bate com o relatório impresso (.imgbu) em todos os exemplos', () => {
  let conferidos = 0;
  for (const [base, partes] of Object.entries(exemplos2018)) {
    const arq = ['.imgbu', '.imgbusa'].map(e => `docs/tse-exemplos-boletim-urna-eleicoes-2018/${base}${e}`).find(f => fs.existsSync(f))!;
    const txt = fs.readFileSync(arq, 'latin1');
    const b = decodificarOk(partes);
    // divide o relatório por cargo
    const blocos = txt.split(/-{5,}\s*(PRESIDENTE|GOVERNADOR|SENADOR|DEPUTADO FEDERAL|DEPUTADO ESTADUAL)\s*-{5,}/);
    for (let i = 1; i < blocos.length; i += 2) {
      const id = nomes[blocos[i]!]!, corpo = blocos[i + 1]!;
      const n = (rot: string) => { const m = new RegExp(rot + '\\s+(\\d+)').exec(corpo); if (!m) throw new Error(base + ' ' + blocos[i] + ' sem ' + rot); return Number(m[1]); };
      const c = b.cargos[id as keyof typeof b.cargos]!;
      expect({ base, id, branco: c.branco, nulo: c.nulo, total: c.total, nominais: c.nominais }).toEqual({ base, id, branco: n('Brancos'), nulo: n('Nulos'), total: n('Total Apurado'), nominais: n('Total de votos Nominais') });
      if (id === 'federal' || id === 'estadual') expect(c.legendaTotal).toBe(n('Total de votos de Legenda'));
      // votos por candidato: linhas "  NOME   NUM  VOTOS"
      for (const m of corpo.matchAll(/^\s{2}\S.*?\s(\d{2,5})\s+(\d{4})\s*$/gm)) expect(c.votos[m[1]!], `${base} ${id} cand ${m[1]}`).toBe(Number(m[2]));
      conferidos++;
    }
  }
  expect(conferidos).toBe(30);
});
