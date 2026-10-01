import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { exportarApuracao } from '../../../../src/server/admin/exportar-apuracao';

export async function GET(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const url = new URL(req.url);
    const turno = Number(url.searchParams.get('turno'));
    if (turno !== 1 && turno !== 2) return NextResponse.json({ erro: 'Informe ?turno=1 ou ?turno=2.' }, { status: 400 });
    const csv = await exportarApuracao(turno);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="apuracao-turno-${turno}.csv"`,
      },
    });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao exportar apuração:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
