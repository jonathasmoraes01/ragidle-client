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

## Duas rodadas (a exigida pelo briefing)

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

**Rodada 2** (as mesmas 30 fotos + as 4 do botão Aplicar) confirmou: **zero
problemas** - sem *overflow* horizontal em nenhum tamanho, Aplicar sempre visível,
todo alvo de toque no celular ≥ 44px (medido: 44-46px), nenhum elemento cortado.
Tabela completa em [`tabela-medicoes.md`](tabela-medicoes.md) (gerada dos números
crus, não escrita à mão) e os números crus em
[`medicoes-rodada2.json`](medicoes-rodada2.json).

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

`npx vitest run` na worktree: **235 arquivos, 2274 testes passando, 0 falhando, 3
pulados** (pré-existentes e ambientais - `bauSecreto`/`nomesLocais`/
`iconeDoPwaEDoJogo`, ligados a assets gerados ausentes nesta worktree, nada deste
trabalho). Comparado com a base (`fdd7896d`) via `git diff --stat fdd7896d --
tests/`: **o único teste tocado foi `tests/ui/secoesDaConfig.test.js`, só com
inserções** (41 linhas, 25→32 blocos `it()` - as 7 novas cobrem `secaoPendente`/
`CAMPOS_DA_SECAO`). Nenhum teste existente foi alterado ou removido; os 235
arquivos de teste são os mesmos da base.

## Fotos incluídas nesta pasta

- `caca`: os 6 tamanhos (1366×768, 1440×900, 1920×1080, 360×800, 390×844, 430×932) -
  a seção padrão, cobrindo a faixa inteira.
- `ataque`, `suporte`: 1440×900 (desktop) + o(s) tamanho(s) móvel(is) que registraram
  o achado #3 (a fileira de rotação/buff), para comparar com o texto do relatório.
- `sobrevivencia`: 1440×900 + 360×800 (achado #2, `.ic-duas`).
- `consumiveis`: 1366×768 + 360×800 (estado "em breve" + o painel encaixado acima da
  doca, mundo visível atrás).
- `botao-aplicar--{pendente,salvando,salvo,erro}.png`: os quatro estados, recorte
  só do rodapé, 1440×900.
- `medicoes-rodada2.json` / `tabela-medicoes.md`: os números crus da rodada final
  (as 30 combinações + o botão), gerados pelo arnês - nenhum editado à mão.

Screenshots da rodada 1 (com os 5 defeitos) não foram commitadas - ficaram no
scratchpad da sessão, e o texto acima descreve exatamente o que cada uma mostrava.
