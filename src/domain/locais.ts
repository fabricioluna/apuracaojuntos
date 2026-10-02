// Agrupamento das seções por local de votação, para o painel público mostrar quais localidades
// ainda faltam (não só números de zona/seção). Um local (escola, colégio...) pode ter várias
// seções; só conta como concluído quando todas as suas seções têm boletim.
import type { ConfigCidade } from './types';

export interface LocalVotacao {
  nome: string;
  secoes: Array<{ zona: number; secao: number }>;
  apuradas: number;
  total: number;
}

/**
 * `secoesComBoletim` é o conjunto de chaves "zona-secao" que já têm boletim (apuradas ou com
 * divergência em análise — as duas contam, porque o boletim chegou; só "ainda não enviada" fica
 * de fora). Seções sem nome de local cadastrado (config antiga) viram "Zona Z, seção S", para não
 * sumirem da lista.
 */
export function locaisPorSituacao(config: ConfigCidade, secoesComBoletim: ReadonlySet<string>): LocalVotacao[] {
  const porNome = new Map<string, LocalVotacao>();
  for (const z of config.zonas) {
    for (const s of z.secoes) {
      const nome = s.nomeLocal ?? `Zona ${z.zona}, seção ${s.secao}`;
      const tem = secoesComBoletim.has(`${z.zona}-${s.secao}`);
      const atual = porNome.get(nome) ?? { nome, secoes: [], apuradas: 0, total: 0 };
      atual.secoes.push({ zona: z.zona, secao: s.secao });
      atual.total += 1;
      if (tem) atual.apuradas += 1;
      porNome.set(nome, atual);
    }
  }
  return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function locaisFaltando(locais: LocalVotacao[]): LocalVotacao[] {
  return locais.filter(l => l.apuradas < l.total);
}

export function locaisApurados(locais: LocalVotacao[]): LocalVotacao[] {
  return locais.filter(l => l.apuradas === l.total);
}
