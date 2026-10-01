'use client';
// Campo de número de candidato/partido com busca por nome. A lista vem de data/candidatos.json
// (ver scripts/importar-candidatos.mjs) — é só uma ajuda pra digitar mais rápido e sem erro de
// número; continua dando pra digitar um número que não está na lista (candidato substituído depois
// da planilha, por exemplo), que é a regra do app: quem não está na lista aparece como
// "Candidato NNNN" (ver src/domain/candidatos.ts).
import { useEffect, useId, useMemo, useRef, useState } from 'react';

const MAX_SUGESTOES = 8;

function normalizar(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function SeletorCandidato({
  rotulo,
  lista,
  numero,
  onEscolher,
}: {
  rotulo: string;
  lista: Record<string, string>;
  numero: string;
  onEscolher: (numero: string) => void;
}) {
  const idBase = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState(() => (numero && lista[numero] ? `${numero} — ${lista[numero]}` : numero));
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);

  // Se o número mudar por fora (ex.: linha reaproveitada), atualiza o texto mostrado.
  useEffect(() => {
    setTexto(numero && lista[numero] ? `${numero} — ${lista[numero]}` : numero);
  }, [numero, lista]);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const sugestoes = useMemo(() => {
    const busca = normalizar(texto.trim());
    if (!busca) return [];
    const todas = Object.entries(lista);
    const porNumero = todas.filter(([n]) => n.startsWith(texto.trim()));
    const porNome = todas.filter(([n, nome]) => !n.startsWith(texto.trim()) && normalizar(nome).includes(busca));
    return [...porNumero, ...porNome].slice(0, MAX_SUGESTOES);
  }, [texto, lista]);

  function escolher(n: string) {
    setTexto(lista[n] ? `${n} — ${lista[n]}` : n);
    onEscolher(n);
    setAberto(false);
  }

  function aoSairDoCampo() {
    // Sem seleção na lista: usa só os dígitos digitados como número (candidato fora da lista).
    const digitos = texto.trim().match(/^\d+/)?.[0] ?? '';
    if (digitos && lista[digitos]) escolher(digitos);
    else {
      setTexto(digitos);
      onEscolher(digitos);
    }
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestaque(d => Math.min(d + 1, sugestoes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaque(d => Math.max(d - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      escolher(sugestoes[destaque]![0]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  }

  return (
    <div className="campo seletor-candidato" ref={raiz}>
      <label htmlFor={idBase}>{rotulo}</label>
      <input
        id={idBase}
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Número ou nome"
        value={texto}
        onChange={e => {
          setTexto(e.target.value);
          setDestaque(0);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={aoSairDoCampo}
        onKeyDown={aoTeclar}
      />
      {aberto && sugestoes.length > 0 && (
        <ul className="sugestoes" role="listbox">
          {sugestoes.map(([n, nome], i) => (
            <li key={n} role="option" aria-selected={i === destaque}>
              <button type="button" className={i === destaque ? 'destaque' : ''} onMouseDown={e => e.preventDefault()} onClick={() => escolher(n)}>
                <span className="num">{n}</span> {nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
