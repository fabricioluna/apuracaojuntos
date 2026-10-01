// Nome dos candidatos, só para exibição — o app funciona inteiramente por número (o QR Code não
// traz nomes). Lista importada de data/candidatos.json (ver CLAUDE.md > Candidatos). Quem não está
// na lista (candidato substituído depois da planilha, por exemplo) aparece como "Candidato NNNN" —
// o número continua sendo a fonte da verdade, o nome é só conveniência de exibição/busca.
import type { CargoId } from '../bu/types';

export type ListaCandidatos = Partial<Record<CargoId, Record<string, string>>>;

export function nomeCandidato(lista: ListaCandidatos, cargoId: CargoId, numero: string): string {
  return lista[cargoId]?.[numero] ?? `Candidato ${numero}`;
}

export function nomePartido(lista: ListaCandidatos, cargoId: CargoId, numeroPartido: string): string {
  return lista[cargoId]?.[`p${numeroPartido}`] ?? `Partido ${numeroPartido}`;
}

/** Mapa número -> nome dos candidatos de um cargo (sem os partidos), pra buscar/autocompletar na digitação. */
export function candidatosDoCargo(lista: ListaCandidatos, cargoId: CargoId): Record<string, string> {
  const cargo = lista[cargoId] ?? {};
  const saida: Record<string, string> = {};
  for (const [chave, nome] of Object.entries(cargo)) if (!chave.startsWith('p')) saida[chave] = nome;
  return saida;
}

/** Mapa número -> sigla dos partidos de um cargo proporcional, pra buscar/autocompletar na digitação. */
export function partidosDoCargo(lista: ListaCandidatos, cargoId: CargoId): Record<string, string> {
  const cargo = lista[cargoId] ?? {};
  const saida: Record<string, string> = {};
  for (const [chave, sigla] of Object.entries(cargo)) if (chave.startsWith('p')) saida[chave.slice(1)] = sigla;
  return saida;
}
