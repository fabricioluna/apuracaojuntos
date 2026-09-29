'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { sair } from '../client/sessao';
import { usarSessao } from '../client/usarSessao';
import { IconeBarras, IconeEscudo, IconeScan } from './icones';

const ITENS = [
  { href: '/', rotulo: 'Apuração', Icone: IconeBarras },
  { href: '/novo', rotulo: 'Novo boletim', Icone: IconeScan },
  { href: '/admin', rotulo: 'Administração', Icone: IconeEscudo, soAdmin: true },
];

export function Cabecalho() {
  const caminho = usePathname();
  const router = useRouter();
  const { sessao } = usarSessao();

  async function aoClicarUsuario() {
    if (sessao) {
      await sair();
      router.push('/');
    } else {
      router.push('/entrar');
    }
  }

  return (
    <header className="topo">
      <div className="topo-in">
        <Image className="logo" src="/logo-verde.png" alt="Construindo Juntos" width={160} height={40} priority />
        <span className="espaco" />
        <nav className="nav" aria-label="Áreas do app">
          {ITENS.filter(i => !i.soAdmin || sessao?.admin).map(({ href, rotulo, Icone }) => (
            <Link key={href} href={href} aria-current={caminho === href ? 'page' : undefined}>
              <Icone />
              <span>{rotulo}</span>
            </Link>
          ))}
        </nav>
        <button className="usuario" onClick={aoClicarUsuario} aria-label={sessao ? `${sessao.nome}. Sair` : 'Entrar'}>
          {sessao ? (
            <>
              <span className="u-nome">{sessao.nome}</span> <span className="u-sair">Sair</span>
            </>
          ) : (
            'Entrar'
          )}
        </button>
      </div>
    </header>
  );
}
