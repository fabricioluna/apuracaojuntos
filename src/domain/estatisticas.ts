// Agregações puras para o painel do administrador, a partir da lista de boletins (já sem dados
// sensíveis de mais do que zona/seção/fiscal/hora — ver src/server/admin/listar-boletins.ts).

export interface BoletimParaEstatistica {
  fiscalNome: string;
  enviadoEm: number;
}

export interface FaixaEnvio {
  inicio: number;
  quantidade: number;
}

/** Quantidade de envios a cada `passoMs` (padrão 30 min), nas últimas 10 faixas com dado. */
export function enviosPorFaixa(boletins: BoletimParaEstatistica[], passoMs = 30 * 60_000): FaixaEnvio[] {
  if (boletins.length === 0) return [];
  const fim = Math.floor(Math.max(...boletins.map(b => b.enviadoEm)) / passoMs) * passoMs;
  const inicio = Math.max(Math.floor(Math.min(...boletins.map(b => b.enviadoEm)) / passoMs) * passoMs, fim - 9 * passoMs);
  const faixas: FaixaEnvio[] = [];
  for (let t = inicio; t <= fim; t += passoMs) {
    faixas.push({ inicio: t, quantidade: boletins.filter(b => b.enviadoEm >= t && b.enviadoEm < t + passoMs).length });
  }
  return faixas;
}

export interface EnvioPorFiscal {
  fiscal: string;
  quantidade: number;
  ultimoEnvio: number;
}

export function enviosPorFiscal(boletins: BoletimParaEstatistica[]): EnvioPorFiscal[] {
  const porFiscal = new Map<string, EnvioPorFiscal>();
  for (const b of boletins) {
    const atual = porFiscal.get(b.fiscalNome) ?? { fiscal: b.fiscalNome, quantidade: 0, ultimoEnvio: 0 };
    atual.quantidade += 1;
    atual.ultimoEnvio = Math.max(atual.ultimoEnvio, b.enviadoEm);
    porFiscal.set(b.fiscalNome, atual);
  }
  return [...porFiscal.values()].sort((a, b) => b.quantidade - a.quantidade);
}
