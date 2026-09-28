import type { ErroBU, VersaoFormato } from './types';

/** Um QR Code de dados do BU, já separado nas suas três seções (cabeçalho, conteúdo, segurança). */
export interface ParteDados {
  tipo: 'dados';
  indice: number;
  total: number;
  versao: VersaoFormato;
  /** Campo VRCH (só no formato 1.5): versão da chave de assinatura. */
  versaoChave?: string;
  /** Conteúdo tal como impresso, sem cabeçalho e sem os campos de segurança. */
  dados: string;
  hash: string;
  assinatura?: string;
}

/** Um QR Code do certificado da urna (sequência própria, separada dos QR Codes de dados). */
export interface ParteCertificado {
  tipo: 'certificado';
  indice: number;
  total: number;
  idUrna?: string;
  modelo?: string;
  certHex: string;
}

const RE_DADOS = /^QRBU:(\d+):(\d+) VRQR:(\d+\.\d+)(?: VRCH:(\d+))? (.*) HASH:([0-9A-Fa-f]{128})(?: ASSI:([0-9A-Fa-f]+))?$/s;

const VERSOES: Record<string, VersaoFormato> = { '1.5': '1.5', '6.0': '6.0' };

/**
 * Lê o texto de um QR Code. Serve tanto para a câmera (classificar cada leitura) quanto para o decodificador.
 * Retorna a parte ou um erro em português.
 */
export function lerParte(texto: string): ParteDados | ParteCertificado | ErroBU {
  const t = texto.trim();
  if (t.startsWith('QRCE:')) return lerCertificado(t);
  if (!t.startsWith('QRBU:')) {
    return { codigo: 'QR_ILEGIVEL', mensagem: 'Este QR Code não é de um boletim de urna. Leia os QR Codes impressos no boletim.' };
  }
  const versaoTexto = /^QRBU:\d+:\d+ VRQR:(\S+)/.exec(t)?.[1];
  if (versaoTexto && !(versaoTexto in VERSOES)) {
    return {
      codigo: 'VERSAO_NAO_SUPORTADA',
      mensagem: `Formato de QR Code não reconhecido (versão ${versaoTexto}). Digite os valores olhando o boletim impresso.`,
    };
  }
  const m = RE_DADOS.exec(t);
  if (!m) {
    return { codigo: 'QR_ILEGIVEL', mensagem: 'Este QR Code do boletim está incompleto ou danificado. Leia de novo.' };
  }
  const indice = Number(m[1]), total = Number(m[2]);
  if (!(indice >= 1 && total >= 1 && indice <= total)) {
    return { codigo: 'QR_ILEGIVEL', mensagem: `A numeração do QR Code (${indice} de ${total}) é inválida. Leia de novo.` };
  }
  const versao = VERSOES[m[3]!]!;
  if (versao === '1.5' && !m[4]) {
    return { codigo: 'QR_ILEGIVEL', mensagem: 'Este QR Code não traz a versão da chave de assinatura. Leia de novo.' };
  }
  return {
    tipo: 'dados',
    indice,
    total,
    versao,
    versaoChave: m[4],
    dados: m[5]!,
    hash: m[6]!.toUpperCase(),
    assinatura: m[7]?.toUpperCase(),
  };
}

function lerCertificado(t: string): ParteCertificado | ErroBU {
  const cab = /^QRCE:(\d+):(\d+)\b/.exec(t);
  if (!cab) return { codigo: 'QR_ILEGIVEL', mensagem: 'Este QR Code do certificado está danificado. Leia de novo.' };
  const indice = Number(cab[1]), total = Number(cab[2]);
  if (!(indice >= 1 && total >= 1 && indice <= total)) {
    return { codigo: 'QR_ILEGIVEL', mensagem: 'A numeração do QR Code do certificado é inválida. Leia de novo.' };
  }
  // Campos do manual: IDUE, MDUE e CERT (hexadecimal).
  const campo = (nome: string) => new RegExp(`(?:^| )${nome}:(\\S+)`).exec(t)?.[1];
  return {
    tipo: 'certificado',
    indice,
    total,
    idUrna: campo('IDUE'),
    modelo: campo('MDUE'),
    certHex: (campo('CERT') ?? '').toUpperCase(),
  };
}

export function ehErro(x: ParteDados | ParteCertificado | ErroBU): x is ErroBU {
  return 'codigo' in x;
}
