import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { listarDivergencias } from '../../../../src/server/admin/listar-divergencias';

export async function GET(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const dados = await listarDivergencias();
    return NextResponse.json(dados);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao listar divergências:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
