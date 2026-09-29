// Aponta o Firebase Admin (e os testes que usam o SDK do cliente) para os emuladores locais,
// nunca para o projeto real. Rode `npx firebase-tools emulators:start --only firestore,auth --project
// apuracaojuntos` antes. Usa o mesmo id do projeto real de propósito: o emulador de Auth foi iniciado
// com --project apuracaojuntos e fixa esse projeto nas trocas de token (signInWithCustomToken), então
// um id diferente causa erro de "aud" incorreto. Isso é seguro: com as variáveis abaixo definidas,
// nenhuma chamada do Admin SDK ou do SDK do cliente sai do computador.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_PROJECT_ID = 'apuracaojuntos';
process.env.GCLOUD_PROJECT = process.env.FIREBASE_PROJECT_ID;
