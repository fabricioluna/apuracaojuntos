// Painel público provisório. O gráfico por cargo e os totais em tempo real entram na etapa 5.
export default function PaginaInicial() {
  return (
    <main>
      <div className="pilha">
        <div className="aviso-oficial">
          <p>
            <strong>Totalização paralela e não oficial.</strong> Os números vêm dos boletins de urna enviados por
            fiscais e voluntários. O resultado oficial é o divulgado pelo TSE.
          </p>
        </div>
        <section className="painel vazio">
          <h1>Apuração</h1>
          <p className="lead">Em construção — o painel público com os totais em tempo real chega na próxima etapa.</p>
        </section>
      </div>
    </main>
  );
}
