import { describe, expect, it } from 'vitest';
import { melhorasDeMelhorUrna, vencedorDaUrna } from '../../src/domain/lideranca';

describe('vencedorDaUrna', () => {
  it('devolve quem tem mais votos', () => {
    expect(vencedorDaUrna({ votos: { '10': 3, '20': 5, '30': 1 } })).toBe('20');
  });
  it('sem votos, devolve undefined', () => {
    expect(vencedorDaUrna({ votos: {} })).toBeUndefined();
  });
  it('empate: fica com o primeiro encontrado (estável, não aleatório)', () => {
    expect(vencedorDaUrna({ votos: { '10': 5, '20': 5 } })).toBe('10');
  });
});

describe('melhorasDeMelhorUrna', () => {
  it('sem melhor anterior, todo mundo que teve voto entra (0 votos não conta)', () => {
    const r = melhorasDeMelhorUrna({ votos: { '10': 3, '20': 0 } }, 9, 16, {});
    expect(r).toEqual({ '10': { votos: 3, zona: 9, secao: 16 } });
  });
  it('só substitui quem essa urna supera', () => {
    const atual = { '10': { votos: 5, zona: 1, secao: 1 }, '20': { votos: 2, zona: 1, secao: 1 } };
    const r = melhorasDeMelhorUrna({ votos: { '10': 3, '20': 4 } }, 9, 16, atual);
    expect(r).toEqual({ '20': { votos: 4, zona: 9, secao: 16 } }); // 10 não supera 5; 20 supera 2
  });
  it('empate com o melhor atual não substitui', () => {
    const atual = { '10': { votos: 5, zona: 1, secao: 1 } };
    expect(melhorasDeMelhorUrna({ votos: { '10': 5 } }, 9, 16, atual)).toEqual({});
  });
});
