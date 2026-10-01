import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirFiscal } from '../../../src/server/autenticar-requisicao';
import { ErroLeituraIA, lerBoletimComIA } from '../../../src/server/ler-boletim-ia';

// Base64 de uma imagem infla ~33% o tamanho original; 15MB de texto cobre uma foto de ~11MB, bem
// acima do que uma foto de celular comprimida costuma pesar. Só uma trava contra payload absurdo.
const TAMANHO_MAXIMO = 15_000_000;

/** Qualquer fiscal logado pode tentar (é parte do fluxo de envio dele, não uma ação de admin). O
 * resultado é só uma sugestão: quem chama ainda precisa conferir e confirmar na tela de digitação. */
export async function POST(req: Request): Promise<Response> {
  try {
    await exigirFiscal(req.headers.get('authorization'));
    const corpo = await req.json().catch(() => null);
    const imagemBase64 = (corpo as { imagemBase64?: unknown })?.imagemBase64;
    const mimeType = (corpo as { mimeType?: unknown })?.mimeType;
    if (typeof imagemBase64 !== 'string' || typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
      return NextResponse.json({ erro: 'Envie uma foto válida.' }, { status: 400 });
    }
    if (imagemBase64.length > TAMANHO_MAXIMO) return NextResponse.json({ erro: 'Essa foto é grande demais.' }, { status: 400 });

    const resultado = await lerBoletimComIA(imagemBase64, mimeType);
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    if (e instanceof ErroLeituraIA) return NextResponse.json({ erro: e.message }, { status: 422 });
    console.error('Falha na leitura do boletim por IA:', e);
    return NextResponse.json({ erro: 'Erro interno ao ler a foto.' }, { status: 500 });
  }
}
