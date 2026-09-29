import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../../src/server/autenticar-requisicao';
import { obterBoletim } from '../../../../../src/server/admin/listar-boletins';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const { id } = await ctx.params;
    const boletim = await obterBoletim(id);
    if (!boletim) return NextResponse.json({ erro: 'Boletim não encontrado.' }, { status: 404 });
    return NextResponse.json({ boletim });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao ler boletim:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
