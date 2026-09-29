// Confere a integridade de data/candidatos.json (gerado por scripts/importar-candidatos.mjs).
// Não testa o script em si (que depende das planilhas do TSE, fora do repositório — ver
// CLAUDE.md), mas garante que o arquivo gravado continua consistente com as regras do app.
import { describe, expect, it } from 'vitest';
import { CARGOS_ORDEM } from '../../src/bu/cargos';
import candidatos from '../../data/candidatos.json';

const DIGITOS_POR_CARGO: Record<string, number> = { presidente: 2, governador: 2, senador: 3, federal: 4, estadual: 5 };

describe('data/candidatos.json', () => {
  it('tem os cinco cargos', () => {
    for (const id of CARGOS_ORDEM) expect(candidatos).toHaveProperty(id);
  });

  it('presidente tem exatamente os 12 candidatos validados pelo TSE', () => {
    const numeros = Object.keys(candidatos.presidente);
    expect(numeros).toHaveLength(12);
  });

  it('cada número de candidato tem a quantidade de dígitos certa para o cargo', () => {
    for (const id of CARGOS_ORDEM) {
      const cargo = candidatos[id as keyof typeof candidatos] as Record<string, string>;
      for (const chave of Object.keys(cargo)) {
        if (chave.startsWith('p')) continue; // nome de partido, não de candidato
        expect(chave, `${id}: ${chave}`).toMatch(new RegExp(`^\\d{${DIGITOS_POR_CARGO[id]}}$`));
      }
    }
  });

  it('só os cargos proporcionais (federal, estadual) têm nomes de partido', () => {
    for (const id of ['presidente', 'governador', 'senador']) {
      const cargo = candidatos[id as keyof typeof candidatos] as Record<string, string>;
      expect(Object.keys(cargo).some(k => k.startsWith('p'))).toBe(false);
    }
    expect(Object.keys(candidatos.federal).some(k => k.startsWith('p'))).toBe(true);
    expect(Object.keys(candidatos.estadual).some(k => k.startsWith('p'))).toBe(true);
  });

  it('nenhum nome vazio', () => {
    for (const id of CARGOS_ORDEM) {
      const cargo = candidatos[id as keyof typeof candidatos] as Record<string, string>;
      for (const [chave, nome] of Object.entries(cargo)) expect(nome.trim(), chave).not.toBe('');
    }
  });
});
