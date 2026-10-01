// Lista curada de candidatos pra acompanhar de perto (pedido da responsável pelo projeto), separada
// da lista oficial completa (data/candidatos.json). O número é a fonte da verdade pros votos; o
// nome exibido vem da lista oficial (nomeCandidato), pra nunca destoar do resto do app — só o
// partido vem daqui, porque a lista oficial não guarda partido por candidato nos cargos
// majoritários (presidente/governador/senador; ver CLAUDE.md > Candidatos). "destaque: true" é
// quem deve aparecer no topo do grupo, com mais ênfase visual.
import type { CargoId } from '../bu/types';

export interface CandidatoAcompanhado {
  numero: string;
  partido: string;
  destaque: boolean;
}

export const ACOMPANHADOS: Partial<Record<CargoId, CandidatoAcompanhado[]>> = {
  presidente: [
    { numero: '13', partido: 'PT', destaque: false }, // Lula
    { numero: '22', partido: 'PL', destaque: false }, // Flávio Bolsonaro
  ],
  governador: [
    { numero: '50', partido: 'PSOL', destaque: false }, // Ivan Moraes
    { numero: '40', partido: 'PSB', destaque: false }, // João Campos
    { numero: '55', partido: 'PSD', destaque: true }, // Raquel Lyra
  ],
  senador: [
    { numero: '111', partido: 'PP', destaque: false }, // Eduardo da Fonte
    { numero: '130', partido: 'PT', destaque: true }, // Humberto Costa
    { numero: '123', partido: 'PDT', destaque: false }, // Marília Arraes
    { numero: '222', partido: 'PL', destaque: false }, // Mendonça Filho
    { numero: '555', partido: 'PSD', destaque: true }, // Túlio Gadêlha
  ],
  federal: [
    { numero: '2222', partido: 'PL', destaque: false }, // Anderson Ferreira
    { numero: '1314', partido: 'PT', destaque: false }, // Carlos Veras
    { numero: '4004', partido: 'PSB', destaque: false }, // Felipe Carreras
    { numero: '2256', partido: 'PL', destaque: false }, // João Prudêncio
    { numero: '1111', partido: 'PP', destaque: false }, // Lula da Fonte
    { numero: '2000', partido: 'Podemos', destaque: false }, // Miguel Duque
    { numero: '1010', partido: 'Republicanos', destaque: true }, // Silvio Costa Filho
  ],
  estadual: [
    { numero: '22222', partido: 'PL', destaque: false }, // André Ferreira
    { numero: '40400', partido: 'PSB', destaque: false }, // Cayo Albino
    { numero: '11555', partido: 'PP', destaque: false }, // Claudiano Filho
    { numero: '13123', partido: 'PT', destaque: false }, // Doriel Barros
    { numero: '40444', partido: 'PSB', destaque: true }, // Eriberto Filho
    { numero: '10000', partido: 'Republicanos', destaque: false }, // Jobinho Almeida (Jobson Almeida, na lista oficial)
    { numero: '20120', partido: 'Solidariedade', destaque: true }, // Luciano Duque
    { numero: '20123', partido: 'Podemos', destaque: false }, // Regina da Saúde
    { numero: '40123', partido: 'PSB', destaque: false }, // Rodrigo Farias
    { numero: '40555', partido: 'PSB', destaque: true }, // Romerinho Jatobá
  ],
};
