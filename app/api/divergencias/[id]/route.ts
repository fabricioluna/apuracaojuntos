import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { ErroDivergencia, resolverDivergencia } from '../../../../src/server/resolver-divergencia';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const admin = await exigirAdmin(req.headers.get('authorization'));
    const { id } = await ctx.params;
    const corpo = await req.json().catch(() => null);
    const decisao = (corpo as { decisao?: unknown })?.decisao;
    if (decisao !== 'manter' && decisao !== 'novo') {
      return NextResponse.json({ erro: 'A decisão deve ser "manter" ou "novo".' }, { status: 400 });
    }
    await resolverDivergencia(id, decisao, admin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    if (e instanceof ErroDivergencia) return NextResponse.json({ erro: e.message }, { status: 409 });
    console.error('Falha ao resolver divergência:', e);
    return NextResponse.json({ erro: 'Erro interno ao resolver a divergência. Tente de novo.' }, { status: 500 });
  }
}
