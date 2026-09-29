import { NextResponse } from 'next/server';
import { CARGOS_ORDEM } from '../../../src/bu/cargos';
import { decodificarBU } from '../../../src/bu/decode';
import type { CargoId } from '../../../src/bu/types';
import { ErroAutenticacao, exigirFiscal } from '../../../src/server/autenticar-requisicao';
import { lerConfigCidade } from '../../../src/server/config';
import { gravarBoletim } from '../../../src/server/gravar-boletim';
import type { CargoDigitado } from '../../../src/domain/validar-digitado';
import { validarCargosDigitados } from '../../../src/domain/validar-digitado';
import { validarBoletim } from '../../../src/domain/validar-boletim';
import type { BoletimEntrada, CargoEntrada } from '../../../src/domain/types';

/**
 * Corpo esperado: OU
 *   { partes: string[] }                                    — textos de todos os QR Codes lidos
 * OU
 *   { zona: number, secao: number, turno: number, digitado: Partial<Record<CargoId, CargoDigitado>> }
 *
 * O boletim real não tem um QR Code por cargo (ver nota em validar-digitado.ts), então não existe
 * mistura de cargos por QR Code com outros digitados: ou o boletim inteiro veio do QR Code, ou o
 * fiscal digitou o boletim inteiro olhando o papel.
 */
interface CorpoQR { partes: string[] }
interface CorpoDigitado { zona: number; secao: number; turno: number; digitado: Partial<Record<CargoId, CargoDigitado>> }

function ehCorpoQR(c: unknown): c is CorpoQR {
  return Array.isArray((c as CorpoQR)?.partes) && (c as CorpoQR).partes.length > 0;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const fiscal = await exigirFiscal(req.headers.get('authorization'));
    const corpo = await req.json().catch(() => null);
    if (!corpo) return NextResponse.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 });

    const config = await lerConfigCidade();
    const permitirTeste = process.env.PERMITIR_BU_TESTE === 'true';

    let entrada: BoletimEntrada;

    if (ehCorpoQR(corpo)) {
      const r = decodificarBU(corpo.partes);
      if (!r.ok) return NextResponse.json({ erro: r.erros[0]!.mensagem, erros: r.erros }, { status: 422 });
      const cargos: Partial<Record<CargoId, CargoEntrada>> = {};
      for (const id of CARGOS_ORDEM) {
        const c = r.boletim.cargos[id];
        if (c) cargos[id] = { ...c, origem: 'qrcode' };
      }
      entrada = {
        zona: r.boletim.zona,
        secao: r.boletim.secao,
        turno: r.boletim.turno,
        cargos,
        origemBU: {
          origem: r.boletim.origem,
          fase: r.boletim.fase,
          uf: r.boletim.uf,
          municipio: r.boletim.municipio,
          assinatura: r.boletim.assinatura,
          motivoAssinatura: r.boletim.motivoAssinatura,
        },
      };
    } else {
      const c = corpo as Partial<CorpoDigitado>;
      if (typeof c.zona !== 'number' || typeof c.secao !== 'number' || typeof c.turno !== 'number' || !c.digitado) {
        return NextResponse.json({ erro: 'Envie os QR Codes lidos ou os valores digitados de todos os cargos.' }, { status: 400 });
      }
      const exigidos = config.cargosPorTurno[c.turno as 1 | 2] ?? [];
      const v = validarCargosDigitados(c.digitado, exigidos);
      if (!v.ok) return NextResponse.json({ erro: v.mensagens[0], erros: v.mensagens }, { status: 422 });
      entrada = { zona: c.zona, secao: c.secao, turno: c.turno as 1 | 2, cargos: v.cargos };
    }

    const errosDominio = validarBoletim(entrada, config, permitirTeste);
    if (errosDominio.length) return NextResponse.json({ erro: errosDominio[0]!.mensagem, erros: errosDominio }, { status: 422 });

    const resultado = await gravarBoletim(entrada, fiscal);
    return NextResponse.json({ resultado });
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('Falha ao gravar boletim:', e);
    return NextResponse.json({ erro: 'Erro interno ao gravar o boletim. Tente de novo.' }, { status: 500 });
  }
}
