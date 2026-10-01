import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../../src/server/autenticar-requisicao';
import { obterBoletim } from '../../../../../src/server/admin/listar-boletins';
import { ErroExcluirBoletim, excluirBoletim } from '../../../../../src/server/admin/excluir-boletim';

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

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const { id } = await ctx.params;
    await excluirBoletim(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    if (e instanceof ErroExcluirBoletim) return NextResponse.json({ erro: e.message }, { status: 404 });
    console.error('Falha ao excluir boletim:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
