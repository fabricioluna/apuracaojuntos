import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../../src/server/autenticar-requisicao';
import { definirAtivo, excluirFiscal } from '../../../../../src/server/admin/fiscais';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const { id } = await ctx.params;
    const corpo = await req.json().catch(() => null);
    const ativo = (corpo as { ativo?: unknown })?.ativo;
    if (typeof ativo !== 'boolean') return NextResponse.json({ erro: 'Informe ativo: true ou false.' }, { status: 400 });
    await definirAtivo(id, ativo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao atualizar fiscal:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const admin = await exigirAdmin(req.headers.get('authorization'));
    const { id } = await ctx.params;
    if (id === admin.uid) return NextResponse.json({ erro: 'Você não pode excluir seu próprio cadastro.' }, { status: 400 });
    await excluirFiscal(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao excluir fiscal:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
