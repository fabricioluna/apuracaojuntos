// Tipos comuns às camadas de domínio e de servidor. Não dependem de Firebase nem de interface.
import type { BoletimDecodificado, CargoApurado, CargoId } from '../bu/types';

export interface SecaoConfig {
  secao: number;
  aptos: number;
}

export interface ZonaConfig {
  zona: number;
  secoes: SecaoConfig[];
}

export interface ConfigCidade {
  uf: string;
  municipio: number;
  nomeMunicipio: string;
  zonas: ZonaConfig[];
  turno: 1 | 2;
  /** Cargos exigidos em cada turno (no 2º turno normalmente só presidente e, às vezes, governador). */
  cargosPorTurno: Record<1 | 2, CargoId[]>;
}

/** O que chega do fiscal para um cargo, seja por QR Code (saída do decodificador) ou digitado. */
export interface CargoEntrada extends CargoApurado {
  origem: 'qrcode' | 'digitado';
}

/** Boletim pronto para gravar, já com zona/seção/turno conferidos e um cargo por origem. */
export interface BoletimEntrada {
  zona: number;
  secao: number;
  turno: 1 | 2;
  cargos: Partial<Record<CargoId, CargoEntrada>>;
  /** Presente quando ao menos um cargo veio de QR Code. */
  origemBU?: Pick<BoletimDecodificado, 'origem' | 'fase' | 'uf' | 'municipio' | 'assinatura' | 'motivoAssinatura'>;
}

export interface ErroDominio {
  codigo:
    | 'ZONA_INEXISTENTE'
    | 'SECAO_INEXISTENTE'
    | 'CARGO_FALTANDO'
    | 'CARGO_INESPERADO'
    | 'FASE_NAO_PERMITIDA'
    | 'MUNICIPIO_DIFERENTE'
    | 'TURNO_DIFERENTE';
  mensagem: string;
}

/** Documento boletins/{zona-secao-turno}, gravado pelo servidor. */
export interface BoletimGravado {
  id: string;
  zona: number;
  secao: number;
  turno: 1 | 2;
  cargos: Partial<Record<CargoId, CargoApurado & { origem: 'qrcode' | 'digitado' }>>;
  assinatura?: 'verificada' | 'nao_verificada';
  fiscalId: string;
  fiscalNome: string;
  enviadoEm: number;
  corrigidoPor?: string;
  corrigidoEm?: number;
  fiscalAnteriorId?: string;
}

export interface DiferencaCampo {
  cargo: CargoId;
  campo: string;
  atual: number | string;
  novo: number | string;
}

export type DecisaoDivergencia = 'manter' | 'novo';

export interface Divergencia {
  id: string;
  key: string; // id do boletim (zona-secao-turno)
  novo: BoletimGravado;
  diffs: DiferencaCampo[];
  status: 'pendente' | 'resolvida';
  criadoEm: number;
  resolvidaPor?: string;
  resolvidaEm?: number;
  decisao?: DecisaoDivergencia;
}

export type ResultadoEnvio =
  | { status: 'novo' }
  | { status: 'igual'; fiscalNome: string; enviadoEm: number }
  | { status: 'divergente'; diffs: DiferencaCampo[]; jaAvisado: boolean };
