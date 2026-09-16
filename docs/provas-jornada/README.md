# Prova de tela da Jornada de Midgard

Colhida em 08/09/2026 pela `tests/provas/foto-da-jornada.mjs`, na branch
`feat/tutorial-jornada-midgard`.

```bash
node tests/provas/foto-da-jornada.mjs
```

O arnês monta a janela do Códex sozinha num Chromium - host com
`data-gui-component` e `ri-janela`, shadow aberto, `Common.css` dentro **e
fora** do shadow, `CodexIdle.css`, `CodexIdle.html` - e põe no corpo o HTML
que `src/UI/Components/CodexIdle/jornadaHtml.js` produz de verdade. Não é uma
segunda tela escrita para a foto: é o código que roda no jogo, com um
`contexto` de exemplo.

**O que ela mede sozinha** (e reprova): PNG grande demais para estar vazio,
página sem rolagem horizontal, pino e etiqueta dentro do mapa, alvo de 44px no
celular, as quatro palavras de estado presentes, as quatro formas de selo
presentes, contador escrito com "de" e nunca com "/", e as três frases de
recusa de viagem. Os números estão em `medidas.json`.

**O que ela NÃO prova, e nada aqui deve ser lido como se provasse:**

- **o retrato é de EXEMPLO**, montado à mão conforme a seção 5 do
  `docs/CONTRATO-JORNADA.md` do repositório do servidor. O servidor da frente B
  não existia quando isto foi colhido, então nenhuma destas fotos prova que ele
  manda este JSON;
- **nenhum pacote foi ao fio**: `{acao:'capitulo'}` e `CZ_RAGIDLE_VIAJAR` são
  chamados pelo código da janela, mas aqui não há servidor para responder;
- **a aba "Códex" da foto 07 é parcial**: o arnês desenha só a lista de
  entradas (que é onde entram os chips de espécie, a metade nova da ponte). Os
  sete eixos e o botão "+" não foram tocados nesta rodada e não estão na foto.

Regra 5 do projeto: contar elemento não prova que dá para ver. **Olhe os PNG.**

## As fotos

| arquivo | o que mostra |
|---|---|
| `01-mapa-desktop.png` | **Tela A** - o mapa-múndi de Midgard com os capítulos como lugares. Pino por estado (disco cheio / meio / vazado / tracejado), o capítulo atual com anel dourado, a legenda dos quatro estados, e a nota do capítulo que **não** ganhou pino |
| `02-jornada-inteira-desktop.png` | **Tela C** - todos os capítulos na ordem, com a fita "PRÓXIMO PASSO" no capítulo atual, o lugar do mapa ao lado do título e a barra de progresso |
| `03-capitulo-desktop.png` | **Tela B** - a lista do capítulo no desenho de `quests.jpg`: imagem do monstro, nome, mapa, contador escrito ("40 de 40"), recompensa visível e **uma** ação principal. Traz **os quatro estados** e **duas** das três recusas de viagem ("Você já está neste mapa", "Este mapa abre no Nv. 80 - você está no Nv. 42") |
| `04-capitulo-morto-desktop.png` | a terceira recusa: **personagem morto**. Todo botão de viagem apagado, com o motivo escrito ao lado - e não escondido num `title`, que o dedo não alcança |
| `05-especie-desktop.png` | **a ponte** entrada -> missões da espécie: o Poring em dois mapas e dois capítulos, com o link de volta ao capítulo e o "Ver no Códex" de cada linha |
| `06-trancada-desktop.png` | **antes do desbloqueio**: o requisito (`requisito.titulo`), o como seguir (`requisito.comoSeguir`), o botão que abre as Missões, e o prêmio **já anunciado**. Sem fita de próximo passo e com as ações apagadas - o próximo passo ali é a missão de classe |
| `07-aba-codex-desktop.png` | a aba **Códex** com os chips de espécie clicáveis (a outra metade da ponte). Ver a ressalva acima |
| `08-mapa-celular.png` | **Tela A no celular** (393x852, com toque). A janela vira painel de tela cheia, o mapa ocupa a largura, o alvo de cada pino tem 44px e as etiquetas saem - o nome fica no `title`, na lista e no cartão do próximo passo |
| `09-jornada-inteira-celular.png` | **Tela C no celular** |
| `10-capitulo-celular.png` | **Tela B no celular** - a linha de missão empilha (selo e contador descem para a própria linha) e o botão de ação ocupa a largura |

## Os dois defeitos que ela achou antes de aprovar

Ficam registrados porque os dois eram invisíveis no código e óbvios na foto:

1. **a etiqueta do pino vazava o mapa** e era cortada pelo `overflow:hidden` -
   "7. A Caverna de Payor", sem nada dizer por quê. Consertado com a etiqueta
   trocando de âncora perto da borda (`is-a-direita` / `is-a-esquerda` /
   `is-acima`), e o disco continuando exatamente sobre a coordenada medida;
2. **o próprio arnês media o celular errado** - sem `<meta name="viewport">` o
   Chromium usa a viewport de compatibilidade (980px) e encolhe a página: as
   regras `@media (max-width:599px)` não disparavam e a foto mostrava uma
   miniatura de desktop jurando ser um celular. É a mesma cicatriz de
   "produção serve `api.html` SEM meta viewport". E, junto com ela, o
   `Common.css` precisava ir **também no documento**: a metade da regra que
   mira o host (`.ri-janela`) não alcança nada quando a folha vive só dentro
   do Shadow DOM.

## Verificação por mutação

Três mutantes, todos mortos:

| mutante | quem morreu |
|---|---|
| `contadorEscrito` volta a `3/10` | **3** testes de unidade + a prova de tela (14 linhas de reprova) |
| o desempate do pino vira o MENOS específico (`<` no lugar de `>`) | **1** teste (os esgotos viravam a cidade) |
| a guarda de `morto` em `motivoDeNaoViajar` é desligada | **2** testes |
