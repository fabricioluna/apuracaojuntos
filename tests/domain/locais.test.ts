import { describe, expect, it } from 'vitest';
import { locaisFaltando, locaisPorSituacao } from '../../src/domain/locais';
import type { ConfigCidade } from '../../src/domain/types';

const config: ConfigCidade = {
  uf: 'PE',
  municipio: 25178,
  nomeMunicipio: 'Pesqueira',
  turno: 1,
  zonas: [
    {
      zona: 55,
      secoes: [
        { secao: 32, aptos: 187, nomeLocal: 'Colégio Avançar' },
        { secao: 33, aptos: 186, nomeLocal: 'Colégio Avançar' },
        { secao: 250, aptos: 237, nomeLocal: 'Creche Mutuca' },
        { secao: 999, aptos: 100 }, // sem nomeLocal (config antiga)
      ],
    },
  ],
  cargosPorTurno: { 1: ['presidente'], 2: ['presidente'] },
};

describe('locaisPorSituacao', () => {
  it('agrupa seções do mesmo local e conta quantas têm boletim', () => {
    const r = locaisPorSituacao(config, new Set(['55-32']));
    const avancar = r.find(l => l.nome === 'Colégio Avançar')!;
    expect(avancar).toMatchObject({ apuradas: 1, total: 2 });
    expect(avancar.secoes).toEqual([{ zona: 55, secao: 32 }, { zona: 55, secao: 33 }]);
  });

  it('seção sem nomeLocal vira "Zona Z, seção S"', () => {
    const r = locaisPorSituacao(config, new Set());
    expect(r.some(l => l.nome === 'Zona 55, seção 999')).toBe(true);
  });

  it('divergência em análise conta como "tem boletim" (a chave só entra se o chamador incluir)', () => {
    // Quem monta o Set decide o que conta; aqui só confirmamos que qualquer chave presente conta.
    const r = locaisPorSituacao(config, new Set(['55-250']));
    expect(r.find(l => l.nome === 'Creche Mutuca')).toMatchObject({ apuradas: 1, total: 1 });
  });
});

describe('locaisFaltando', () => {
  it('só lista locais com pelo menos uma seção sem boletim', () => {
    const locais = locaisPorSituacao(config, new Set(['55-32', '55-33', '55-250']));
    const faltam = locaisFaltando(locais);
    expect(faltam.map(l => l.nome)).toEqual(['Zona 55, seção 999']);
  });

  it('local com todas as seções apuradas some da lista', () => {
    const locais = locaisPorSituacao(config, new Set(['55-32', '55-33', '55-250', '55-999']));
    expect(locaisFaltando(locais)).toEqual([]);
  });
});
