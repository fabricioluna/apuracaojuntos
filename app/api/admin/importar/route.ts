import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { ErroImportarApuracao, importarApuracao } from '../../../../src/server/admin/importar-apuracao';

export async function POST(req: Request): Promise<Response> {
  try {
    const admin = await exigirAdmin(req.headers.get('authorization'));
    const corpo = await req.json().catch(() => null);
    const csv = (corpo as { csv?: unknown })?.csv;
    if (typeof csv !== 'string' || !csv.trim()) return NextResponse.json({ erro: 'Envie o conteúdo do CSV em { csv }.' }, { status: 400 });
    const resultado = await importarApuracao(csv, admin);
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    if (e instanceof ErroImportarApuracao) return NextResponse.json({ erro: e.message }, { status: 422 });
    console.error('Falha ao importar apuração:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
