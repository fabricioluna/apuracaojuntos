import { interpretarConteudo } from './content';
import { conferirCadeia, remontarConteudo } from './hash';
import { ehErro, lerParte, type ParteCertificado, type ParteDados } from './part';
import { verificarEd25519 } from './signature';
import type { BoletimDecodificado, ErroBU, OpcoesDecodificacao, ResultadoDecodificacao } from './types';

const lista = (ns: number[]) => (ns.length === 1 ? `${ns[0]}` : `${ns.slice(0, -1).join(', ')} e ${ns[ns.length - 1]}`);

const falha = (...erros: ErroBU[]): ResultadoDecodificacao => ({ ok: false, erros });

/**
 * Decodifica um boletim de urna a partir do texto de todos os seus QR Codes (em qualquer ordem).
 * Valida a sequência e a cadeia de hashes conforme o manual do TSE, junta o conteúdo e devolve os dados.
 * Aceita os formatos VRQR 1.5 (2018) e 6.0 (2026). Os QR Codes do certificado da urna podem vir junto.
 */
export function decodificarBU(textos: string[], opcoes: OpcoesDecodificacao = {}): ResultadoDecodificacao {
  if (textos.length === 0) return falha({ codigo: 'NENHUM_QR', mensagem: 'Nenhum QR Code foi lido.' });

  // 1. Ler cada QR Code
  const dados: ParteDados[] = [], certificados: ParteCertificado[] = [], erros: ErroBU[] = [];
  for (const t of textos) {
    const p = lerParte(t);
    if (ehErro(p)) { if (!erros.some(e => e.mensagem === p.mensagem)) erros.push(p); }
    else if (p.tipo === 'dados') dados.push(p);
    else certificados.push(p);
  }
  if (erros.length) return { ok: false, erros };
  if (dados.length === 0) {
    return falha({ codigo: 'QR_FALTANDO', mensagem: 'Só foram lidos QR Codes do certificado. Leia também os QR Codes de dados do boletim.' });
  }

  // 2. Todas as partes precisam ser do mesmo formato e da mesma sequência
  const versao = dados[0]!.versao, total = dados[0]!.total;
  if (dados.some(p => p.versao !== versao)) {
    return falha({ codigo: 'VERSOES_DIFERENTES', mensagem: 'Os QR Codes lidos são de formatos diferentes, ou seja, de boletins diferentes. Recomece a leitura.' });
  }
  if (dados.some(p => p.total !== total)) {
    return falha({ codigo: 'TOTAL_DIFERENTE', mensagem: 'Os QR Codes lidos não são do mesmo boletim (quantidades diferentes de QR Codes). Recomece a leitura.' });
  }

  // 3. Repetidos: iguais são descartados; diferentes com o mesmo número indicam boletins misturados
  const porIndice = new Map<number, ParteDados>();
  for (const p of dados) {
    const antes = porIndice.get(p.indice);
    if (!antes) porIndice.set(p.indice, p);
    else if (antes.dados !== p.dados || antes.hash !== p.hash) {
      return falha({
        codigo: 'QR_REPETIDO_DIFERENTE',
        mensagem: `Foram lidos dois QR Codes diferentes com o número ${p.indice} de ${total}. Eles parecem ser de boletins de urnas diferentes. Recomece a leitura.`,
        partes: [p.indice],
      });
    }
  }

  // 4. Nenhum pode faltar
  const faltam: number[] = [];
  for (let n = 1; n <= total; n++) if (!porIndice.has(n)) faltam.push(n);
  if (faltam.length) {
    return falha({
      codigo: 'QR_FALTANDO',
      mensagem: faltam.length === 1 ? `Falta ler o QR Code ${faltam[0]} de ${total}.` : `Faltam ler os QR Codes ${lista(faltam)} de ${total}.`,
      partes: faltam,
    });
  }
  const partes = [...porIndice.values()].sort((a, b) => a.indice - b.indice);

  // 5. Cadeia de hashes: pega QR Code de outra urna, lido com erro ou fora de sequência
  const cadeia = conferirCadeia(partes);
  if (!cadeia.ok) {
    return falha({
      codigo: 'CADEIA_QUEBRADA',
      mensagem: `O QR Code ${cadeia.indice} de ${total} não confere com os anteriores. Ele pode ser de outra urna ou ter sido lido com erro. Leia de novo, começando pelo QR Code 1.`,
      partes: [cadeia.indice],
    });
  }

  // 6. A assinatura só existe no último QR Code
  const ultima = partes[partes.length - 1]!;
  const assinaturaFora = partes.find(p => p !== ultima && p.assinatura);
  if (assinaturaFora) {
    return falha({ codigo: 'QR_ILEGIVEL', mensagem: `O QR Code ${assinaturaFora.indice} de ${total} traz uma assinatura fora do último QR Code. Leia de novo.`, partes: [assinaturaFora.indice] });
  }
  if (!ultima.assinatura) {
    return falha({ codigo: 'ASSINATURA_AUSENTE', mensagem: `O último QR Code (${total} de ${total}) não traz a assinatura digital. Leia de novo.`, partes: [total] });
  }

  // 7. Conteúdo
  const conteudo = remontarConteudo(partes);
  const lido = interpretarConteudo(conteudo);
  if (!lido.ok) return lido;

  // 8. Certificado da urna (formato 6.0): precisa ser da mesma urna do boletim
  const certUrna = conferirCertificado(certificados, lido.dados.idUrna);
  if (certUrna.erro) return falha(certUrna.erro);

  // 9. Assinatura
  let assinatura: BoletimDecodificado['assinatura'] = 'nao_verificada';
  let motivo: string;
  if (versao === '6.0') {
    motivo = certUrna.presente
      ? 'formato 6.0: assinatura EdDSA E-521 com certificado da urna; verificação ainda não implementada'
      : 'formato 6.0: certificado da urna não lido; verificação de assinatura ainda não implementada';
  } else if (!opcoes.chaves) {
    motivo = 'verificação de assinatura não configurada';
  } else {
    const chave = opcoes.chaves({ versaoChave: partes[0]!.versaoChave!, fase: lido.dados.fase, uf: lido.dados.uf });
    if (!chave) motivo = 'chave pública não disponível ou não confere com a lista de hashes do TSE';
    else if (verificarEd25519(chave, ultima.hash, ultima.assinatura)) { assinatura = 'verificada'; motivo = 'ok'; }
    else {
      return falha({ codigo: 'ASSINATURA_INVALIDA', mensagem: 'A assinatura digital do boletim não confere. O QR Code pode ter sido alterado. Leia de novo ou digite os valores.' });
    }
  }

  return {
    ok: true,
    boletim: { ...lido.dados, versao, assinatura, motivoAssinatura: motivo, hashFinal: ultima.hash, conteudo },
  };
}

function conferirCertificado(certs: ParteCertificado[], idUrna: string): { presente: boolean; erro?: ErroBU } {
  if (certs.length === 0) return { presente: false };
  const mesmaUrna = (id?: string) => id === undefined || Number(id) === Number(idUrna);
  if (certs.some(c => !mesmaUrna(c.idUrna))) {
    return { presente: true, erro: { codigo: 'CERTIFICADO_OUTRA_URNA', mensagem: 'O QR Code do certificado lido é de outra urna. Leia o certificado impresso no mesmo boletim.' } };
  }
  return { presente: true };
}
