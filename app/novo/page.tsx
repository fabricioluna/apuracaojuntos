'use client';
// Novo boletim: câmera primeiro, foto do boletim se uma parte não ler, digitar a urna inteira só
// como último recurso. Ver CLAUDE.md > "Descoberta sobre o BU real" para por que não existe leitura
// nem digitação por cargo isolado.
import { ref, uploadBytes } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { decodificarBU } from '../../src/bu';
import { CARGOS_ORDEM, NOME_CARGO } from '../../src/bu/cargos';
import type { BoletimDecodificado, CargoId } from '../../src/bu/types';
import { usarConfigCidade } from '../../src/client/config';
import { salvarPendente } from '../../src/client/fila-offline';
import { clientStorage } from '../../src/client/firebase';
import { iniciarCamera, lerArquivo, pararCamera } from '../../src/client/leitorQr';
import { lerBoletimComIA, type SugestaoCargo } from '../../src/client/lerBoletimIA';
import { chamarApi } from '../../src/client/sessao';
import { usarFilaOffline } from '../../src/client/usarFilaOffline';
import { usarSessao } from '../../src/client/usarSessao';
import { nomeCandidato, nomePartido, type ListaCandidatos } from '../../src/domain/candidatos';
import type { CargoEntrada } from '../../src/domain/types';
import { DigitarBoletim } from '../../src/ui/DigitarBoletim';
import { IconeCheck, IconeFoto, IconeScan, IconeTeclado } from '../../src/ui/icones';
import candidatosJson from '../../data/candidatos.json';

const CANDIDATOS = candidatosJson as ListaCandidatos;

type Vista = 'leitura' | 'digitar-urna' | 'digitar-cargos' | 'conferencia';
type OrigemBoletim = { tipo: 'qr'; boletim: BoletimDecodificado } | { tipo: 'digitado'; zona: number; secao: number; turno: 1 | 2; cargos: Partial<Record<CargoId, CargoEntrada>> };

export default function PaginaNovoBoletim() {
  const { sessao, carregando } = usarSessao();
  const { config } = usarConfigCidade();
  const router = useRouter();
  const fila = usarFilaOffline();

  const [vista, setVista] = useState<Vista>('leitura');
  const [partes, setPartes] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok' | 'aviso'; texto: string } | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [fotos, setFotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [lendoIA, setLendoIA] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState<Partial<Record<CargoId, SugestaoCargo>> | null>(null);
  const [zonaDigitado, setZonaDigitado] = useState('');
  const [secaoDigitado, setSecaoDigitado] = useState('');
  const [origem, setOrigem] = useState<OrigemBoletim | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState<{ tipo: 'ok' | 'aviso'; texto: string } | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!carregando && !sessao) router.replace('/entrar');
  }, [carregando, sessao, router]);

  // Pesqueira só tem uma zona (55): preenche sozinho e nem mostra a escolha pro fiscal. Se um dia
  // uma cidade tiver mais de uma zona, o seletor volta a aparecer (ver vista "digitar-urna").
  useEffect(() => {
    if (config?.zonas.length === 1 && !zonaDigitado) setZonaDigitado(String(config.zonas[0]!.zona));
  }, [config, zonaDigitado]);

  // Decodifica de novo a cada QR Code novo. Sucesso leva direto para a conferência.
  useEffect(() => {
    if (partes.length === 0) return;
    const r = decodificarBU(partes);
    if (r.ok) {
      pararCamera();
      setEscaneando(false);
      setOrigem({ tipo: 'qr', boletim: r.boletim });
      setVista('conferencia');
      return;
    }
    const erro = r.erros[0]!;
    if (erro.codigo === 'QR_FALTANDO') {
      setMensagem({ tipo: 'aviso', texto: erro.mensagem });
    } else {
      // Cadeia quebrada, QR de outra urna, versão desconhecida etc.: o conjunto lido não presta mais.
      setMensagem({ tipo: 'erro', texto: `${erro.mensagem} Recomeçando a leitura.` });
      setPartes([]);
    }
  }, [partes]);

  async function aoAbrirCamera() {
    setEscaneando(true);
    setMensagem({ tipo: 'aviso', texto: 'Abrindo a câmera…' });
    try {
      await iniciarCamera('leitor', texto => {
        setPartes(atual => (atual.includes(texto) ? atual : [...atual, texto]));
      });
      setMensagem({ tipo: 'aviso', texto: 'Câmera aberta. Aponte para um QR Code do boletim.' });
    } catch {
      setEscaneando(false);
      setMensagem({ tipo: 'erro', texto: 'Não consegui abrir a câmera. Libere a permissão ou use a foto do boletim.' });
    }
  }
  async function aoFecharCamera() {
    await pararCamera();
    setEscaneando(false);
  }

  async function aoEscolherFotos(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    const lista = Array.from(arquivos);
    setFotos(atual => [...atual, ...lista.map(a => ({ blob: a, url: URL.createObjectURL(a) }))]);
    let achouQr = false;
    for (const arquivo of lista) {
      const texto = await lerArquivo('leitor-oculto', arquivo);
      if (texto) {
        achouQr = true;
        setPartes(atual => (atual.includes(texto) ? atual : [...atual, texto]));
      }
    }
    setMensagem(
      achouQr
        ? { tipo: 'ok', texto: 'Consegui ler um QR Code numa das fotos. As fotos continuam anexadas como prova.' }
        : { tipo: 'aviso', texto: 'As fotos ficaram anexadas, mas não achei um QR Code legível nelas. Tente ler os que faltam, adicionar mais fotos, ou digite os valores.' },
    );
  }

  function removerFoto(indice: number) {
    setFotos(atual => atual.filter((_, i) => i !== indice));
  }

  async function aoLerComIA() {
    if (fotos.length === 0) return;
    setLendoIA(true);
    setMensagem({ tipo: 'aviso', texto: fotos.length > 1 ? 'Lendo as fotos com IA…' : 'Lendo a foto com IA…' });
    try {
      const r = await lerBoletimComIA(fotos.map(f => f.blob));
      setSugestaoIA(r.cargos);
      setMensagem(
        r.avisos.length
          ? { tipo: 'aviso', texto: `${r.avisos[0]} Confira todos os valores contra o papel antes de enviar.` }
          : { tipo: 'ok', texto: 'Consegui ler a(s) foto(s). Confira cada valor contra o boletim impresso antes de continuar.' },
      );
      setVista('digitar-urna');
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não consegui ler essa(s) foto(s) com IA. Tente de novo ou digite os valores.' });
    } finally {
      setLendoIA(false);
    }
  }

  function recomecar() {
    pararCamera();
    setEscaneando(false);
    setPartes([]);
    setFotos([]);
    setSugestaoIA(null);
    setOrigem(null);
    setMensagem(null);
    setZonaDigitado('');
    setSecaoDigitado('');
    setResultadoFinal(null);
    setVista('leitura');
  }

  function aoTerminarDigitacao(cargos: Partial<Record<CargoId, CargoEntrada>>) {
    setOrigem({ tipo: 'digitado', zona: Number(zonaDigitado), secao: Number(secaoDigitado), turno: config!.turno, cargos });
    setVista('conferencia');
  }

  async function aoEnviar() {
    if (!origem || !sessao) return;
    setEnviando(true);
    try {
      const payload: Record<string, unknown> =
        origem.tipo === 'qr' ? { partes } : { zona: origem.zona, secao: origem.secao, turno: origem.turno, digitado: paraDigitadoBruto(origem.cargos) };
      try {
        let corpo = payload;
        if (fotos.length > 0) {
          const caminhos = await Promise.all(
            fotos.map(async f => {
              const caminho = `boletins/${sessao.uid}/${crypto.randomUUID()}.jpg`;
              await uploadBytes(ref(clientStorage, caminho), f.blob, { contentType: 'image/jpeg' });
              return caminho;
            }),
          );
          corpo = { ...payload, fotoPaths: caminhos };
        }
        const r = await chamarApi<{ resultado: { status: string; fiscalNome?: string } }>('/api/boletins', { method: 'POST', body: JSON.stringify(corpo) });
        anunciarResultado(r.resultado);
      } catch (e) {
        if (e instanceof TypeError) {
          await salvarPendente(payload, sessao.uid, fotos.map(f => f.blob));
          setResultadoFinal({ tipo: 'aviso', texto: 'Sem conexão agora. O boletim ficou guardado neste aparelho e será enviado sozinho quando a internet voltar.' });
        } else {
          throw e;
        }
      }
    } catch (e) {
      setResultadoFinal({ tipo: 'aviso', texto: e instanceof Error ? e.message : 'Não consegui enviar. Tente de novo.' });
    } finally {
      setEnviando(false);
      fila.processar();
    }
  }

  function anunciarResultado(resultado: { status: string; fiscalNome?: string }) {
    if (resultado.status === 'novo') setResultadoFinal({ tipo: 'ok', texto: 'Boletim cadastrado. Entrou na apuração.' });
    else if (resultado.status === 'igual') setResultadoFinal({ tipo: 'ok', texto: `Essa urna já tinha sido cadastrada por ${resultado.fiscalNome}, com os mesmos números. Nada foi somado de novo.` });
    else setResultadoFinal({ tipo: 'aviso', texto: 'Essa urna já existe e os números não batem. Avisei o administrador, que vai validar. A apuração segue com o cadastro anterior.' });
  }

  const exigidos = useMemo(() => config?.cargosPorTurno[config.turno] ?? CARGOS_ORDEM, [config]);

  if (carregando || !sessao) return null;

  if (resultadoFinal) {
    return (
      <main>
        <section className="painel vazio">
          <h1>Novo boletim</h1>
          <p className={`msg ${resultadoFinal.tipo === 'ok' ? 'ok' : 'aviso'}`} role="status">
            {resultadoFinal.texto}
          </p>
          <button className="btn" onClick={recomecar}>
            Cadastrar outra urna
          </button>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="pilha">
        {fila.itens.some(i => i.status !== 'enviado') && (
          <div className="msg aviso" role="status">
            {fila.itens.filter(i => i.status === 'pendente').length} boletim(ns) deste aparelho ainda não foi(ram) enviado(s). Assim que a conexão voltar, envio sozinho.
          </div>
        )}

        {vista === 'leitura' && (
          <section className="painel">
            <h1>Novo boletim</h1>
            <p className="lead">
              Leia os QR Codes do boletim com a câmera. Se algum não ler, tire ou escolha uma foto — dá pra tentar ler os números com IA a partir dela. Se o boletim for
              comprido e não couber numa foto só, tire mais de uma (ou escolha várias de uma vez): a IA junta as informações das fotos antes de sugerir os valores. Se
              nem assim der certo, digite os valores.
            </p>
            <div className="leitura">
              <div className="linha-botoes">
                {!escaneando ? (
                  <button className="btn" onClick={aoAbrirCamera}>
                    <IconeScan /> Escanear QR Code
                  </button>
                ) : (
                  <button className="btn ghost" onClick={aoFecharCamera}>
                    Fechar câmera
                  </button>
                )}
                <button className="btn ghost" onClick={() => arquivoRef.current?.click()}>
                  <IconeFoto /> {fotos.length > 0 ? 'Adicionar outra foto' : 'Foto do boletim'}
                </button>
                <button className="btn ghost" onClick={() => setVista('digitar-urna')}>
                  <IconeTeclado /> Digitar os valores
                </button>
                {/* Sem "capture": no celular, isso abre a escolha entre câmera, galeria e arquivos — com
                    "capture=environment" o Android abre a câmera direto, sem dar a opção de galeria.
                    "multiple" deixa escolher várias fotos de uma vez, pra boletim comprido demais pra
                    caber numa foto só. */}
                <input ref={arquivoRef} type="file" accept="image/*" multiple hidden onChange={e => { aoEscolherFotos(e.target.files); e.target.value = ''; }} />
              </div>
              <div className={`leitor-caixa ${escaneando ? '' : 'oculto'}`}>
                <div id="leitor" />
              </div>
              <div id="leitor-oculto" className="oculto-scan" aria-hidden />
              {mensagem && (
                <p className={`msg ${mensagem.tipo}`} role="status">
                  {mensagem.texto}
                </p>
              )}
              {fotos.length > 0 && (
                <div className="pilha">
                  {fotos.map((f, i) => (
                    <div className="foto-prova" key={f.url}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={`Foto ${i + 1} do boletim anexada`} />
                      <span>Foto {i + 1} anexada como prova.</span>
                      <button className="btn ghost pequeno" onClick={() => removerFoto(i)}>
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {fotos.length > 0 && (
                <div className="linha-botoes">
                  <button className="btn ghost" disabled={lendoIA} onClick={aoLerComIA}>
                    {lendoIA ? 'Lendo…' : 'Tentar ler os números com IA'}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {vista === 'digitar-urna' && config && (
          <section className="painel">
            <h1>Qual urna você está digitando?</h1>
            <div className="grade-urna">
              {config.zonas.length > 1 && (
                <div className="campo">
                  <label htmlFor="d-zona">Zona</label>
                  <select
                    id="d-zona"
                    value={zonaDigitado}
                    onChange={e => {
                      setZonaDigitado(e.target.value);
                      setSecaoDigitado('');
                    }}
                  >
                    <option value="">Escolha</option>
                    {config.zonas.map(z => (
                      <option key={z.zona} value={z.zona}>
                        {z.zona}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="campo">
                <label htmlFor="d-secao">Seção</label>
                <select id="d-secao" value={secaoDigitado} onChange={e => setSecaoDigitado(e.target.value)} disabled={!zonaDigitado}>
                  <option value="">Escolha</option>
                  {config.zonas
                    .find(z => String(z.zona) === zonaDigitado)
                    ?.secoes.map(s => (
                      <option key={s.secao} value={s.secao}>
                        {s.secao}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="linha-botoes">
              <button className="btn" disabled={!zonaDigitado || !secaoDigitado} onClick={() => setVista('digitar-cargos')}>
                Continuar
              </button>
              <button className="btn ghost" onClick={() => setVista('leitura')}>
                Voltar
              </button>
            </div>
          </section>
        )}

        {vista === 'digitar-cargos' && (
          <section className="painel">
            <h1>
              Zona {zonaDigitado}, seção {secaoDigitado}
            </h1>
            <p className="lead">Digite os números como estão impressos no boletim. Deixe em branco o que for zero.</p>
            <DigitarBoletim exigidos={exigidos} sugestao={sugestaoIA ?? undefined} onPronto={aoTerminarDigitacao} />
          </section>
        )}

        {vista === 'conferencia' && origem && <Conferencia origem={origem} fotos={fotos} enviando={enviando} onEnviar={aoEnviar} onVoltar={recomecar} />}
      </div>
    </main>
  );
}

function paraDigitadoBruto(cargos: Partial<Record<CargoId, CargoEntrada>>) {
  const saida: Record<string, unknown> = {};
  for (const [id, c] of Object.entries(cargos)) saida[id] = { votos: c!.votos, legenda: c!.legenda, branco: c!.branco, nulo: c!.nulo, total: c!.total };
  return saida;
}

function Conferencia({
  origem,
  fotos,
  enviando,
  onEnviar,
  onVoltar,
}: {
  origem: OrigemBoletim;
  fotos: { blob: Blob; url: string }[];
  enviando: boolean;
  onEnviar: () => void;
  onVoltar: () => void;
}) {
  const zona = origem.tipo === 'qr' ? origem.boletim.zona : origem.zona;
  const secao = origem.tipo === 'qr' ? origem.boletim.secao : origem.secao;
  const turno = origem.tipo === 'qr' ? origem.boletim.turno : origem.turno;
  const cargos = origem.tipo === 'qr' ? origem.boletim.cargos : origem.cargos;

  return (
    <section className="painel">
      <h1>Confira antes de enviar</h1>
      <p>
        <strong>
          Zona {zona}, seção {secao}, {turno}º turno.
        </strong>{' '}
        Origem: {origem.tipo === 'qr' ? 'QR Code' : 'Digitado'}.
      </p>
      {origem.tipo === 'qr' && origem.boletim.assinatura === 'nao_verificada' && (
        <p className="msg aviso" role="status">
          Assinatura digital não verificada nesta versão do boletim.
        </p>
      )}
      <div className="pilha">
        {CARGOS_ORDEM.filter(id => cargos[id]).map(id => {
          const c = cargos[id]!;
          return (
            <details className="cargo-conf" key={id}>
              <summary>
                {NOME_CARGO[id]}
                <span>{c.total} votos</span>
              </summary>
              <table>
                <tbody>
                  {Object.entries(c.votos).map(([n, v]) => (
                    <tr key={n}>
                      <td>
                        {nomeCandidato(CANDIDATOS, id, n)} <span style={{ color: 'var(--muted)' }}>{n}</span>
                      </td>
                      <td className="n">{v}</td>
                    </tr>
                  ))}
                  {Object.entries(c.legenda).map(([n, v]) => (
                    <tr key={`l${n}`}>
                      <td>
                        Legenda: {nomePartido(CANDIDATOS, id, n)} <span style={{ color: 'var(--muted)' }}>{n}</span>
                      </td>
                      <td className="n">{v}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Brancos</td>
                    <td className="n">{c.branco}</td>
                  </tr>
                  <tr>
                    <td>Nulos</td>
                    <td className="n">{c.nulo}</td>
                  </tr>
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
      {fotos.length > 0 && (
        <div className="pilha">
          {fotos.map((f, i) => (
            <div className="foto-prova" key={f.url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={`Foto ${i + 1} do boletim`} />
              <span>{fotos.length > 1 ? `Foto ${i + 1} será guardada como prova.` : 'A foto será guardada como prova.'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="linha-botoes">
        <button className="btn" disabled={enviando} onClick={onEnviar}>
          <IconeCheck /> {enviando ? 'Enviando…' : 'Confirmar e enviar'}
        </button>
        <button className="btn ghost" disabled={enviando} onClick={onVoltar}>
          Voltar e recomeçar
        </button>
      </div>
    </section>
  );
}
