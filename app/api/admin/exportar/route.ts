import { NextResponse } from 'next/server';
import { ErroAutenticacao, exigirAdmin } from '../../../../src/server/autenticar-requisicao';
import { exportarApuracao, resumoParaCsv, resumoParaXlsx, resumoVotacao } from '../../../../src/server/admin/exportar-apuracao';

/**
 * ?turno=1 (padrão): CSV "longo", um boletim por linha de cada item — formato pra importar de
 * volta (ver importar-apuracao.ts), não pra leitura direta.
 * ?turno=1&tipo=resumo&formato=csv|xlsx: resumo legível da votação (nome do candidato + total de
 * votos já somado, por cargo), direto de totais/*.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req.headers.get('authorization'));
    const url = new URL(req.url);
    const turno = Number(url.searchParams.get('turno'));
    if (turno !== 1 && turno !== 2) return NextResponse.json({ erro: 'Informe ?turno=1 ou ?turno=2.' }, { status: 400 });

    if (url.searchParams.get('tipo') === 'resumo') {
      const linhas = await resumoVotacao(turno);
      const formato = url.searchParams.get('formato') === 'xlsx' ? 'xlsx' : 'csv';
      if (formato === 'xlsx') {
        return new Response(new Uint8Array(resumoParaXlsx(linhas)), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="resumo-votacao-turno-${turno}.xlsx"`,
          },
        });
      }
      return new Response(resumoParaCsv(linhas), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="resumo-votacao-turno-${turno}.csv"`,
        },
      });
    }

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
