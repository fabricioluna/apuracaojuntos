import { describe, expect, it } from 'vitest';
import { nomeCandidato, nomePartido } from '../../src/domain/candidatos';

describe('nomeCandidato', () => {
  it('mostra "Candidato NNNN" quando não está na lista', () => {
    expect(nomeCandidato({}, 'presidente', '71')).toBe('Candidato 71');
  });
  it('usa o nome quando está na lista', () => {
    expect(nomeCandidato({ presidente: { '71': 'Helena Duarte' } }, 'presidente', '71')).toBe('Helena Duarte');
  });
});

describe('nomePartido', () => {
  it('mostra "Partido NN" quando não está na lista', () => {
    expect(nomePartido({}, 'federal', '10')).toBe('Partido 10');
  });
});
