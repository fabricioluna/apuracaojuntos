// Confere que a lista curada (src/domain/acompanhados.ts) só usa números que existem de
// verdade na lista oficial (data/candidatos.json) — pra nunca mostrar um número errado por engano
// de digitação.
import { describe, expect, it } from 'vitest';
import { ACOMPANHADOS } from '../../src/domain/acompanhados';
import { CARGOS_ORDEM } from '../../src/bu/cargos';
import candidatos from '../../data/candidatos.json';

describe('ACOMPANHADOS', () => {
  it('todo número existe na lista oficial do cargo correspondente', () => {
    for (const cargoId of CARGOS_ORDEM) {
      const lista = ACOMPANHADOS[cargoId] ?? [];
      const oficial = candidatos[cargoId as keyof typeof candidatos] as Record<string, string>;
      for (const c of lista) {
        expect(oficial, `${cargoId} ${c.numero}`).toHaveProperty(c.numero);
      }
    }
  });

  it('nenhum número repetido dentro do mesmo cargo', () => {
    for (const cargoId of CARGOS_ORDEM) {
      const numeros = (ACOMPANHADOS[cargoId] ?? []).map(c => c.numero);
      expect(new Set(numeros).size).toBe(numeros.length);
    }
  });
});
