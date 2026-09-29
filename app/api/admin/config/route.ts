import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { atualizarConfig } from '../../../../src/server/admin/atualizar-config';
import type { ZonaConfig } from '../../../../src/domain/types';

function zonasValidas(v: unknown): v is ZonaConfig[] {
  return (
    Array.isArray(v) &&
    v.every(
      z =>
        z && Number.isInteger(z.zona) && z.zona > 0 && Array.isArray(z.secoes) && z.secoes.length > 0 &&
        z.secoes.every((s: unknown) => {
          const sec = s as { secao?: unknown; aptos?: unknown };
          return Number.isInteger(sec.secao) && (sec.secao as number) > 0 && Number.isInteger(sec.aptos) && (sec.aptos as number) >= 0;
        }),
    )
  );
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const corpo = (await req.json().catch(() => null)) as { zonas?: unknown; turno?: unknown } | null;
    if (!corpo) return NextResponse.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 });

    const mudanca: { zonas?: ZonaConfig[]; turno?: 1 | 2 } = {};
    if (corpo.zonas !== undefined) {
      if (!zonasValidas(corpo.zonas)) return NextResponse.json({ erro: 'Zonas inválidas: use zona e seção positivas, e ao menos uma seção por zona.' }, { status: 422 });
      mudanca.zonas = corpo.zonas;
    }
    if (corpo.turno !== undefined) {
      if (corpo.turno !== 1 && corpo.turno !== 2) return NextResponse.json({ erro: 'O turno deve ser 1 ou 2.' }, { status: 422 });
      mudanca.turno = corpo.turno;
    }
    if (!mudanca.zonas && !mudanca.turno) return NextResponse.json({ erro: 'Nada para atualizar.' }, { status: 400 });

    const config = await atualizarConfig(mudanca);
    return NextResponse.json({ config });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao atualizar config:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
