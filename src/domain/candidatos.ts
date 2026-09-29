// Nome dos candidatos, só para exibição — o app funciona inteiramente por número (o QR Code não
// traz nomes). Lista oficial ainda não importada (ver CLAUDE.md > Candidatos); até lá, todo mundo
// aparece como "Candidato NNNN". `numero -> nome` por cargo.
import type { CargoId } from '../bu/types';

export type ListaCandidatos = Partial<Record<CargoId, Record<string, string>>>;

export function nomeCandidato(lista: ListaCandidatos, cargoId: CargoId, numero: string): string {
  return lista[cargoId]?.[numero] ?? `Candidato ${numero}`;
}

export function nomePartido(lista: ListaCandidatos, cargoId: CargoId, numeroPartido: string): string {
  return lista[cargoId]?.[`p${numeroPartido}`] ?? `Partido ${numeroPartido}`;
}
