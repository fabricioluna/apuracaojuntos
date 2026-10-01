import { describe, expect, it } from 'vitest';
import { candidatosDoCargo, nomeCandidato, nomePartido, partidosDoCargo } from '../../src/domain/candidatos';

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

const LISTA = { federal: { '1000': 'AUGUSTO COUTINHO', '1234': 'FULANO', p13: 'PT', p40: 'PSB' } };

describe('candidatosDoCargo', () => {
  it('devolve só os candidatos, sem os partidos', () => {
    expect(candidatosDoCargo(LISTA, 'federal')).toEqual({ '1000': 'AUGUSTO COUTINHO', '1234': 'FULANO' });
  });
  it('cargo sem lista devolve objeto vazio', () => {
    expect(candidatosDoCargo({}, 'presidente')).toEqual({});
  });
});

describe('partidosDoCargo', () => {
  it('devolve os partidos sem o prefixo "p", pelo número', () => {
    expect(partidosDoCargo(LISTA, 'federal')).toEqual({ '13': 'PT', '40': 'PSB' });
  });
  it('cargo sem lista devolve objeto vazio', () => {
    expect(partidosDoCargo({}, 'federal')).toEqual({});
  });
});
