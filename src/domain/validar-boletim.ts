import { NOME_CARGO } from '../bu/cargos';
import type { CargoId } from '../bu/types';
import type { BoletimEntrada, ConfigCidade, ErroDominio } from './types';

/**
 * Validações obrigatórias antes de gravar (além das que o decodificador já garante, como as somas
 * de cada cargo). Aqui: zona e seção existem na cidade, os cinco cargos do turno estão presentes,
 * não sobra cargo de outro turno, e, quando o boletim veio de QR Code, a fase e o município batem.
 */
export function validarBoletim(entrada: BoletimEntrada, config: ConfigCidade, permitirBUTeste: boolean): ErroDominio[] {
  const erros: ErroDominio[] = [];

  const zona = config.zonas.find(z => z.zona === entrada.zona);
  if (!zona) {
    erros.push({ codigo: 'ZONA_INEXISTENTE', mensagem: `A zona ${entrada.zona} não faz parte de ${config.nomeMunicipio}.` });
  } else if (!zona.secoes.some(s => s.secao === entrada.secao)) {
    erros.push({ codigo: 'SECAO_INEXISTENTE', mensagem: `A seção ${entrada.secao} não existe na zona ${entrada.zona} de ${config.nomeMunicipio}.` });
  }

  if (entrada.turno !== config.turno) {
    erros.push({ codigo: 'TURNO_DIFERENTE', mensagem: `A apuração está configurada para o ${config.turno}º turno; este boletim é do ${entrada.turno}º.` });
  }

  const exigidos = config.cargosPorTurno[entrada.turno] ?? [];
  const presentes = new Set(Object.keys(entrada.cargos) as CargoId[]);
  const faltando = exigidos.filter(c => !presentes.has(c));
  if (faltando.length) {
    erros.push({
      codigo: 'CARGO_FALTANDO',
      mensagem: `Faltam os cargos: ${faltando.map(c => NOME_CARGO[c]).join(', ')}. O boletim não é gravado pela metade.`,
    });
  }
  const inesperados = [...presentes].filter(c => !exigidos.includes(c));
  if (inesperados.length) {
    erros.push({
      codigo: 'CARGO_INESPERADO',
      mensagem: `O ${entrada.turno}º turno não apura: ${inesperados.map(c => NOME_CARGO[c]).join(', ')}.`,
    });
  }

  if (entrada.origemBU) {
    const { fase, uf, municipio } = entrada.origemBU;
    if (fase !== 'O' && !permitirBUTeste) {
      erros.push({ codigo: 'FASE_NAO_PERMITIDA', mensagem: 'Este QR Code é de um boletim simulado ou de treinamento. Em produção, só boletins oficiais são aceitos.' });
    }
    if (uf !== config.uf || municipio !== config.municipio) {
      erros.push({
        codigo: 'MUNICIPIO_DIFERENTE',
        mensagem: `Este QR Code é de outro município (UF ${uf}, código ${municipio}), não de ${config.nomeMunicipio}.`,
      });
    }
  }

  return erros;
}
