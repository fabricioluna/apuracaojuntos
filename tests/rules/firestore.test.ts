import fs from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'apuracaojuntos-regras-teste',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => testEnv?.cleanup());
beforeEach(() => testEnv.clearFirestore());

describe('leitura pública', () => {
  it('totais: permitida', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(db.collection('totais').doc('1_presidente').get());
  });
  it('mapa: permitida', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(db.collection('mapa').doc('1').get());
  });
  it('config/publico: permitida', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(db.collection('config').doc('publico').get());
  });
});

describe('leitura privada (negada ao cliente)', () => {
  it('boletins: negada, mesmo autenticado', async () => {
    const db = testEnv.authenticatedContext('algum-uid').firestore();
    await assertFails(db.collection('boletins').doc('9-16-1').get());
  });
  it('divergencias: negada', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('divergencias').doc('x').get());
  });
  it('fiscais: negada', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('fiscais').doc('x').get());
  });
});

describe('escrita do cliente: sempre negada, mesmo com claim admin', () => {
  it('totais', async () => {
    const db = testEnv.authenticatedContext('u', { admin: true }).firestore();
    await assertFails(db.collection('totais').doc('1_presidente').set({ total: 999 }));
  });
  it('boletins', async () => {
    const db = testEnv.authenticatedContext('u', { admin: true }).firestore();
    await assertFails(db.collection('boletins').doc('9-16-1').set({ zona: 9 }));
  });
  it('config/publico', async () => {
    const db = testEnv.authenticatedContext('u', { admin: true }).firestore();
    await assertFails(db.collection('config').doc('publico').set({ uf: 'XX' }));
  });
  it('divergencias, decidindo uma divergência direto pelo cliente', async () => {
    const db = testEnv.authenticatedContext('u', { admin: true }).firestore();
    await assertFails(db.collection('divergencias').doc('x').update({ status: 'resolvida' }));
  });
});
