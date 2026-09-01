# Mapa de ícones da interface — antigo → novo

> Fase 1 da onda de padronização visual (01/09/2026). Este documento é
> **inventário**, não decisão: onde a correspondência não é certa, está escrito
> `[DONO]` e nada foi trocado no código ainda.

## 1. O que chegou

17 arquivos em `C:\Users\Administrator\Downloads\Icones\icones sem fundo`,
todos **PNG 1024×1024 RGBA** (fundo removido no Photoroom, ~300 KB cada).

Três fatos medidos que mudam o jeito de encaixar isso:

1. **São raster, não vetor.** A regra da tarefa ("tudo vetorial ou por código")
   é cumprível para o **container** — que passa a ser CSS —, mas o glifo é uma
   ilustração 3D renderizada. Não existe versão vetorial dela. Ver a decisão
   `[DONO-1]` no fim.
2. **O desenho ocupa área muito diferente em cada arquivo.** Medido pela caixa
   alfa: de 331×336 px (eventos) a 583×458 px (grupo), numa tela de 1024². Se
   o enquadramento não fosse normalizado, o mesmo `width` em CSS renderizaria
   uns ícones grandes e outros minúsculos.
3. **As proporções variam de 0,59 a 1,61.** O cristal da RO_Shop é alto e
   estreito; o códex é largo e baixo. Nenhum encaixe quadrado serve para os
   dois — o container circular precisa tratar isso.

### A pasta `icones/` da raiz do repositório já tinha a chave do mapeamento

`C:\Users\Administrator\Downloads\Rag-idle\icones\` guarda **os mesmos 17
desenhos numa geração anterior, com o container já pintado** (JPEG, disco
creme com aro dourado) e — o que importa — **nomeados por função em
português**: `Amigos`, `backpack`, `caçar`, `character`, `Codex`, `email`,
`Eventos`, `Grupo`, `Guilda`, `Hunt Analise`, `Idle`, `Leilão`, `Loja`,
`missões`, `Recompensas`, `RO_Shop`, `skill`, `Trade`.

São **18 nomes** contra 17 arquivos transparentes. O mapeamento abaixo saiu da
comparação visual dos dois conjuntos, não do palpite sobre o nome do arquivo.

Há ainda `icones/glow/` com **19 variantes de estado aceso** geradas pelo dono.
Elas **não serão usadas como asset** (o glow é requisito de código), mas servem
de referência de intenção para a Fase 2.

## 2. Onde os ícones novos moram agora

O projeto não depende mais da pasta Downloads.

| destino | o que é | peso |
|---|---|---|
| `public/ragidle/ui-icons/*.webp` | os **18** que o jogo carrega (17 do lote + a mochila avulsa de 01/09), recortados na caixa alfa, lado maior 128 px | **135 KB** no total |
| `public/ragidle/ui-icons/manifesto.json` | largura/altura/aspecto de cada um, para o componente não adivinhar proporção | 1 KB |
| `arte-fonte/ui-icons/*.png` | os originais 1024², arquivados para reexportar | 5,2 MB |
| `vite/converter-ui-icons.mjs` | o conversor, com o porquê de cada escolha no cabeçalho | — |

O recorte na caixa alfa é intencional: o arquivo passa a declarar a própria
geometria, e o encaixe vira decisão de layout (Fase 2) em vez de um número
mágico por ícone espalhado pelo CSS. 5,1 MB de PNG viraram 127 KB de WebP.

## 3. O de-para

`chave` é a chave em `src/UI/ri-icones.js`, que é o **registro único** de glifos
do fork. Quase todo consumidor chama por um marcador `<!--RI_ICONE:chave-->` no
HTML do componente, e o `render()` troca pelo SVG. Trocar o desenho de uma chave
alcança todos os consumidores dela de uma vez.

| chave | ícone antigo | arquivo novo | onde é usado (arquivo:linha) | obs. |
|---|---|---|---|---|
| `personagem` | `dock-icons/personagem.png` (36², pixel art) | `personagem.webp` | [TopMenuIdle.html:15](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L15) | direto |
| `skills` | `dock-icons/skills.png` | `skills.webp` | [TopMenuIdle.html:31](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L31) | direto |
| `caca` | `dock-icons/caca.png` | `caca.webp` | [TopMenuIdle.html:44](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L44) | direto |
| `correio` | `dock-icons/correio.png` | `correio.webp` | [TopMenuIdle.html:58](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L58), [CorreioIdle.js:686](../../src/UI/Components/CorreioIdle/CorreioIdle.js#L686) | ver nota A |
| `correioLido` | `dock-icons/correioLido.png` (24²) | — | [CorreioIdle.js:686](../../src/UI/Components/CorreioIdle/CorreioIdle.js#L686) | ver nota A |
| `grupo` | `dock-icons/grupo.png` | `grupo.webp` | [TopMenuIdle.html:183](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L183), [:187](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L187) | direto |
| `recompensas` | `dock-icons/recompensas.png` | `recompensas.webp` | [TopMenuIdle.html:324](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L324) | direto |
| `guilda` | Lucide (escudo) | `guilda.webp` | [TopMenuIdle.html:178](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L178) | ganha arte |
| `missoes` | Lucide | `missoes.webp` | [TopMenuIdle.html:78](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L78) | ganha arte |
| `codex` | Lucide | `codex.webp` | [TopMenuIdle.html:219](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L219) | ganha arte |
| `loja` | Lucide | `loja.webp` | [TopMenuIdle.html:238](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L238) | ganha arte |
| `roshop` | Lucide | `ro-shop.webp` | [TopMenuIdle.html:254](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L254) | ganha arte |
| `troca` | Lucide | `trade.webp` | [TopMenuIdle.html:276](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L276) | ganha arte |
| `leilao` | Lucide | `leilao.webp` | [TopMenuIdle.html:281](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L281) | ganha arte |
| `eventos` | Lucide | `eventos.webp` | [TopMenuIdle.html:286](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L286) | ganha arte |
| `grafico` | Lucide (barras) | `analise-de-caca.webp` | [TopMenuIdle.html:108](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L108) | ✅ `[DONO-2]` confirmou |
| `inventario` | `dock-icons/inventario.png` | `inventario.webp` | [TopMenuIdle.html:25](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L25), [CombatCornerIdle.html:11](../../src/UI/Components/CombatCornerIdle/CombatCornerIdle.html#L11) | ✅ mochila entregue em 01/09 (`[DONO-3]`) |
| `auto` | `dock-icons/auto.png` | **fica o do GRF** | [DockIdle.html:16](../../src/UI/Components/DockIdle/DockIdle.html#L16), [CombatCornerIdle.html:6](../../src/UI/Components/CombatCornerIdle/CombatCornerIdle.html#L6) | conjunto novo não cobre o conceito |
| `config` (botão "Idle") | `dock-icons/config.png` (engrenagens) | `idle.webp` | [TopMenuIdle.html:94](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L94) | ✅ `[DONO-4]`: engrenagem é do Idle |
| `amigos` (chave nova) | reusava `grupo` | `amigos.webp` | [TopMenuIdle.html:183](../../src/UI/Components/TopMenuIdle/TopMenuIdle.html#L183) | ✅ `[DONO-5]` confirmou |

**Nota A — o correio resolve-se por código, não por asset.** Hoje existem dois
PNGs (`correio` e `correioLido`) e o JS troca o `src` conforme houver carta não
lida. O conjunto novo tem um envelope só. Isso é o comportamento certo: "não
lido" é **estado**, e o componente da Fase 2 já vai ter badge de notificação
(o design system pede ponto vermelho DENTRO do disco). Os dois arquivos viram
um ícone + um badge.

### Chaves que ficam como estão

`menu`, `passe`, `zeny`, `cash`, `admin`, `pin`, `mais`, `seta`, `fantasia` e os
11 `slot*` (chapéu, óculos, boca, armadura, arma, escudo, capa, sapato,
munição, acessório) **não têm equivalente no conjunto novo** e continuam Lucide.
Isso é correto: os `slot*` são marcadores de espaço vazio dentro da boneca de
equipamento, não botões de navegação — arte ilustrada ali competiria com o item
real que o jogador encaixa.

`equipamento` e `passe` estão definidas em `ri-icones.js` mas **nenhum
componente as consome hoje**. Deixei intactas; se continuarem órfãs ao fim da
Fase 2, viram remoção.

## 4. Lacunas

### Ícone novo cujo destino existe mas não tem chave própria

- `amigos.webp` — não existe chave `amigos` em `ri-icones.js`, **mas o botão
  existe**: `Amigos` (`data-action="group"`) e `Grupo` (`data-action="lfg"`)
  são dois botões distintos que hoje **dividem o mesmo ícone `grupo`**
  (TopMenuIdle.html:183 e :187). Ver `[DONO-5]`.

### Ícone antigo sem equivalente novo

- `inventario` (mochila) — `[DONO-3]`
- `config` (configurações) — `[DONO-4]`
- `auto` (automação idle) — `[DONO-4]`

## 5. Decisões — TODAS RESPONDIDAS em 01/09/2026, e executadas na Fase 2

O texto original das cinco perguntas fica abaixo como registro. As respostas:

- **`[DONO-1]`** "pode fazer o que achar melhor" → emenda formalizada: **arte
  ilustrada nos discos de navegação; traço Lucide em todo o resto** (slots da
  boneca, setas, `zeny`/`cash`, controles internos). Registrada no cabeçalho
  de `ri-icones.js` e na seção 6 deste documento.
- **`[DONO-2]`** "faça como achar melhor" → `grafico` = Análise de Caça,
  aplicado.
- **`[DONO-3]`** mochila entregue em anexo (1024², alfa OK) → convertida como
  `inventario.webp`; original arquivado em `arte-fonte/ui-icons/inventario.png`.
- **`[DONO-4]`** "coloque no idle" → a engrenagem foi para o botão **Idle**
  (chave `config`, que abre a Configuração de Caça). `auto` continua com a
  arte do GRF e Configurações continua no menu ESC, sem ícone novo.
- **`[DONO-5]`** "isso mesmo" → chave `amigos` criada; o botão Amigos deixou
  de repetir a figura do Grupo.

### O texto original das perguntas (registro)

**`[DONO-1]` — o design system proíbe o que estes ícones são.**
O documento oficial diz, na seção de iconografia: *"O glifo é traço de 2px com
juntas arredondadas (linguagem Lucide). O design system PROÍBE emoji e
ilustração SVG desenhada à mão"*, e crava *"glifo em `--blue-600` a 45% do
disco"* — ou seja, um traço azul monocromático. Os ícones novos são
ilustrações 3D coloridas.

Isso não é impedimento, é uma emenda que precisa da sua assinatura. Note que a
prática do repositório **já diverge**: 9 chaves usam arte raster do GRF hoje
(`artReal`), não traço Lucide. Minha recomendação é formalizar: **arte
ilustrada para os discos de navegação; traço Lucide para o resto** (slots,
setas, `mais`, controles dentro de janela). Confirma?

**`[DONO-2]` — `analise-de-caca` para a chave `grafico`?**
O desenho é um gráfico de barras com seta, e o arquivo que o gerou chama-se
"Hunt Analise". A chave `grafico` alimenta o botão que abre o `HuntAnalyzer`.
A correspondência parece certa, mas o nome da chave é genérico e eu não quero
assumir que ela nunca vai ser reusada. Confirma que `grafico` = Análise de
Caça e mais nada?

**`[DONO-3]` — falta o ícone da Mochila.**
`backpack` está no conjunto **nomeado** (`icones/backpack.jpeg`, mochila de
couro marrom) e tem até variante de glow (`Creating_backpack_icon_glow_state`),
mas **não veio no conjunto sem fundo**. É o único que faltou, e é uma janela
central. Prefere (a) gerar o `backpack` sem fundo e me mandar, ou (b) usar o
baú (`recompensas`) na Mochila e achar outro para Recompensas? Recomendo (a) —
o baú já é Recompensas e duplicar confunde.

**`[DONO-4]` — engrenagem: Configurações ou Idle?**
O ícone novo `idle` são duas engrenagens. O ícone **antigo** de `config`
também são duas engrenagens. Existem três botões concorrendo por ele:
`config` (Configurações), `auto` (liga/desliga automação) e a Config de Caça.
Não vou adivinhar. Para qual dos três vale a engrenagem, e o que os outros dois
usam?

**`[DONO-5]` — `amigos` no botão Amigos, que hoje repete o ícone do Grupo?**
Diferente do que eu supus a princípio, o botão existe: o leque tem **Amigos** e
**Grupo** lado a lado, e os dois desenham o mesmo ícone `grupo` — dois rótulos
diferentes com a mesma figura. O ícone novo `amigos` (dois personagens sem
arma, contra os dois armados do `grupo`) resolve exatamente isso. Recomendo
criar a chave `amigos` e apontar o botão para ela. Confirma?

## 6. O container já existe — a Fase 2 refina, não inventa

Achado que muda o tamanho da Fase 2: o disco pedido pelo design system **já
está implementado** como classe utilitária `.ri-disc`, em
[Common.css:851](../../src/UI/Common.css#L851). Os botões do menu já a vestem —
`<span class="tm-icon-wrap ri-disc"><!--RI_ICONE:guilda--></span>`. As outras
duas famílias do design system também existem: `.ri-glass` (orbe de combate,
:896) e `.ri-tile` (ladrilho de item, :937).

Então a Fase 2 é: (a) refinar `.ri-disc` para variantes de tamanho e os cinco
estados, (b) trocar o conteúdo do glifo pela arte nova, (c) acrescentar o glow
sincronizado. Não é escrever um componente do zero.

Um detalhe já checado: `.ri-disc svg` dimensiona o glifo a **45% do diâmetro**,
como o design system manda. Isso foi calibrado para traço Lucide fino. Arte
ilustrada com sombra própria vai precisar de proporção maior — é a primeira
coisa que vou medir na Fase 2, e depende de `[DONO-1]`.

### Dois riscos de contraste que a prova visual já mostrou

O disco do design system é **claro** (gradiente branco → azul-claro). Dois
ícones novos são claros também, e vão sumir contra ele:

- **`missoes`** — prancheta branca com fundo quase branco. É o pior caso.
- **`skills`** — pentagrama de traço laranja fino, sem massa escura. A 36 px
  vira um borrão.

Isso é a diretriz de contraste da `ui-ux-pro-max` (prioridade 1, 4,5:1) batendo
de frente com a paleta do disco. Não vou resolver escurecendo o ícone (é arte
do dono). Na Fase 2 vou medir o contraste real e trazer opção — provavelmente
uma variante de disco mais escura para os glifos claros, ou uma sombra interna
no glifo. Fica como decisão a apresentar **com medida**, não como palpite.

## 7. O que a Fase 2 executou (01/09/2026, na sequência das respostas)

- `ri-icones.js` ganhou `arteUi(nome, reserva)` → `/ragidle/ui-icons/<nome>.webp`
  com `class="ri-arte"` e a MESMA cadeia de reserva de `artReal` (WebP faltou →
  glifo vetorial no lugar). **17 chaves** migradas + a chave nova `amigos`.
- `.ri-disc svg.ri-arte { width/height: 62% }` em `Common.css` — a ilustração
  ocupa 62% do disco (o 45% do DS continua valendo para traço Lucide, e a
  reserva volta sozinha a ele porque o `onerror` troca o `<svg>` inteiro).
- Glow sincronizado: o disco em repouso transiciona com
  `--dur-janela-fecha`/`--ease-in` e o ativo com `--dur-janela-abre`/`--ease-out`
  — os MESMOS tokens da animação de janela `.ri-anima` (aplicada às 12 janelas
  idle). Medido quadro a quadro: abertura desacelera, fechamento acelera, e o
  `display:none` só se consuma com opacidade 0.
- Tokens novos: `--ease-in`, `--dur-janela-abre/fecha`,
  `--disc-menu/fab/alca`.
- `aria-expanded` acompanha o aro em `updateActiveState()`; todo `<svg>` de
  `ri-icones.js` sai `aria-hidden="true"`.
- Removidos: a chave `equipamento` (órfã) e 8 PNGs de `dock-icons/`
  (personagem, skills, inventario, equipamento, caca, config, grupo,
  recompensas). Ficaram `auto.png` (ainda em uso) e `correio*.png` (a lista
  do CorreioIdle usa os dois estados por linha — vira badge na reforma da
  janela, Fase 3). Atenção: `rag-idle-master/scripts/icones-de-menu.ts`
  REGERA os 8 se rodar — o mapa `APROVADOS` dele ficou obsoleto de propósito
  (fora do escopo do cliente); quem mexer nele depois, pode-o enxugar.
- Pranchas antes/depois em `docs/ui/prints/fase-2/`.

Pendência de design assumida: `skills` (traço laranja fino) e `ro-shop`
(cristal claro) são os dois glifos mais fracos sobre o disco claro — ver a
seção de contraste acima; opção medida vem na Fase 3 junto com a auditoria.
