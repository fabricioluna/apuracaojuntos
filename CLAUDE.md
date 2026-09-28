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

## Dados da cidade

Pesqueira (PE), 55ª Zona Eleitoral. `data/cidade/pesqueira.json` é gerado por `scripts/importar-secoes.mjs` a partir de `docs/locais.csv` (portal de dados abertos do TSE): 33 locais, 181 seções, 52.577 eleitores aptos.

- **As seções não são numeradas de 1 a N.** Vão de 26 a 259, com buracos (a zona 55 atende mais de um município). A configuração guarda a **lista explícita de seções** de cada zona, com os aptos de cada uma. O protótipo assumia "quantidade de seções", o que não vale aqui.
- Pendente: código do município no TSE (campo `MUNI` do BU) para validar que o BU é de Pesqueira.
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
- Login dos fiscais por Google, restrito à lista de fiscais.
- Nos deputados, "Votos de legenda" aparece como barra neutra, com detalhe por partido; % dos candidatos sobre os válidos (nominais + legenda).
