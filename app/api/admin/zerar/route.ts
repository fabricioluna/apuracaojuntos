import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { zerarApuracao } from '../../../../src/server/admin/zerar-apuracao';

/** Zera a apuração de um turno inteiro. Ação irreversível — exige um corpo explícito
 * { turno, confirmar: true } de propósito, pra nunca acontecer sem querer. */
export async function POST(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const corpo = await req.json().catch(() => null);
    const turno = (corpo as { turno?: unknown })?.turno;
    const confirmar = (corpo as { confirmar?: unknown })?.confirmar;
    if ((turno !== 1 && turno !== 2) || confirmar !== true) {
      return NextResponse.json({ erro: 'Informe turno (1 ou 2) e confirmar: true.' }, { status: 400 });
    }
    const resultado = await zerarApuracao(turno);
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao zerar apuração:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
