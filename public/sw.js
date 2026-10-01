// Service worker mínimo, só pra o site ser considerado instalável (critério do Chrome exige um
// worker registrado com um listener de "fetch"). Não guarda cache nenhum de propósito: o cenário
// offline do app é tratado na camada de dados (fila em IndexedDB, ver src/client/fila-offline.ts),
// não aqui — assim nunca corre o risco de servir uma versão velha do painel em cache.
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
