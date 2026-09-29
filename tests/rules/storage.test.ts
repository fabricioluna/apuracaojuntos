import fs from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type firebase from 'firebase/compat/app';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'apuracaojuntos-regras-storage-teste',
    storage: { rules: fs.readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
afterAll(() => testEnv?.cleanup());
beforeEach(() => testEnv.clearStorage());

const imagem = new Uint8Array([1, 2, 3, 4]);

// O .put() do SDK compat devolve um UploadTask (só "thenable", não um Promise completo);
// Promise.resolve(...) normaliza para o tipo que assertSucceeds/assertFails espera.
function gravar(ref: firebase.storage.Reference, contentType: string) {
  return Promise.resolve(ref.put(imagem, { contentType }));
}

describe('storage.rules: foto do boletim', () => {
  it('o fiscal grava na própria pasta', async () => {
    const s = testEnv.authenticatedContext('fiscal1').storage();
    await assertSucceeds(gravar(s.ref('boletins/fiscal1/foto.jpg'), 'image/jpeg'));
  });

  it('o fiscal não grava na pasta de outro fiscal', async () => {
    const s = testEnv.authenticatedContext('fiscal1').storage();
    await assertFails(gravar(s.ref('boletins/fiscal2/foto.jpg'), 'image/jpeg'));
  });

  it('recusa quem não está logado', async () => {
    const s = testEnv.unauthenticatedContext().storage();
    await assertFails(gravar(s.ref('boletins/fiscal1/foto.jpg'), 'image/jpeg'));
  });

  it('recusa arquivo que não é imagem', async () => {
    const s = testEnv.authenticatedContext('fiscal1').storage();
    await assertFails(gravar(s.ref('boletins/fiscal1/foto.pdf'), 'application/pdf'));
  });

  it('o próprio fiscal lê a própria foto', async () => {
    const admin = testEnv.authenticatedContext('fiscal1', { admin: true }).storage();
    await gravar(admin.ref('boletins/fiscal1/foto.jpg'), 'image/jpeg');
    const s = testEnv.authenticatedContext('fiscal1').storage();
    await assertSucceeds(s.ref('boletins/fiscal1/foto.jpg').getDownloadURL());
  });

  it('outro fiscal (sem ser admin) não lê a foto', async () => {
    const dono = testEnv.authenticatedContext('fiscal1').storage();
    await gravar(dono.ref('boletins/fiscal1/foto.jpg'), 'image/jpeg');
    const outro = testEnv.authenticatedContext('fiscal2').storage();
    await assertFails(outro.ref('boletins/fiscal1/foto.jpg').getDownloadURL());
  });

  it('o administrador lê a foto de qualquer fiscal', async () => {
    const dono = testEnv.authenticatedContext('fiscal1').storage();
    await gravar(dono.ref('boletins/fiscal1/foto.jpg'), 'image/jpeg');
    const admin = testEnv.authenticatedContext('adminUid', { admin: true }).storage();
    await assertSucceeds(admin.ref('boletins/fiscal1/foto.jpg').getDownloadURL());
  });
});
