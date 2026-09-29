import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { cadastrarFiscal, listarFiscais } from '../../../../src/server/admin/fiscais';

export async function GET(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const fiscais = await listarFiscais();
    return NextResponse.json({ fiscais });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao listar fiscais:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const admin = await exigirAdmin(req.headers.get('authorization'));
    const corpo = await req.json().catch(() => null);
    const nome = (corpo as { nome?: unknown })?.nome;
    const ehAdmin = (corpo as { admin?: unknown })?.admin === true;
    if (typeof nome !== 'string' || nome.trim().length < 3) {
      return NextResponse.json({ erro: 'Informe o nome da pessoa.' }, { status: 400 });
    }
    const { id, codigo } = await cadastrarFiscal(nome.trim(), ehAdmin, admin.nome);
    return NextResponse.json({ id, codigo });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao cadastrar fiscal:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
