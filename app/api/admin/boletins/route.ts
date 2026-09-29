import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { listarBoletins } from '../../../../src/server/admin/listar-boletins';

export async function GET(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const turno = Number(new URL(req.url).searchParams.get('turno') ?? '1');
    const boletins = await listarBoletins(turno);
    return NextResponse.json({ boletins });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao listar boletins:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
