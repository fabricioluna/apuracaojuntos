// Tipos do decodificador do boletim de urna (BU). Sem dependência de interface.

/** Cargos que o app apura. Os códigos vêm do manual do TSE (seção "Código dos cargos"). */
export type CargoId = 'presidente' | 'governador' | 'senador' | 'federal' | 'estadual';

/** Versões do formato de representação (campo VRQR) aceitas pelo decodificador. */
export type VersaoFormato = '1.5' | '6.0';

export type Fase = 'O' | 'S' | 'T'; // oficial, simulado, treinamento

/** Votos de um cargo. Equivalente ao retorno do protótipo, acrescido da legenda. */
export interface CargoApurado {
  codigo: number;
  id: CargoId;
  tipo: 'majoritario' | 'proporcional';
  /** Votos por número do candidato (só quem recebeu votos aparece). */
  votos: Record<string, number>;
  /** Votos de legenda por número do partido (só proporcionais). */
  legenda: Record<string, number>;
  branco: number;
  nulo: number;
  /** Total apurado (campo TOTC): votos nominais + legenda + brancos + nulos. */
  total: number;
  nominais: number;
  legendaTotal: number;
  aptos: number;
}

export interface Comparecimento {
  aptos: number;
  comparecimento: number;
  faltosos: number;
}

export type EstadoAssinatura = 'verificada' | 'nao_verificada';

export interface BoletimDecodificado {
  versao: VersaoFormato;
  origem: string; // VOTA, RED ou SA
  fase: Fase;
  processo: number;
  pleito: number;
  dataPleito: string; // aaaammdd
  turno: 1 | 2;
  uf: string;
  municipio: number;
  zona: number;
  secao: number;
  secoesAgregadas: number[];
  idUrna: string;
  /** Ausente em boletins do Sistema de Apuração (SA), que não trazem comparecimento. */
  comparecimento?: Comparecimento;
  cargos: Partial<Record<CargoId, CargoApurado>>;
  /** Códigos de cargo presentes no BU que o app não apura. */
  cargosIgnorados: number[];
  assinatura: EstadoAssinatura;
  /** Por que a assinatura não foi verificada (ou 'ok'). */
  motivoAssinatura: string;
  /** Hash final (SHA-512, hex maiúsculo) da cadeia de QR Codes. */
  hashFinal: string;
  /** Conteúdo remontado, sem cabeçalhos nem hashes. */
  conteudo: string;
}

export type CodigoErro =
  | 'NENHUM_QR'
  | 'QR_ILEGIVEL'
  | 'VERSAO_NAO_SUPORTADA'
  | 'VERSOES_DIFERENTES'
  | 'TOTAL_DIFERENTE'
  | 'QR_REPETIDO_DIFERENTE'
  | 'QR_FALTANDO'
  | 'CADEIA_QUEBRADA'
  | 'ASSINATURA_AUSENTE'
  | 'ASSINATURA_INVALIDA'
  | 'CERTIFICADO_OUTRA_URNA'
  | 'FORMATO'
  | 'TOTAIS_NAO_BATEM';

export interface ErroBU {
  codigo: CodigoErro;
  /** Mensagem em português, dizendo o que corrigir. */
  mensagem: string;
  /** Números (1..x) dos QR Codes envolvidos, quando fizer sentido. */
  partes?: number[];
}

export type ResultadoDecodificacao =
  | { ok: true; boletim: BoletimDecodificado }
  | { ok: false; erros: ErroBU[] };

/** Fornece a chave pública Ed25519 (32 bytes) de um BU no formato 1.5, ou undefined se não houver. */
export type ProvedorChave = (info: { versaoChave: string; fase: Fase; uf: string }) => Uint8Array | undefined;

export interface OpcoesDecodificacao {
  /** Se informado, verifica a assinatura de BUs 1.5. Boletins 6.0 sempre saem como não verificados. */
  chaves?: ProvedorChave;
}
