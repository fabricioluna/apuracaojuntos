// Cálculo de "em quantas urnas lidera" e "melhor urna" para o painel público — funções puras,
// sem Firebase, para poderem ser lidas (t.get) e aplicadas fora de ordem dentro de uma transação
// (o Firestore exige todas as leituras antes de qualquer escrita).
import type { CargoApurado } from '../bu/types';

export interface MelhorUrna {
  votos: number;
  zona: number;
  secao: number;
}

/** Número do candidato com mais votos nesta urna, para este cargo (undefined se ninguém votou). */
export function vencedorDaUrna(cargo: Pick<CargoApurado, 'votos'>): string | undefined {
  let melhor: [string, number] | undefined;
  for (const [numero, votos] of Object.entries(cargo.votos)) {
    if (!melhor || votos > melhor[1]) melhor = [numero, votos];
  }
  return melhor?.[0];
}

/**
 * Candidatos cujo resultado nesta urna supera o melhor já registrado. "Melhor urna" só evolui
 * para frente: numa correção que reduz os votos de uma seção que era a melhor de alguém, o valor
 * antigo fica registrado até que outra urna o supere (ver CLAUDE.md — limitação aceita no MVP).
 */
export function melhorasDeMelhorUrna(
  cargo: Pick<CargoApurado, 'votos'>,
  zona: number,
  secao: number,
  melhorAtual: Record<string, MelhorUrna>,
): Record<string, MelhorUrna> {
  const melhorias: Record<string, MelhorUrna> = {};
  for (const [numero, votos] of Object.entries(cargo.votos)) {
    // O BU real só lista quem recebeu voto; um 0 aqui não é um resultado a destacar.
    if (votos > 0 && votos > (melhorAtual[numero]?.votos ?? -1)) melhorias[numero] = { votos, zona, secao };
  }
  return melhorias;
}
