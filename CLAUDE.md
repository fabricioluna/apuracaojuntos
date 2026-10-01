# Construindo Juntos: apuração paralela

Totalização paralela e **não oficial** de votos de uma cidade nas eleições gerais de 4/10/2026 (1º turno, possível 2º turno em 25/10/2026). Fiscais e voluntários enviam o boletim de urna (BU); uma página pública mostra a apuração em tempo real. O resultado oficial é sempre o do TSE.

MVP enxuto: menos funções que funcionem bem valem mais do que muitas pela metade.

## Regras de trabalho

1. Este arquivo guarda regras, stack, convenções e decisões aprovadas. Mantenha-o atualizado a cada decisão.
2. **Nunca invente o formato do QR Code.** Tudo sobre o BU vem do manual do TSE (`docs/manual-qrcode.pdf`). Se algo for ambíguo, pare e pergunte.
3. Trabalhe em etapas. Ao fim de cada uma: rode os testes, mostre o resultado, espere confirmação. Um commit por etapa, mensagem clara em português.
4. Interface em português do Brasil. Nomes no código em inglês, comentários em português.
5. Nunca coloque chaves, tokens ou credenciais no código ou no repositório. Use variáveis de ambiente; `.env.local` fica no `.gitignore`; `.env.example` sem valores. (Chaves **públicas** do TSE não são segredo e podem ficar no repositório.)
6. Quando algo depender de ação de quem mantém o projeto (Firebase, Vercel, chaves, claims), pare e dê a lista exata de passos em linguagem simples.
7. Os exemplos de `docs/tse-exemplos-boletim-urna-eleicoes-2018/` servem só para testar o decodificador. Nunca trate como dados da cidade.
8. Deixar para o fim (fora do MVP): leitura de foto por IA, notificações por e-mail e qualquer função não descrita no pedido original.

## Stack

- Next.js (App Router) + TypeScript, repositório no GitHub, deploy na Vercel.
- Firebase Auth (login), Firestore (dados), Firebase Storage (fotos dos BUs).
- Firebase Admin SDK nas rotas de API (servidor). Cliente nunca escreve no Firestore.
- PWA instalável, mobile first.
- Vitest para decodificador e regras de negócio; emulador do Firebase para testar as regras do Firestore.

## Visual

- Reproduzir o protótipo `docs/apuracao.html` (telas, textos, regras) e seguir a skill Frontend Design.
- Roxo predomina, verde é acento. Roxo `#7602BD`, roxo profundo `#4C0166`, verde `#00FF05`, fundo escuro `#1A052D`, painel escuro `#2A0B47`, fundo claro `#F3EAFB`.
- Tokens de cor com tema escuro e claro conforme `prefers-color-scheme`.
- Títulos: Archivo, largura expandida, peso 800 a 900. Texto: Instrument Sans.
- Logo verde no cabeçalho escuro; logo roxa sobre fundos claros.
- Navegação inferior no celular, no topo no desktop. Botões com pelo menos 48px de altura, foco visível, respeito a `prefers-reduced-motion`.
- Sem gradientes decorativos. Sem animações que não respondam a uma ação do usuário.

## Fatos verificados sobre o BU

Há **duas edições** do manual em `docs/`, com formatos diferentes. Os exemplos de teste são do formato antigo; a eleição de 2026 usa o novo.

| | 2018 (`manual-qrcode.pdf`) | 2026 (`manual qrcode 2026.pdf`, TSE, ago./2026, 36 páginas) |
|---|---|---|
| Versão do formato | `VRQR:1.5` (+ `VRCH:aaaammdd`) | `VRQR:6.0` (sem `VRCH`) |
| Assinatura | Ed25519, chave pública por UF (`s<uf>qrcode.pub`) | EdDSA com curva E-521 (hash SHAKE256) ou ECDSA P-521, chave no **certificado da urna** |
| Onde está a chave | Arquivo baixado do TSE, conferido nas listas SHA-512 | Nos **dois últimos QR Codes do BU** (`QRCE:n:x`, campo `CERT` em hexadecimal, PEM ou DER) |

Comum às duas edições (verificado nos exemplos de 2018 **e** no exemplo pequeno do manual de 2026):
- Cada QR Code: `QRBU:n:x VRQR:...` + registros `CHAVE:valor` separados por espaço + `HASH:` (e `ASSI:` só no último).
- Conteúdo dividido entre QR Codes num espaço em branco; ao juntar, recoloca-se o espaço.
- Hash: `HASH1 = SHA-512(dados1)`; `HASHn = SHA-512(dados1 + " HASH:" + HASH1 + " " + dados2 + ... + " " + dadosN)`. "dados" exclui `QRBU`, `VRQR` e `VRCH`. Hex maiúsculo, 128 caracteres.
- Códigos de cargo: 1 presidente, 3 governador, 5 senador, 6 deputado federal, 7 deputado estadual.
- Por cargo: `APTA ... NOMI [LEGC] BRAN NULO TOTC`. Proporcionais têm blocos `PART LEGP TOTP`. `TOTC` é explícito.
- Senador (2 vagas): um único bloco `CARG:5`; cada eleitor dá dois votos e `TOTC` conta votos (2018: 6 eleitores, `TOTC:12`; exemplo 2026: 4 eleitores, `TOTC:8`).
- Conferência por cargo: soma dos candidatos + legendas + brancos + nulos = `TOTC`.

Só no formato 6.0: campos novos `HIQT`, `HICA`, `APTS`, `APTT`, `HBBM`, `HBBG`, `HBSB`, `CSEC`; `APTO` passa a ser o total de aptos.

Assinatura (verificado): as 6 assinaturas Ed25519 dos exemplos de 2018 são válidas com `sacqrcode.pub` (SHA-512 confere com a lista simulada; a chave tem 32 bytes crus). O Node valida sem biblioteca externa. Para 2026 não há biblioteca JS pronta para E-521, e o manual não descreve a cadeia de confiança do certificado da urna.

## Obter o texto dos QR Codes dos exemplos

Os `.imgbu` trazem o texto do relatório legível, mas o QR Code está num formato binário da impressora que não foi decifrado. O caminho que funciona: extrair as imagens dos PDFs com `pdfimages -png` (Poppler) e decodificar com `jsQR`. Os 13 QR Codes dos 6 exemplos foram lidos assim.

## Decodificador (src/bu)

Módulo isolado, sem dependência de interface, que roda no navegador e no servidor (só usa `@noble/hashes` e `@noble/curves`).

- `decodificarBU(textos, { chaves? })`: recebe o texto de todos os QR Codes (qualquer ordem, repetições iguais são descartadas), valida sequência, cadeia de hashes e somas, e devolve `{ ok: true, boletim } | { ok: false, erros }`. Cada erro tem `codigo` e uma `mensagem` em português dizendo o que corrigir.
- `lerParte(texto)`: classifica um QR Code (dados, certificado ou erro), para a câmera dar retorno a cada leitura.
- Cargos: `votos` (por número do candidato), `legenda` (por número do partido), `branco`, `nulo`, `total` (TOTC), `nominais`, `legendaTotal`, `aptos`. O nome do candidato NÃO vem do QR Code (regra do app: mostrar "Candidato NNNN" quando não houver na lista).
- Recusas do decodificador: QR Code faltando, de outra urna (número repetido com conteúdo diferente, ou cadeia de hashes que não fecha), versão desconhecida, formatos misturados, assinatura ausente ou inválida (1.5), somas que não batem, certificado de outra urna.
- Regras de política (fase oficial, UF, município, zona e seção existentes, cinco cargos presentes) ficam na camada de domínio (etapa 3), não no decodificador.
- **Não confirmado por exemplo real:** o texto dos QR Codes de certificado (`QRCE`). O parser segue a tabela do manual 2026 (`QRCE:n:x IDUE MDUE CERT`) e é tolerante; os testes usam textos sintéticos. Quando houver um BU real de 2026, conferir.

## Comandos

- `npm test`: Vitest. `npm run typecheck`: TypeScript. `npm run extrair-qr`: regera `tests/fixtures/bu-2018.json` a partir dos PDFs de exemplo (precisa do Poppler).
- Um teste extra compara o que o decodificador leu com o relatório impresso (`.imgbu`); ele só roda se `docs/tse-exemplos-boletim-urna-eleicoes-2018/` existir.
- `docs/*.pdf` e os exemplos do TSE não estão no repositório (o manual de 2018 proíbe reprodução sem autorização).

## Dados da cidade

Pesqueira (PE), 55ª Zona Eleitoral. `data/cidade/pesqueira.json` é gerado por `scripts/importar-secoes.mjs` a partir de `docs/locais.csv` (portal de dados abertos do TSE): 33 locais, 181 seções, 52.577 eleitores aptos.

- **As seções não são numeradas de 1 a N.** Vão de 26 a 259, com buracos (a zona 55 atende mais de um município). A configuração guarda a **lista explícita de seções** de cada zona, com os aptos de cada uma. O protótipo assumia "quantidade de seções", o que não vale aqui.
- Código do município no TSE (campo `MUNI` do BU): **25178, informado pela responsável pelo projeto, não confirmado por fonte independente**. Fica na configuração pública (editável). Conferir com o primeiro BU real; se o `MUNI` for outro, corrigir na configuração.
- Firebase: projeto `apuracaojuntos`, app web criado, plano Spark (Storage exige Blaze). Autenticação, Firestore e Storage ainda não ativados.
- Um BU pode cobrir seções agregadas (`AGRE`). A urna identificada é a do campo `SECA`.

## Decisões aprovadas

Aprovadas pela responsável pelo projeto:
- Decodificador aceita **somente** `VRQR:1.5` e `VRQR:6.0`; outras versões são recusadas com mensagem clara.
- **Assinatura em 2026 (`6.0`):** ponto de encaixe. O boletim é registrado como `assinatura: nao_verificada`, sem bloquear o envio. A cadeia de hashes é sempre verificada. Verificar E-521 e a confiança no certificado da urna fica para depois da eleição.
- **Assinatura em 1.5:** Ed25519 verificada só nos testes, com `sacqrcode.pub` (simulado, conferido na lista de hashes).
- Testes usam os 6 exemplos de 2018 e o exemplo pequeno do manual de 2026. O exemplo grande do manual de 2026 tem totais incoerentes e não é usado.
- Os QR Codes de certificado (`QRCE:n:x`) formam uma sequência própria, separada dos de dados (manual 2026, p. 10).

Adotadas por padrão (propostas do plano, ainda revisáveis):
- 2º turno exige os cargos configurados para o turno, não sempre os cinco.
- Em produção só `FASE:O` (oficial); simulado e treinamento só em ambiente de teste. UF e município do BU precisam bater com a configuração.
- Nos deputados, "Votos de legenda" aparece como barra neutra, com detalhe por partido; % dos candidatos sobre os válidos (nominais + legenda).

Decididas na etapa 3, substituindo propostas anteriores:
- **Login: código numérico único por pessoa, sem e-mail nem senha** (não Google). O administrador (fabricioluna@gmail.com) usa o mesmo mecanismo; o que muda é a claim `admin`. Fluxo: `POST /api/auth/entrar {codigo}` confere o hash do código em `fiscais`, devolve um **custom token** do Firebase Auth; o cliente troca por um ID token com `signInWithCustomToken`. `exigirFiscal`/`exigirAdmin` sempre conferem `ativo`/`admin` **ao vivo no Firestore** a cada requisição, não confiam só na claim do token (que pode ficar até 1h desatualizada).
- **Foto do BU: só quando o QR Code falha.** Revisto de novo: a foto volta, mas não para todo envio. Ordem de tentativa na tela de Novo boletim: (1) câmera ao vivo; (2) se uma parte não ler, foto do boletim, que também tenta decodificar um QR Code da imagem; (3) só se isso falhar, o fiscal digita a urna inteira. A foto (quando tirada) fica anexada como prova, mesmo que tenha conseguido decodificar um QR Code dela. Isso exige o Storage (plano Blaze) **em produção**; em desenvolvimento uso o emulador do Storage, sem custo. Ativar o Storage de verdade fica para perto da publicação (etapa 4/5), não bloqueia o trabalho agora.
- **Digitação é da urna inteira, nunca de um cargo isolado.** Cada QR Code é um pedaço de um texto único que descreve toda a urna (cortado só pelo tamanho, sem relação com os cargos); se uma parte falha, não dá para isolar qual cargo foi afetado. Por isso a rota `/api/boletins` só aceita OU todos os QR Codes OU os cinco cargos digitados, nunca uma mistura (já implementado na etapa 3).
- **Digitação não tem lista fixa de candidatos.** O BU real só lista quem recebeu voto, e não sabemos de antemão quem vai concorrer. A tela de digitar deixa o fiscal adicionar linhas "número do candidato + votos" livremente, para cada cargo (e "número do partido + votos de legenda" nos proporcionais), em vez de uma lista fechada como no protótipo.
- Limite de tentativas de login: 8 tentativas erradas por identificador (IP) a cada 15 minutos.

## Descoberta sobre o BU real: não existe QR Code por cargo

O protótipo simplificava "um QR Code por cargo". No formato real, os QR Codes são pedaços sequenciais de um texto único (cortados por tamanho, não por cargo). Se um QR Code está ilegível, normalmente **não dá pra aproveitar parte da leitura**: o fiscal digita o boletim inteiro, não um cargo isolado. Por isso a rota de gravação só aceita OU todos os QR Codes (decodificados de uma vez) OU todos os cinco cargos digitados — nunca uma mistura. Isso muda a tela de "Novo boletim" da etapa 4 em relação ao protótipo.

## Arquitetura do servidor (etapa 3)

- `src/domain/`: tipos, validação de política (`validar-boletim.ts`), validação dos valores digitados (`validar-digitado.ts`), comparação campo a campo e impressão digital de um boletim (`comparar.ts`) — tudo sem Firebase, testável isolado.
- `src/server/`: Admin SDK (`firebase-admin.ts`, detecta o emulador via `FIRESTORE_EMULATOR_HOST` e dispensa credencial real nesse caso), config da cidade, login (`fiscal-auth.ts`), autorização de requisição (`autenticar-requisicao.ts`), e as duas transações centrais: `gravar-boletim.ts` (regra de urna repetida/divergência) e `resolver-divergencia.ts` (decisão do administrador).
- `app/api/auth/entrar`, `app/api/boletins`, `app/api/divergencias/[id]`: rotas do App Router, funções `POST`/`PATCH` exportadas — testáveis chamando a função direto com um `Request` do Web, sem precisar do `next dev`.
- **Totais** (`totais/{turno}_{cargo}`): incrementos em campos de mapa aninhado (`votos.<numero>`, `legenda.<numero>`), com `FieldValue.increment`. **Testado no emulador:** um incremento aninhado só toca a chave indicada (não apaga as outras), funciona em documento inexistente, e duas transações concorrentes em chaves diferentes do mesmo mapa não se perdem.
- **Mapa** (`mapa/{turno}`): `{ secoes: { "<zona>-<secao>": "ok" | "div" }, ultimo }`.
- Divergência: ID determinístico `${idBoletim}_${impressãoDigital(novo)}` — mesmo envio divergente repetido nunca duplica o documento.
- `boletins/{id}/versoes/{auto}`: cópia do cadastro anterior quando o administrador escolhe "usar o novo".
- **"Lidera" e "melhor urna" (implementado na etapa 5):** ficam dentro do próprio documento de totais (`totais/{turno}_{cargo}.lidera: {numero: contagem}` e `.melhor: {numero: {votos,zona,secao}}`), calculados na mesma transação — o público nunca lê boletins individuais. Ver `src/domain/lideranca.ts` (funções puras, testadas sem emulador) e `src/server/totais.ts` (`lerMelhorAtual`, `ajustarLidera`, `aplicarMelhorUrna`). Como o Firestore exige todas as leituras antes de qualquer escrita numa transação, `gravar-boletim.ts` e `resolver-divergencia.ts` leem o "melhor" atual de cada cargo *antes* de gravar o boletim/decisão.
  - **Limitação aceita:** "melhor urna" só evolui para frente. Se uma correção de divergência *reduz* os votos de uma seção que era a melhor de algum candidato, o valor antigo fica registrado até outra urna o superar (não recalculamos varrendo todos os boletins). "Lidera" não tem essa limitação: numa correção, decrementa o vencedor antigo e incrementa o novo, exatamente.

## Scripts de operação

- `scripts/env-da-chave.mjs <chave.json>`: grava as variáveis `FIREBASE_*` no `.env.local` a partir da chave de conta de serviço baixada do console.
- `scripts/definir-config.mjs <cidade.json>`: grava `config/publico`. Variáveis `CIDADE_UF`, `CIDADE_CODIGO_MUNICIPIO`, `CIDADE_TURNO` sobrepõem os padrões (PE/25178/1).
- `scripts/cadastrar-fiscal.mjs "Nome" [--admin]`: gera um código, grava o hash em `fiscais` e imprime o código uma única vez.
- `scripts/trocar-codigo.mjs "Nome exatamente como está em fiscais"`: gera um **novo** código pra um cadastro que já existe (fiscal ou administrador), pra quando o código mostrado uma vez foi perdido. Mantém o mesmo documento (nome, claim `admin`, histórico); só troca o hash. O código antigo para de funcionar.
- Todos os quatro, com `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` definidos, gravam no emulador em vez do projeto real — é assim que os testes semeiam dados.

## Testes de servidor (emulador)

- Rodar antes: `npx firebase-tools emulators:start --only firestore,auth,storage --project apuracaojuntos` (Java já está instalado). `tests/setup-emulador.ts` aponta os testes para `127.0.0.1:8080`/`9099`/`9199`.
- **Importante:** o projeto de teste usa o **mesmo id do projeto real** (`apuracaojuntos`) de propósito. O emulador de Auth foi iniciado com `--project apuracaojuntos` e fixa esse projeto nas trocas de `signInWithCustomToken`; um id diferente (`apuracaojuntos-teste`, por exemplo) causa erro de "aud incorreto" no `verifyIdToken`. Isso é seguro: com as variáveis de emulador definidas, nada sai do computador.
- `tests/helpers/emulador.ts`: `limparEmulador()` (apaga Firestore e Auth do projeto de teste), `seedFiscal`, `loginComoFiscal` (login real de ponta a ponta: código → custom token → troca no Auth emulator → ID token).
- `tests/rules/firestore.test.ts` e `tests/rules/storage.test.ts`: `@firebase/rules-unit-testing` contra as `firestore.rules`/`storage.rules` reais.
- Os arquivos de teste rodam em série (`fileParallelism: false`): o emulador é uma instância única e paralelizar causa timeouts por contenção, não bugs.
- **Confirmado com um teste manual de ponta a ponta** (`next dev` apontado para o emulador, chamadas HTTP reais): login por código, envio de boletim (novo → igual) funcionam através do servidor de verdade, não só das funções chamadas direto.

## Etapa 4: tela de Novo boletim

- Visual migrado do protótipo para `app/globals.css` (tokens, tipografia Archivo/Instrument Sans via `next/font/google`, componentes). Ajustes feitos ao migrar: `.ao-vivo` e `.linha.subiu` perderam a animação contínua (só respondem a uma ação do usuário); `.btn.pequeno` e `.aba` subiram para 48px de altura mínima. Logos em `public/logo-verde.png` e `public/logo-roxo.png`.
- `src/ui/Cabecalho.tsx`: cabeçalho/navegação compartilhados (Apuração, Novo boletim, Administração só para admin), usado em `app/layout.tsx`. Lê a sessão via `src/client/usarSessao.ts` (nome/admin vêm das **claims do token**, não de leitura do Firestore — o cliente não tem acesso a `fiscais/*`). Corrigido na etapa 4: `autenticarFiscal` agora garante que o usuário existe no Auth *antes* de gravar a claim (`getUser` → `createUser` se preciso → `setCustomUserClaims` → `createCustomToken`), para a claim já valer desde o primeiro login, não só a partir do segundo.
- `app/novo/page.tsx`: fluxo câmera → foto → digitar (ordem de tentativa, não opções soltas — ver decisão da etapa 3). QR Codes acumulados em `partes: string[]`; a cada novo QR, roda `decodificarBU(partes)` de novo. Sucesso leva direto à conferência; `QR_FALTANDO` mostra o que falta e continua; qualquer outro erro (cadeia quebrada, urna diferente, versão desconhecida) **reinicia a leitura do zero**, porque um erro desses invalida o conjunto acumulado.
  - **Simplificação em relação ao protótipo:** não pede zona/secção antes de escanear — vem do próprio QR Code decodificado. Só a digitação pede zona/seção (via `<select>` populado por `config/publico`, lido direto do Firestore pelo cliente, que é público).
- `src/ui/DigitarBoletim.tsx`: digitação da urna inteira, sem lista fixa de candidatos (linhas "número + votos" adicionadas livremente, por cargo; "número do partido + votos de legenda" nos proporcionais). Reusa `validarCargosDigitados` (mesma validação do servidor) para conferência ao vivo no formulário.
- `src/client/leitorQr.ts`: envolve `html5-qrcode` para a câmera (`#leitor`) e para decodificar uma foto (`#leitor-oculto`, mesmo padrão do protótipo). `jsqr` continua só nos scripts Node (`scripts/extrair-qr-exemplos.mjs`), não vai para o bundle do navegador.
- **Foto do BU:** `src/client/fila-offline.ts`/`app/novo/page.tsx` sobem a foto pro Storage (`boletins/{uid}/...`) só na hora de enviar (ou de processar a fila), nunca antes — assim uma foto tirada offline não trava a captura.
- **Fila offline** (`src/client/fila-offline.ts`, IndexedDB): ao enviar, se `fetch` falhar com `TypeError` (sem rede), o boletim (payload + foto, se houver) fica salvo no aparelho; `usarFilaOffline` tenta de novo a cada 30s e no evento `online`. **Testado de ponta a ponta com Playwright** (offline forçado via `context.set_offline`): mostra o aviso "sem conexão", guarda o pendente, e envia sozinho ao voltar a conexão.
- `src/client/firebase.ts`: o SDK do **navegador** só liga nos emuladores com `NEXT_PUBLIC_USE_EMULATORS=true` (variável separada de `FIRESTORE_EMULATOR_HOST`, que só o servidor enxerga).
- **Bug real encontrado pelo teste manual:** `recomecar()` não limpava `resultadoFinal`, então "Cadastrar outra urna" não saía da tela de resultado. Corrigido.
- **Confirmado com Playwright contra `next dev` + emuladores reais** (não só chamando funções): login → digitar os 5 cargos (com e sem legenda) → conferência → envio, com verificação direta no Firestore de que `boletins`, `totais` e `mapa` ficaram corretos; e o cenário offline completo.
- **Não verificado manualmente:** a leitura por câmera ao vivo (`html5-qrcode` com `facingMode: 'environment'`) não pôde ser testada neste ambiente (sem câmera). O código segue o mesmo padrão testado do protótipo, mas **vale testar num celular de verdade antes do dia da eleição**.
- Painel do administrador (`/admin`) ainda não existe; o item de navegação só aparece pra quem tem a claim `admin`, mas a rota em si é etapa 6.

## Etapa 5: painel público em tempo real

- `app/page.tsx`: uma aba por cargo (só os do turno atual), grade de urnas coloridas por status, gráfico de barras com candidatos ordenados por votos, brancos/nulos opcionais (`mostrarBN`, não persiste entre recargas — decisão deliberada, é só uma conveniência de sessão), % sobre os votos válidos, detalhe ao tocar (lidera/melhor urna). Aviso de "totalização paralela e não oficial" sempre visível no topo.
- **Nunca lê boletins.** Só `totais/{turno}_{cargo}` (`src/client/totais.ts`, `usarTotaisCargo`) e `mapa/{turno}` (`usarMapa`), ambos via `onSnapshot` — atualiza sozinho quando um boletim novo chega, sem recarregar a página. `config/publico` dá o total de seções da cidade (para "X de M urnas apuradas") e o turno.
- **Deputados:** "Votos de legenda" some quando nenhum partido recebeu legenda ainda (`legendaTotal > 0`), e aparece como barra neutra com o detalhe por partido ao tocar, como decidido na etapa 3.
- **Nomes de candidatos:** `src/domain/candidatos.ts` (`nomeCandidato`/`nomePartido`) — a lista oficial foi importada depois da etapa 6, ver [Candidatos](#candidatos) abaixo. Quem não está na lista continua aparecendo como "Candidato NNNN"/"Partido NN".
- **Bug real encontrado pelo teste manual:** `.fill` (a barra preenchida do gráfico) é um `<span>`, que por padrão é `display: inline` — CSS ignora `width`/`height` em elementos inline não substituídos, então a barra não aparecia preenchida (só o trilho de fundo). Faltava `display: block` em `.fill`. Corrigido em `app/globals.css`; conferido pixel a pixel via `getComputedStyle` antes e depois da correção.
- **Confirmado com Playwright contra `next dev` + os três emuladores:** três urnas digitadas com candidatos e votos diferentes, painel público mostra os totais corretos e ao vivo, abas trocam de cargo, toque na barra mostra "lidera em N de M urnas" e "melhor resultado" com zona/seção corretos, grade de urnas colorida, aviso de não-oficial sempre visível.

## Preparação para a Vercel

Feito no projeto Firebase **real** (`apuracaojuntos`), não no emulador:
- Confirmado por leitura direta (Admin SDK, antes de mexer): Firestore e Authentication já estavam ativos e alcançáveis, mas vazios. Storage **não existe ainda** (confirmado: o bucket não existe — falta o plano Blaze, ver pendências abaixo).
- `firestore.rules` publicada (`firebase deploy --only firestore:rules --project apuracaojuntos`) e conferida com requisições HTTP reais e sem login: leitura pública (`config/publico`) responde 404 (não existe, mas a regra deixa ler); leitura privada (`boletins/*`) responde 403 (negada). `storage.rules` **ainda não foi publicada** — só é possível depois que o bucket existir.
- `config/publico` gravado com os dados de Pesqueira (181 seções, zona 55, turno 1). O código do município (25178) segue como no CLAUDE.md: informado pela responsável pelo projeto, não confirmado por fonte independente — editável depois pelo painel do administrador (etapa 6) se precisar corrigir.
- Conta de administrador criada em `fiscais` (nome "Fabrício Luna (administrador)", claim `admin`). O código foi mostrado uma vez, só nesta conversa — guarde num gerenciador de senhas.
- `package.json` ganhou os scripts padrão do Next.js (`dev`, `build`, `start`), que faltavam (eu vinha chamando `next dev`/`next build` direto). `vercel.json` define a região `gru1` (São Paulo), mais perto do Firestore (`southamerica-east1`) e dos eleitores.
- Código enviado ao GitHub (`fabricioluna/apuracaojuntos`, branch `main`). **O repositório está público** — decisão da responsável pelo projeto, não minha; conferi antes que nenhuma chave ou credencial está versionada.
- `storage.rules` publicada depois, quando o bucket passou a existir (plano Blaze ativado pela responsável pelo projeto). Testado com o Admin SDK gravando e apagando um arquivo real no bucket de produção.

**Bug real em produção (só na Vercel, não local): toda rota de API respondia 500 com corpo vazio.** `next build && next start` local, com as mesmas credenciais reais, funcionava perfeitamente — isolando o problema ao ambiente da Vercel, não ao código nem às credenciais. O log de runtime da Vercel revelou a causa: `firebase-admin/auth` carrega `token-verifier.js` → `utils/jwt.js` → `jwks-rsa` → `jose@6`, incondicionalmente, só de importar `getAuth` (não precisa nem chegar a usar) — e `jose@6` só existe em ESM puro, sem build CommonJS. O jeito como a Vercel empacota pacotes "externos" (a lista padrão do Next.js que inclui `firebase-admin`, pra rodar com `require()` nativo em vez de ir pro bundle) não consegue carregar um módulo ESM assim (`ERR_REQUIRE_ESM`), e isso quebra o carregamento do módulo inteiro — por isso toda rota que importa `firebase-admin/auth` falhava, mesmo em métodos/corpos que nunca chegam a usar o Firestore ou o Auth de verdade.
  - **Primeira tentativa, não resolveu:** fixar `"engines": { "node": "22.x" }` (a teoria de que seria falta de suporte do Node a `require()` de ESM). Não era isso — o projeto já rodava em Node 24.x por padrão na Vercel e o erro persistiu idêntico mesmo depois de trocar a versão; revertido.
  - **Correção de verdade:** `jwks-rsa` só usa duas funções bem estáveis do `jose` (`importJWK`, `exportSPKI`, sem mudança de assinatura entre versões). `"overrides": { "jose": "^4.15.9" }` no `package.json` força a última versão do `jose` que ainda publica build CommonJS, sem tocar no código do app. Confirmado com `require('firebase-admin/auth')` direto (sem erro) e com a suíte completa (158/158).

## Locais de votação no painel público

A pedido da responsável pelo projeto: além da grade abstrata de zona/seção, o painel público mostra **quais locais** (escola, colégio...) ainda faltam, agrupando as seções que pertencem ao mesmo local físico (um local pode ter várias seções — ex.: "Escola Arco Iris" tem as seções 26, 27, 28 e 213 em Pesqueira).

- `SecaoConfig.nomeLocal` (opcional): vem do CSV do TSE (`docs/locais.csv` → `scripts/importar-secoes.mjs` → `data/cidade/pesqueira.json`) e agora é preservado por `scripts/definir-config.mjs` ao gravar `config/publico` (antes ele descartava o campo). **Repeti a gravação em produção** para incluir os nomes que já estavam faltando lá.
- `src/domain/locais.ts` (puro, testado): agrupa por `nomeLocal`, conta apuradas/total. Seção sem nome cadastrado vira "Zona Z, seção S", para não sumir da lista.
- Conta como "tem boletim" tanto `ok` quanto `div` no mapa — a divergência em análise significa que o boletim chegou, só não foi validado ainda.
- `app/page.tsx`: lista colapsável "Locais que ainda faltam (N)", abaixo da grade, com badges tipo `Nome (apuradas/total)`. Independe do cargo selecionado (a lista de urnas com boletim é a mesma para os cinco).
- **Bug real encontrado pelo teste manual:** usei as classes `.fichas`/`.ficha` (badges) sem elas existirem no CSS — na etapa 4 eu tinha deliberadamente deixado de fora os estilos específicos da Administração do protótipo, e essas classes faziam parte desse bloco pulado. Adicionadas em `app/globals.css`. Confirmado visualmente com os 181 locais reais de Pesqueira.

## Etapa 6: painel do administrador

Priorizado como o pedido original definiu: divergências, fiscais, estatísticas e boletins primeiro (sem divergências resolvidas, elas ficam paradas para sempre); ajustes e exportação por último.

- `app/admin/page.tsx`: abas (Estatísticas, Divergências, Boletins, Fiscais, Ajustes) em uma página só, como o protótipo. Redireciona quem não é administrador.
- `src/server/admin/`: `listar-boletins.ts`, `listar-divergencias.ts`, `fiscais.ts`, `atualizar-config.ts` — só o servidor lê `boletins`/`divergencias`/`fiscais` (privados); o cliente sempre passa por `app/api/admin/*`, todas atrás de `exigirAdmin`.
- **Divergências**: `listarDivergencias()` lê o cadastro atual de cada urna na hora (não confia no que ficou salvo dentro do documento da divergência, que pode estar desatualizado se outra divergência da mesma urna já foi resolvida). Resolver reusa a mesma `resolverDivergencia` da etapa 3.
- **Fiscais**: cadastrar mostra o código uma única vez (não fica salvo em lugar nenhum, igual ao script `cadastrar-fiscal.mjs`, que continua valendo para quem preferir a linha de comando). Desativar/reativar é um `PATCH`.
- **Estatísticas**: urnas apuradas, divergências pendentes, envios por 30 min e por fiscal (`src/domain/estatisticas.ts`, puro), brancos/nulos por cargo (lidos direto de `totais/*`, público, sem rota própria), locais que faltam (reusa `src/domain/locais.ts` da etapa 5).
- **Ajustes**: só o turno é editável pela interface (crítico para a transição pro 2º turno). Zonas/seções ficam **só leitura** aqui, de propósito — nosso modelo real guarda aptos e nome do local por seção (não uma contagem simples como o protótipo), e um formulário simples de reimportação poderia apagar esses dados sem querer. Trocar zonas continua sendo `scripts/definir-config.mjs`. Não incluí um botão de "apagar todos os dados": era só um recurso de demonstração do protótipo (ligado ao localStorage), perigoso demais para um Firestore de verdade, e não fazia parte do pedido original.
- **Bug real encontrado pelo teste manual:** a lista de Boletins não sinalizava quando uma urna tinha divergência pendente (só mostrava "Confere" ou "Validado", igual pra uma urna com problema aguardando validação). `listarBoletins` passou a cruzar com as divergências pendentes; a coluna Situação agora mostra "Divergência pendente" também.
- **Deixado de fora, como combinado:** exportação em Excel/CSV. Pode ser feita direto pelo console do Firebase por enquanto.
- 153 testes automatizados + as cinco abas conferidas com Playwright contra `next dev` e os três emuladores (divergência criada e resolvida lado a lado, fiscal cadastrado e desativado, estatísticas com dados reais, boletim aberto com detalhe por cargo, turno trocado).

## Candidatos

A responsável pelo projeto colocou em `docs/` quatro planilhas exportadas do portal de dados abertos do TSE (uma por cargo majoritário/proporcional de Pernambuco: governador, senador, deputado federal, deputado estadual). Presidente não tem planilha por UF (é nacional).

- `scripts/importar-candidatos.mjs docs/CANDIDATOS-PE-*.xlsx`: lê as planilhas e gera `data/candidatos.json`, que o app importa direto (`app/page.tsx`, `src/ui/admin/Boletins.tsx`). Formato: `{ [cargoId]: { [numero]: nome, [p<numeroPartido>]: siglaPartido } }`.
- **Cargo de cada planilha:** descoberto pela quantidade de dígitos do número do candidato (a mesma convenção de `src/bu/cargos.ts`) — 2 dígitos = governador, 3 = senador, 4 = deputado federal, 5 = deputado estadual. As planilhas não dizem o cargo diretamente.
- **Nome de partido:** só existe para os cargos proporcionais (federal, estadual), extraído por regex da coluna "Coligação" (ex.: `FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL(13-PT/65-PC do B/43-PV)` → `{13: PT, 65: PCdoB, 43: PV}`). **Não tentei extrair partido de governador/senador**: numa primeira tentativa, o texto da coligação desses cargos majoritários é o nome da frente (ex. "FRENTE POPULAR DE PERNAMBUCO"), não uma lista por partido — teria produzido mapeamentos errados.
- **Substituição de candidato (mesmo número, nomes diferentes):** acontece de verdade nessas planilhas — um partido pode trocar quem concorre com um número já usado por outra pessoa inapta. O script resolve preferindo a linha cuja coluna "Totalização" é "Concorrendo"; só falha se não conseguir decidir assim.
- **Presidente:** não vem de nenhum arquivo fornecido (a eleição é nacional, fora do escopo das planilhas estaduais). A lista das 12 candidaturas validadas pelo TSE está hardcoded em `PRESIDENTES`, dentro do próprio `scripts/importar-candidatos.mjs`, pesquisada em setembro de 2026 — **vale conferir a grafia do nome de urna antes de uma eleição de verdade**, já que não passou pela mesma checagem automática das planilhas.
- As planilhas originais (`docs/CANDIDATOS-PE-*.xlsx`) ficam fora do repositório (`.gitignore`, mesmo padrão de `docs/locais.csv`); só `data/candidatos.json`, já gerado, é versionado.
- `tests/domain/candidatos-data.test.ts`: confere a integridade do `data/candidatos.json` gravado (cinco cargos presentes, presidente com exatamente 12 candidatos, dígitos do número batendo com o cargo, só proporcionais têm partido, nenhum nome vazio). Não testa o script em si, que depende das planilhas fora do repositório.
- **Bug real encontrado ao ligar a lista:** tanto `app/page.tsx` quanto `src/ui/admin/Boletins.tsx` tinham uma chamada a `nomePartido({}, cargoId, n)` com um objeto vazio fixo no lugar da lista de verdade — invisível até agora porque a lista sempre foi vazia mesmo (`{}`). Corrigido nos dois lugares para usar a lista importada.
- Confirmado visualmente com Playwright, painel público e painel do administrador: "LULA 13" (Presidente) e "AUGUSTO COUTINHO 1000" (Deputado federal) aparecendo corretos nos dois.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
