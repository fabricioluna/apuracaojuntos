import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirFiscal } from '../../../src/server/autenticar-requisicao';
import { ErroLeituraIA, lerBoletimComIA } from '../../../src/server/ler-boletim-ia';

// Base64 de uma imagem infla ~33% o tamanho original; 15MB de texto cobre uma foto de ~11MB, bem
// acima do que uma foto de celular comprimida costuma pesar. Só uma trava contra payload absurdo.
const TAMANHO_MAXIMO_POR_FOTO = 15_000_000;
// Quando o boletim não cabe numa foto só (ver CLAUDE.md): limite de fotos por boletim, só pra
// evitar um payload desproporcional — não há motivo real pra precisar de mais que isso.
const MAXIMO_DE_FOTOS = 6;

/** Qualquer fiscal logado pode tentar (é parte do fluxo de envio dele, não uma ação de admin). O
 * resultado é só uma sugestão: quem chama ainda precisa conferir e confirmar na tela de digitação. */
export async function POST(req: Request): Promise<Response> {
  try {
    await exigirFiscal(req.headers.get('authorization'));
    const corpo = await req.json().catch(() => null);
    const imagens = (corpo as { imagens?: unknown })?.imagens;
    if (!Array.isArray(imagens) || imagens.length === 0) {
      return NextResponse.json({ erro: 'Envie ao menos uma foto válida.' }, { status: 400 });
    }
    if (imagens.length > MAXIMO_DE_FOTOS) {
      return NextResponse.json({ erro: `Envie no máximo ${MAXIMO_DE_FOTOS} fotos por boletim.` }, { status: 400 });
    }

    const imagensValidadas: { base64: string; mimeType: string }[] = [];
    for (const img of imagens) {
      const imagemBase64 = (img as { imagemBase64?: unknown })?.imagemBase64;
      const mimeType = (img as { mimeType?: unknown })?.mimeType;
      if (typeof imagemBase64 !== 'string' || typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
        return NextResponse.json({ erro: 'Envie fotos válidas.' }, { status: 400 });
      }
      if (imagemBase64.length > TAMANHO_MAXIMO_POR_FOTO) return NextResponse.json({ erro: 'Uma das fotos é grande demais.' }, { status: 400 });
      imagensValidadas.push({ base64: imagemBase64, mimeType });
    }

    const resultado = await lerBoletimComIA(imagensValidadas);
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    if (e instanceof ErroLeituraIA) return NextResponse.json({ erro: e.message }, { status: 422 });
    console.error('Falha na leitura do boletim por IA:', e);
    return NextResponse.json({ erro: 'Erro interno ao ler a foto.' }, { status: 500 });
  }
}
