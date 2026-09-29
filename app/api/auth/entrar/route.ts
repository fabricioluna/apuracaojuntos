import { NextResponse } from 'next/server';
import { autenticarFiscal } from '../../../../src/server/fiscal-auth';

// Identificador para limitar tentativas. Na Vercel, x-forwarded-for traz o IP de quem acessa.
function identificadorDoPedido(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'sem-ip';
}

export async function POST(req: Request): Promise<Response> {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 });
  }
  const codigo = (corpo as { codigo?: unknown })?.codigo;
  if (typeof codigo !== 'string') return NextResponse.json({ erro: 'Informe o código.' }, { status: 400 });

  const r = await autenticarFiscal(codigo, identificadorDoPedido(req));
  if (!r.ok) return NextResponse.json({ erro: r.mensagem }, { status: 401 });
  return NextResponse.json({ token: r.token, nome: r.nome, admin: r.admin });
}
