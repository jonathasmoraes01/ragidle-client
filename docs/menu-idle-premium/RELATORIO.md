# Configuração idle - redesenho premium (29/09/2026)

Evolução visual do menu Idle (`IdleConfig`) na direção "Ragnarok clássico + premium
discreto + clean + fantasia medieval refinada", em cima da estrutura já existente
(header com interruptor-mestre, trilho de seções, cartões, rodapé com Aplicar) -
sem trocar o esqueleto por outro, só refinando o acabamento e fechando três lacunas
que o briefing pedia explicitamente: marca de pendência por seção, estados visuais
do Aplicar e alvo de toque no celular.

## Método de prova

Sem servidor nenhum: um arnês Playwright monta o **mesmo Shadow DOM que o
`GUIComponent` monta em produção** (host → `attachShadow` → `<style>Common.css</style>`
→ `<style>IdleConfig.css</style>` → `<div class="ui-component-root">` com o
`IdleConfig.html` real), com um `contexto`/`editConfig`/`serverConfig` de exemplo no
lugar do servidor. Os ícones vêm do `RiIcones` real (import direto do
`src/UI/ri-icones.js`, sem duplicar glifo), e o resumo de cada seção + a marca de
pendência vêm das funções REAIS de `secoesDaConfig.js` (`resumoDaSecao`,
`secaoPendente`, `contarAlteracoes` - nenhuma reescrita, import direto). Só os
`render*()` que moram em `IdleConfig.js` (que puxa `Renderer`/`Client`/`Network`, pesado
demais para rodar fora do jogo) foram portados à mão para o arnês, copiando o
template literal por literal - está registrado no início do script, que não foi
commitado (era `rag-idle-master/_harness-menu-idle-premium.mjs`, script descartável,
apagado no fim da sessão; o `rag-idle-master` não faz parte desta entrega).

Cada screenshot é do **elemento** (`locator.screenshot()`), não da viewport inteira,
em `deviceScaleFactor: 2`. Duas armadilhas do próprio arnês por pouco escondiam bug
de verdade:

1. **`isMobile: true` sem `<meta name=viewport>` na página** faz o Chromium assumir
   layout viewport de 980px (o padrão de "site não responsivo"), não a largura do
   aparelho - a primeira rodada mediu 390px de tela e `innerWidth: 980` por baixo,
   e o modo "janela vira painel de tela cheia" (D-932, `Common.css`) nunca ligava.
   Corrigido com a MESMA tag que o jogo real já carrega (`applications/api/api.html`).
2. **Common.css só dentro do Shadow DOM não basta**: a marca `.ri-janela` mora no
   HOST, fora de qualquer shadow, e um seletor de classe comum dentro de um
   `<style>` de shadow não alcança pra fora dele (só `:host` alcança). Em produção
   o `UIManager` injeta uma cópia de `Common.css` no `<head>` do documento por esse
   motivo exato - o arnês passou a fazer o mesmo (`page.addStyleTag`).

Com as duas corrigidas, o modo D-932 ligou de verdade e a prova passou a medir o
que o celular vê, não uma janela de desktop encolhida por engano.

## Rodadas 1-2 (a dupla exigida pelo briefing original)

**Rodada 1** (30 fotos: 5 seções × 6 tamanhos) achou CINCO defeitos reais, todos
antes de qualquer coisa deste redesenho existir - o trilho de pendência e os
estados do Aplicar são novos e nasceram sem estes problemas, mas a prova cobriu a
janela INTEIRA, não só o que eu escrevi:

| # | Onde | O que a foto mostrou | Causa | Conserto |
|---|---|---|---|---|
| 1 | Caçada, 360-430px | Nome do monstro **sumia por completo** nos chips (só avatar + marca) | `.ic-presas` (grade de monstros) ficava em 2 colunas no celular; só `.ic-presas--itens` (filtro de coleta) tinha a regra de 1 coluna | `.ic-presas` (as duas variantes) vira 1 coluna abaixo de 599px |
| 2 | Sobrevivência, 360-430px | "HP abaixo de 60%" quebrava em 3 linhas; `<select>` "Com os dois marcados" mostrava só "basta…" | `.ic-duas` (sentar\|levantar, poção HP\|SP) continuava 2 colunas no celular | `.ic-duas` vira 1 coluna abaixo de 599px |
| 3 | Suporte, 360-430px | **Nome do buff sumia**, segmentado "Só eu/Grupo" **sobrepondo** os selos de nível/duração/custo, botão de remover flutuando meio pra fora do cartão | `.ic-rot-row`/`.ic-buff-row` não quebravam linha - 4-5 filhos de largura fixa competindo pela mesma fileira estreita | A fileira quebra: medalhão+nome na 1ª linha, segmentado/ações na 2ª (linha própria, alinhada à direita) |
| 4 | Todo o celular | Botão Aplicar com 33-34px de altura | Só o `padding` do `.ri-btn`, sem piso - o mesmo defeito bateria em qualquer botão novo | `min-height` de 44px+2 no grupo de controles de texto corrido |
| 5 | Caçada/Ataque/Suporte/Sobrevivência/Consumíveis, 430px | A faixa-mestre ("Caça automática") tinha só **30px** de altura clicável | Em 430px o rótulo cabe numa linha só (não quebra como em 360px) e a etiqueta encolhe | `.ic-master-switch` entrou no mesmo grupo de `min-height` |

Os itens 1, 2 e 3 são falhas **pré-existentes** do desenho anterior (o comentário
que já existia no CSS para `.ic-presas--itens` registra que o MESMO defeito já
tinha acontecido ali uma vez - só não tinha sido visto na grade de monstros nem em
`.ic-duas`/`.ic-rot-row`, porque ninguém tinha fotografado por dentro do Shadow DOM
em 360-430px antes). Os itens 4 e 5 são alvo de toque, exigência explícita deste
redesenho.

**Rodada 2 (a primeira desta dupla)** repetiu as mesmas 30 fotos + as 4 do botão
Aplicar e confirmou: zero problemas nos cinco defeitos da tabela acima. Essa rodada
foi revisada pelo dono, que aprovou o desktop e pediu uma TERCEIRA rodada, descrita
abaixo, só para o celular e para o texto.

## Rodada 3 (celular: a barra lateral vira faixa; texto corrigido)

O dono aprovou o desktop ("bonito, coeso, fiel ao HUD") e devolveu quatro achados
novos, todos do celular, mais uma rodada de texto: o servidor mudou de regra na
mesma entrega (presa desmarcada não leva mais golpe nenhum, nem de autodefesa; o
interruptor-mestre passou a governar TODA ação automática, não só a caçada), e a
tela tinha frases que descreviam o comportamento ANTIGO.

| # | Onde | O que o dono apontou | Conserto |
|---|---|---|---|
| 6 | Celular inteiro | O trilho lateral ocupava ~42% da tela (150px em 360px) e espremia o conteúdo numa coluna estreita - "o sidebar inútil que o plano proíbe" | O MESMO `.ic-rail` (mesmos elementos, mesmo `data-tab`) vira uma faixa HORIZONTAL de chips abaixo do cabeçalho, com rolagem própria (nunca a página) e o chip ativo entrando em vista sozinho na troca |
| 7 | Caçada, celular | "Todas"/"Nenhuma" viraram ovais grandes (a régua genérica de `min-height:46px` numa caixa estreita) | Receita própria: altura 44-45px, padding horizontal generoso (a forma de pílula vem da LARGURA, não da altura) |
| 8 | Cabeçalho, celular | "Caça automática" quebrava em duas linhas, o selo "ATIVO" ficava solto, e a placa do mapa espremia o interruptor | `.ic-master` empilha (interruptor em cima, placa embaixo, cada um com a largura inteira) e `.ic-master-label` ganhou `flex-wrap` pro selo cair numa linha própria em vez de espremer o texto |
| 9 | Texto (Caçada, interruptor-mestre, Descanso) | Frases prometiam autodefesa contra presa desmarcada e "caça sozinha" sem dizer que TUDO depende do interruptor - o servidor mudou de regra na mesma entrega | Ver a tabela de texto abaixo |

**A tabela de texto** (`d` do pedido do dono):

| Onde | Antes | Depois |
|---|---|---|
| Nota das presas (Caçada) | "A desmarcada continua agressiva: o personagem se defende dela, mas não vai atrás." (FALSO: virou "nunca leva golpe nenhum") | "Só as marcadas são caçadas. A desmarcada nunca é atacada sozinha, nem se ela atacar você - só o seu clique ataca." |
| Interruptor-mestre, ligado | "O personagem caça sozinho neste mapa." | "O personagem caça, cura, bebe poção, descansa e usa buffs sozinho." |
| Interruptor-mestre, desligado | "Parada - o personagem só se defende até você ligar." (também falso: nem defesa sobra) | "Parado - nada age sozinho: nem poção, nem descanso, nem buff, nem coleta." |
| Descanso | "um monstro agressivo interrompe o descanso" (vale só pra presa MARCADA, não pra qualquer agressivo) | "um monstro marcado que ataca interrompe o descanso" |
| Sobrevivência e Consumíveis | (nada dizia que dependiam do interruptor) | Nota "Só funciona com a Caça automática ligada." + o conteúdo da seção em `grayscale(1)`/55% quando o interruptor está desligado - os campos continuam editáveis, só a pintura avisa que não vale AGORA |

Busquei outras frases do arquivo com "agressiv", "autodefesa", "sozinho", "se
defende" (`grep` no arquivo inteiro) - as demais (cura por habilidade, poção
automática, "Usar Asa de Mosca sozinho") descrevem o que a PRÓPRIA função faz
quando ativa, não prometem nada sobre presa desmarcada nem escondem a dependência
do interruptor-mestre (essa dependência agora está coberta pela nota de seção em
Sobrevivência/Consumíveis - Ataque e Suporte não pediram a mesma nota porque já
são, pelo próprio nome, o conteúdo da caçada/do que ela sustenta).

**Rodada 4 (confirmação da 3)**: as mesmas 30 fotos + as 2 extras de "interruptor
desligado" (Sobrevivência e Consumíveis apagados) mediram, de novo, **zero
problemas** - a faixa horizontal rola por dentro dela mesma em TODOS os tamanhos
móveis (`railOverflow: true` nos quinze casos, `overflow` de página `false` nos
trinta), "Todas"/"Nenhuma" em 44px de altura com largura pelo texto, cabeçalho sem
quebra de linha, todo alvo de toque ≥ 44px. Tabela em
[`tabela-medicoes.md`](tabela-medicoes.md), números crus em
[`medicoes-rodada2b.json`](medicoes-rodada2b.json).

## Decisões de design

- **Item ativo do trilho**: parou de ser um retângulo azul chapado do tamanho de um
  cartão (o pedido explícito do briefing: "destaque elegante, não apenas um azul
  chapado simples"). Virou vidro claro com um tom de ouro suave + uma barra fina
  azul embutida na borda esquerda (`box-shadow: inset`) + o medalhão do glifo em
  azul - a MESMA dupla hairline-azul/aro-dourado da janela inteira, só em escala de
  card. O azul continua sendo a cor de seleção em TODO o resto do jogo (chip,
  segmentado, checkmark) - só a fileira de 150px de largura, que é onde o chapado
  lia como "admin de SaaS", mudou.
- **Ponto de pendência por seção** (`.ic-tab.tem-pendencia`): um ponto âmbar (a MESMA
  cor de "N alterações sem aplicar" no rodapé) ao lado do nome da seção, aceso
  quando o CAMPO daquela seção diverge do que o servidor aceitou - não quando o
  rascunho inteiro mudou (`CAMPOS_DA_SECAO` em `secoesDaConfig.js`, com teste
  cobrindo o caso da cura, que escreve em `rotacao` mas mora na tela de Suporte).
- **Selo "Ativo/Parado"** ao lado de "Caça automática": ouro quando ligado - a MESMA
  cor do orbe aceso do botão "Auto" na doca (`DockIdle.css`,
  `.dk-auto.is-on`), de propósito: as duas telas falam do mesmo campo
  (`cacaAutomatica`) e usam o mesmo aceso. Não usei verde: criaria uma segunda
  linguagem de "ligado" só nesta janela.
- **Botão Aplicar, quatro estados**: pendente (azul, com um respiro suave de sombra
  enquanto há alteração - nunca pisca, desliga sozinho em
  `prefers-reduced-motion`) / salvando (aro girando + "Aplicando…", desabilitado) /
  salvo (verde - o MESMO verde dos selos "Vale a pena", `RiIcones.confere`) / erro
  (vermelho - o MESMO vermelho da lista de problemas ao lado,
  `RiIcones.alerta`, continua CLICÁVEL para tentar de novo sem esperar o flash
  sumir). Nenhum pacote novo: os quatro estados são leitura do MESMO fluxo
  `enviarConfig()`/`onConfigReceived()` que já existia - `IdleConfig.applyState`
  é só uma variável de DESENHO.
- **Fio dourado sob o título de cada cartão** (`.ic-card h3` / `.ic-card-head`): o
  mesmo par hairline-azul/aro-dourado da janela, em escala de card - hierarquia
  visual sem inventar cor nova.
- **DockIdle não mudou.** Já usa os mesmos tokens (`Common.css`) e já tinha a
  linguagem "ouro = ligado" que o selo do master switch agora espelha; nenhuma
  das mudanças de IdleConfig introduz um token ou uma cor que o Dock precisasse
  acompanhar. Conferido visualmente (orbe do Auto, cápsulas de rótulo) e por
  código - nada em `DockIdle.css`/`DockIdle.js` lê algo que este redesenho tocou.
- **Nenhum ícone desenhado à mão**: os únicos glifos novos (spinner de "salvando" é
  um anel CSS puro, sem SVG; check/alerta do Aplicar são `RiIcones.confere`/
  `RiIcones.alerta`, já existentes) - nada de emoji, nada de ilustração nova.
- **Trilho vira faixa horizontal SÓ no celular (rodada 3)**: o MESMO `.ic-rail`
  (mesmo HTML, mesmo `data-tab`, mesmo JS) muda de direção via `flex-direction`
  dentro do `@media (max-width: 599px)` - não é um segundo componente, é o mesmo
  com uma direção diferente. O resumo de uma linha (`.ic-tab-sum`) sai da faixa:
  não sobra altura pra uma segunda linha de texto numa fileira de 44px, e o glifo
  + nome já identificam a seção. O acento do item ativo migra da borda ESQUERDA
  (gramática de lista vertical) pra embaixo (gramática universal de aba/chip
  horizontal) - mesma cor, mesma técnica (`box-shadow: inset`), só o lado muda.
  O chip ativo entra em vista sozinho na troca de seção
  (`scrollTabAtivaParaVista()`, `Element.scrollIntoView`) - sem animação na
  abertura da janela (o `.ic-window` ainda nem apareceu), com animação suave no
  clique/no medalhão do canto de combate.
- **"Todas"/"Nenhuma" ganharam receita própria no celular**: a régua genérica de
  alvo de toque (`min-height` numa caixa estreita) virava ovo - largura e altura
  quase iguais com `border-radius:999px` lê como oval, não pílula. Largura pelo
  texto + padding horizontal generoso resolve a FORMA; a altura continua no piso
  de 44px.
- **Cabeçalho empilha no celular**: o interruptor-mestre e a placa do mapa
  dividiam uma fileira só e brigavam por espaço. Empilhados (cada um com a
  largura inteira), nenhum dos dois aperta o outro - e o rótulo "Caça automática"
  ganhou `flex-wrap` pra o selo "Ativo/Parado" cair numa linha própria em vez de
  espremer o texto do título.
- **"Só funciona com a Caça automática ligada" (Sobrevivência/Consumíveis)**: o
  servidor mudou de regra nesta mesma entrega - com o interruptor desligado, NADA
  age sozinho (nem poção, nem descanso, nem buff, nem coleta). Em vez de esconder
  as seções ou travar os campos, elas ficam com a pintura "desabilitado por
  contexto" do design system (`grayscale(1)` + 55%, nunca cinza chapado) e uma
  nota curta explica o motivo. Os CAMPOS continuam editáveis (nenhum `disabled` a
  mais neles) - o jogador prepara a seção agora e ela passa a valer quando ligar
  o Auto, o mesmo espírito de D-359 (a config edita normal na cidade, antes da
  caçada começar).

## O que NÃO foi validado, e por quê

- **Não abri o jogo de verdade** (servidor + cliente rodando) - o arnês é só Shadow
  DOM com dados de exemplo, como o item "Se for caro, fique no arnês" previa. Subir
  uma pilha própria (fora das portas do dono) para só fotografar a mesma janela
  teria sido caro pelo retorno: o arnês já reproduz o HTML/CSS reais e as funções
  reais de `secoesDaConfig.js`, e cobriu os 5 achados acima.
- **`aplicarIconeDoItem`/ícone real de item** (o `<img data-item-icon>` do filtro de
  coleta) não foi carregado no arnês - ele depende do `Client`/GRF do jogo. A CAIXA
  do ícone está lá (24×24, cantos arredondados); a arte em si não foi conferida
  fora do jogo. Risco baixo: é o mesmo `<img>`/mesmo caminho que `Inventory`/
  `ItemInfo` já usam em produção, nada deste redesenho mexeu nele.
- **`<select>` nativo cortando texto longo** ("+ Pôr uma habilidade na orde…" em
  360-390px): é o navegador renderizando o próprio combobox, não algo que CSS
  resolve sem trocar o controle por um dropdown customizado - fora do escopo deste
  redesenho (não pedido, e um select customizado é uma peça de UI nova). Registrado
  aqui como item conhecido, severidade baixa (o rótulo continua claro pelo
  `<option>` ao abrir).
- **Não roda em `prefers-reduced-motion: reduce` na captura** - as animações (respiro
  do Aplicar, giro do spinner, tremor do erro) foram todas escritas com o par
  `@media (prefers-reduced-motion: no-preference)`/fallback estático, seguindo o
  padrão que `Common.css` já usa para a abertura de janela - não fotografado à
  parte porque é a MESMA técnica já testada visualmente em outros componentes
  deste projeto.

## Testes

Rodei `npx vitest run` QUATRO vezes depois do trabalho das rodadas 3-4 (a
máquina está com dezenas de sessões concorrentes - `tasklist` mediu de 20 a 50
`node.exe` simultâneos ao longo da tarde). As quatro bateram testes
CRONOMETRADOS em timeout, e em NENHUMA o arquivo era `secoesDaConfig.test.js`
ou qualquer coisa deste trabalho - a lista variava a cada rodada
(`dormirEmTelaPreta.test.js`, `missoesConcluidasOcultas.test.js`,
`semErroDeLint.test.js` - este último tem um timeout de 60s CRAVADO no próprio
`it(..., 60_000)`, e roda ESLint sobre `src/` inteiro, um dos testes mais
sensíveis a CPU concorrente da suite - e outros, nunca os mesmos duas vezes
seguidas). A melhor rodada (com `--testTimeout=60000`) fechou em **234 arquivos
passando, 1 falhando** (só o `semErroDeLint`); a última, sem essa folga, voltou
a **229 passando, 6 falhando**. TODOS os arquivos que falharam em qualquer
rodada, rodados DE NOVO sozinhos (sem o arnês Playwright, sem as outras três
rodadas competindo por CPU), passaram limpos - inclusive o `semErroDeLint`
(57,26s contra o teto de 60s dele). Contagem sempre igual: **235 arquivos**,
**2274 testes** (fora os 3 pulados de sempre, ambientais -
`bauSecreto`/`nomesLocais`/`iconeDoPwaEDoJogo`, nada deste trabalho), a
diferença entre rodadas é só QUANTOS batem o próprio relógio antes de terminar
num instante de pico. Não é regressão de código: é contenção de CPU desta
máquina compartilhada, e a prova disso é a MESMA suite passando inteira quando
tem a CPU para si.

Comparado com a base (`fdd7896d`) via `git diff --stat fdd7896d -- tests/`: **o
único teste tocado continua sendo `tests/ui/secoesDaConfig.test.js`, só com
inserções** (25→32 blocos `it()`). Nenhum teste existente foi alterado ou
removido; os 235 arquivos de teste são os mesmos da base.

## Fotos incluídas nesta pasta

Todas da rodada 4 (a confirmação, depois dos consertos de celular e texto):

- `caca`: os 6 tamanhos (1366×768, 1440×900, 1920×1080, 360×800, 390×844, 430×932) -
  a seção padrão, cobrindo a faixa inteira. Nos três móveis dá pra ver a faixa
  horizontal de chips (achado #6) com o chip ativo em destaque e o ponto âmbar de
  pendência.
- `ataque`, `suporte`: 1440×900 (desktop) + 390×844 (celular, mostra a faixa
  horizontal + a fileira de rotação/buff sem sobreposição, achado #3 da rodada 3).
- `sobrevivencia`: 1440×900 + 360×800 (com o interruptor ligado) +
  `390x844--sobrevivencia--auto-desligado.png` (interruptor DESLIGADO: nota "Só
  funciona com a Caça automática ligada" + conteúdo em grayscale/55%, achado #9).
- `consumiveis`: 1366×768 + 360×800 (interruptor ligado) +
  `390x844--consumiveis--auto-desligado.png` (interruptor desligado, mesmo
  tratamento; dá pra ver o rodapé com o Aplicar encaixado acima da doca e o mundo
  atrás).
- `botao-aplicar--{pendente,salvando,salvo,erro}.png`: os quatro estados, recorte
  só do rodapé, 1440×900.
- `medicoes-rodada2b.json` / `tabela-medicoes.md`: os números crus da rodada final
  (as 30 combinações + a faixa rolando por dentro + o "Todas"/"Nenhuma"), gerados
  pelo arnês - nenhum editado à mão.

Screenshots das rodadas 1-3 (com os defeitos, antes de cada conserto) não foram
commitadas - ficaram no scratchpad da sessão, e o texto acima descreve
exatamente o que cada uma mostrava.

## Perfis (Fase V2, 29/09/2026)

Bloco novo, não parte do redesenho premium original: até 5 configurações
nomeadas que o jogador salva e recarrega por cima do rascunho. Nenhum pacote
novo - `perfis` é um campo aditivo dentro do MESMO JSON de sempre
(`CZ_RAGIDLE_APLICAR_CONFIG` / `ZC_RAGIDLE_CONFIG`), e o servidor valida tudo
de novo, transacionalmente, no Aplicar (`servidor/idle/config-idle.ts`,
`validarConfigIdle`). Perfil é memória, não comportamento: carregar um copia o
`config` salvo por cima do rascunho, mas só passa a valer quando o jogador
aperta Aplicar. **A config interna do perfil NÃO é validada contra o
personagem de agora** (conserto de bloqueador, 29/09/2026, achado do
orquestrador): um perfil salvo com uma skill que o jogador depois perdeu (reset
de habilidades) não trava mais o Aplicar da config principal — só a forma
(objeto, sem `perfis` aninhado) é checada; a coerência só importa quando o
jogador carrega aquele perfil específico. Ver o commit do servidor
(`servidor/idle/config-idle.ts`, worktree `idle-perfis`).

### Recolhido por padrão (rodada de 29/09/2026)

A primeira versão desta entrega deixava o bloco SEMPRE aberto (duas fileiras +
rodapé, ~160px de altura) — achado do orquestrador: no celular isso empurrava
o cabeçalho inteiro e competia por espaço com a faixa-mestre. Virou uma
**pílula discreta** sempre visível ("Perfis" com 0 salvos, "Perfis · N/5" com
1+) que abre/fecha o corpo por baixo dela com um toque/clique — o mesmo
`<select>` + Carregar + Excluir, e o campo de nome + Salvar de antes, agora só
no DOM quando expandido. O estado aberto/fechado é só de DESENHO
(`_perfisAberto`, memória do módulo IdleConfig.js) — não precisa sobreviver a
um F5, e zera junto com o resto do rascunho ao trocar de personagem.

**O glifo**: trocou de "MapPin" (`RiIcones.pin`) para um novo "Bookmark"
(`RiIcones.marcador`, path oficial Lucide) — achado do orquestrador: um
alfinete de MAPA não comunica "algo guardado numa coleção". O RiIcones não
tinha bookmark; foi adicionado no MESMO idioma do resto do arquivo (traço
2px, round, `currentColor`, sem preenchimento) — nenhum SVG ilustrado. A seta
da pílula (`RiIcones.setaCima`/`setaBaixo`, já existentes) indica
aberto/fechado, o mesmo par que outros controles expansíveis do jogo já usam.

**Onde**: no cabeçalho, logo abaixo da faixa-mestre e ACIMA de
".ic-instalar"/".ic-tutorial". A pílula em si não carrega a moldura grande
(aro dourado, fundo de poço) — só o CORPO, quando expandido, usa essa receita
(a mesma de ".ic-instalar"/".ic-tutorial"). Perfis continua fora das cinco
seções do trilho de propósito: elas se organizam pelo que o autômato FAZ
(Caçada/Ataque/Suporte/Sobrevivência/Consumíveis), e Perfis não é
comportamento nenhum - é gestão de memória. Um `SECOES` de seis também
quebraria o portão que já protege a lista
(`tests/ui/secoesDaConfig.test.js:77`, comentário no próprio
`IdleConfig.html` explica a mesma razão para `.ic-tutorial`).

**Layout do corpo** (inalterado desde a rodada anterior, só a moldura externa
mudou): duas fileiras. A primeira tem um `<select>` com os perfis salvos +
"Carregar" + um "x" para excluir (o mesmo `.ic-icon-btn--remover` usado nas
linhas de rotação/buff). A segunda tem um campo de texto ("Nome do
perfil...") + "Salvar atual como". Uma linha de rodapé mostra "N/5 perfis" e,
quando há motivo concreto para o botão "Salvar" estar desabilitado (nome
inválido já digitado, ou teto de 5 atingido), o motivo aparece por escrito -
não só no `title` do botão (que não existe no toque).

**Regras espelhadas do servidor** (`perfisDaConfig.js`, testado em
`tests/ui/perfisDaConfig.test.js`, 18 casos): nome de 1 a 24 caracteres, sem
caractere de controle; nomes únicos SEM diferenciar maiúscula/minúscula -
salvar com um nome já usado SUBSTITUI o perfil existente em vez de duplicar
(decisão de UX: mais previsível que recusar com "nome repetido" quando a
intenção mais comum é "atualizar o que eu já tinha salvo"); teto de 5, que só
vale para nome NOVO (sobrescrever não gasta vaga). A validação real e final
continua sendo do servidor (`validarConfigIdle`) - o que roda aqui é só
feedback antes do clique, a mesma disciplina de toda a janela.

### Prova visual

Mesmo método do resto deste relatório (Shadow DOM real, `Common.css` +
`IdleConfig.css` + `IdleConfig.html` reais, ícones do `RiIcones` real), com um
arnês novo e também descartável (não commitado, apagado no fim da sessão).
Desta vez a JANELA INTEIRA foi fotografada (não só o bloco) — pedido do
orquestrador, para confirmar que a pílula não empurra o resto do cabeçalho de
forma estranha. Portados à mão: `renderMaster()`, `renderCaca()` +
`renderFiltroDeColeta()`/`renderAsa()`/`switchRow()`/`garantirAsa()` (a seção
Caçada, ativa por padrão no HTML estático) e `renderPerfis()` (texto idêntico
ao de `IdleConfig.js` desta rodada); `secoesDaConfig.js` (`resumoDaSecao`,
`secaoPendente`) e `perfisDaConfig.js` foram importados DIRETO, sem porte, por
serem puros. A marca `.ri-janela` foi adicionada a mão no host para o mobile
ativar a regra de `Common.css` que faz a janela virar painel de largura
inteira (a mesma armadilha #2 do método original). O botão flutuante
(`.ic-button`, `position: fixed`) foi escondido no arnês — em produção o
DockIdle o cobre; sem o Dock montado ele vazava atrás da janela no recorte do
`.ic-window`, um artefato do arnês e não da funcionalidade.

Quatro fotos (dois tamanhos × dois estados da pílula), seção Caçada ativa:

| Arquivo | O que mostra |
|---|---|
| `1440x900--perfis-recolhido.png` | Pílula "Perfis · 2/5" fechada, logo abaixo da faixa-mestre |
| `1440x900--perfis-aberto.png` | Corpo expandido (select + Carregar + Excluir; nome + Salvar), empurrando o trilho/painel para baixo — comportamento normal de fluxo, não overlay |
| `390x844--perfis-recolhido.png` | Mesmo recolhido, celular — cabeçalho empilhado (rodada 3 anterior) + pílula sem disputar espaço |
| `390x844--perfis-aberto.png` | Mesmo aberto, celular — corpo cabe na largura inteira, sem overflow |

Medido (não só fotografado): `document.documentElement.scrollWidth >
clientWidth` ficou `false` nos 4 casos (recolhido/aberto × 2 tamanhos), sem
overflow horizontal. Os alvos de toque a 390px: `.ic-perfis-pilula` 112×46,
`.ic-perfis-select` 228×46, `.ic-perfis-carregar` 68×46, `.ic-perfis-nome`
213×60, `.ic-perfis-salvar` 121×46 - todos ≥44px de altura; `.ic-perfis-excluir`
mede 34×34 visualmente, mas é o MESMO `.ic-icon-btn` que o resto da janela já
usa para remover linha de rotação/buff, com o mesmo aro invisível de 7px por
lado que o leva a 48×48 de área clicável (regra existente de `IdleConfig.css`,
não uma exceção nova).

**O que NÃO foi validado**: não abri o jogo de verdade (mesma ressalva do
resto deste relatório) - o arnês usa um `cfg`/`ctx` de exemplo, não uma sessão
contra o servidor; o mapa/monstros/asa mostrados na seção Caçada são fixture,
não uma resposta real de `contextoIdleDe`. A ida e volta pelo pacote de
verdade (Aplicar grava, `ZC_RAGIDLE_CONFIG` ecoa, recusa é transacional, e
agora também "perfil com skill perdida é aceito mas a config principal com a
mesma skill continua recusada") está provada do lado do servidor, no fio de
verdade (`servidor/mapa/perfis-da-config-idle-no-fio.test.ts`, worktree
`idle-perfis`), não neste arnês visual.
