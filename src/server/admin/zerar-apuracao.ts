import { CARGOS_ORDEM } from '../../bu/cargos';
import { db } from '../firebase-admin';

/** Firestore recusa mais de 500 operações num único lote; uma margem segura abaixo disso. */
const TAMANHO_LOTE = 400;

async function apagarEmLotes(refs: FirebaseFirestore.DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += TAMANHO_LOTE) {
    const lote = db().batch();
    for (const ref of refs.slice(i, i + TAMANHO_LOTE)) lote.delete(ref);
    await lote.commit();
  }
}

/**
 * Zera a apuração de um turno inteiro: apaga todos os boletins daquele turno, as divergências
 * ligadas a eles, os totais de cada cargo e o mapa de urnas. Não existe desfazer — a tela do
 * administrador pede confirmação explícita antes de chamar isto (ver src/ui/admin/Ajustes.tsx).
 *
 * Diferente de excluirBoletim (que desfaz a contribuição boletim a boletim, com a transação inteira),
 * aqui é mais simples e mais rápido apagar os documentos agregados direto — não tem sentido decrementar
 * um total que vai ser apagado de qualquer forma. Não é uma transação só (o Firestore não permite
 * apagar por consulta dentro de uma transação em lote); por isso não é atômico fim a fim, mas cada
 * exclusão individual é.
 *
 * Fotos no Storage (boletins/{uid}/...) não são apagadas — ficam órfãs, mas inofensivas (nunca lidas
 * sem o boletim que as referencia).
 */
export async function zerarApuracao(turno: number): Promise<{ boletinsApagados: number; divergenciasApagadas: number }> {
  const [boletinsSnap, divergenciasSnap] = await Promise.all([
    db().collection('boletins').where('turno', '==', turno).get(),
    db().collection('divergencias').where('novo.turno', '==', turno).get(),
  ]);

  await apagarEmLotes(boletinsSnap.docs.map(d => d.ref));
  await apagarEmLotes(divergenciasSnap.docs.map(d => d.ref));
  await apagarEmLotes(CARGOS_ORDEM.map(cargoId => db().collection('totais').doc(`${turno}_${cargoId}`)));
  await apagarEmLotes([db().collection('mapa').doc(String(turno))]);

  return { boletinsApagados: boletinsSnap.size, divergenciasApagadas: divergenciasSnap.size };
}
