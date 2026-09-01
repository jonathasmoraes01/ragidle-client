# Diretrizes da skill `ui-ux-pro-max` aplicadas nesta onda

> Registro exigido pelo briefing: toda decisão visual desta onda passa pela
> skill, e aqui fica o que ela devolveu e o que eu fiz com isso.
> Consultada em 01/09/2026, versão 2.13.0.

## Stack detectado

A skill exige detectar o stack antes de recomendar, e proíbe assumir um padrão.
Detectado em `ragidle-client/package.json` e `rag-idle-master/package.json`:

**Vite + JavaScript ES modules + Shadow DOM. Sem React, Vue, Svelte ou
Tailwind.** Não existe framework de componente.

Consequência direta: o "componente `IconButton`" da Fase 2 **não pode ser** um
componente de framework. Vai ser o que o fork já usa — uma classe utilitária de
CSS (`.ri-disc`) mais uma chave no registro `ri-icones.js`. Qualquer
recomendação da skill escrita em JSX foi traduzida para esse formato.

## Diretrizes que valem para esta onda

### 1. `icon-context-accessibility` (domínio `icons`)

> *"Se decorativo ao lado de texto visível, `aria-hidden="true"`. Se
> significativo sem texto equivalente, dê alternativa textual. Se dentro de um
> controle interativo, dê ao controle um nome acessível e exponha o estado
> aplicável."*

**Como se aplica.** Os botões do menu têm rótulo visível (`.tm-label`), então o
glifo é **decorativo** e leva `aria-hidden`. O botão é que precisa de estado:
como cada um abre uma janela, o estado certo é **`aria-expanded`**, e
`aria-pressed` para os que alternam (Auto). Hoje os botões têm `title=` e
rótulo, mas **nenhum expõe estado** — é lacuna a fechar na Fase 2, e casa com o
requisito de "botão da janela aberta permanece no estado ativo": o mesmo estado
que pinta o glow precisa ser lido em voz alta.

### 2. Easing (domínio `ux`, categoria Animation)

> *"Use desaceleração ao chegar, aceleração ao sair, e linear para progresso a
> taxa constante."* Anti-padrão explícito: *"`ease-in-out` para todo
> movimento"* e *"uma duração só para toda transição"*.

**Como se aplica.** A abertura da janela desacelera ao chegar (`--ease-out`, já
existe). O fechamento precisa **acelerar ao sair** — e para isso **falta
token**: `Common.css:466-467` só tem `--ease-out` e `--ease-in-out`. Vou propor
`--ease-in` na Fase 2, em vez de escrever a curva solta no componente (a regra
de ouro do design system proíbe valor literal).

Também decorre daqui que abrir e fechar **não** usam a mesma duração. O padrão
da área é saída mais curta que entrada; com os tokens existentes isso é
`--dur-base` (220ms) para abrir e `--dur-fast` (150ms) para fechar.

### 3. Reduced Motion (domínio `ux`, severidade **alta**)

> *"Respeite as preferências de movimento do usuário: cheque
> `prefers-reduced-motion`."*

**Como se aplica.** Requisito explícito do briefing e da skill. O fork já tem 8
blocos `prefers-reduced-motion` — a animação nova entra no mesmo padrão, não
inventa outro. Com movimento reduzido, o glow **permanece** (é informação: diz
qual janela está aberta); o que some é a transição.

### 4. Excessive Motion (domínio `ux`, severidade **alta**)

> *"Anime no máximo 1–2 elementos por tela."*

**Como se aplica.** É o limite que impede a Fase 2 de virar festa: por abertura
de janela, os elementos animados são **dois** — a janela e o glow do botão que
a abriu. Nada mais entra junto.

### 5. Target Size (domínio `ux`, severidade **alta**)

> *"WCAG 2.2 AA pede 24 px CSS de alvo, ou uma exceção aplicável"*, e para
> toque *"44pt no iOS, 48dp no Android"*. Anti-padrão: *"botõezinhos de ícone
> adjacentes"*.

**Como se aplica.** O design system já tem `--hit-touch: 44px`. As variantes de
tamanho da Fase 2 vão ser medidas contra isso, com atenção ao leque do menu,
que hoje empilha 11 botões juntos — é exatamente o anti-padrão citado.

### 6. Da tabela de prioridade da skill

- **"Ícones SVG, nunca emoji"** — o inventário achou **13 emoji** usados como
  ícone (`Intro.html:22,:69`; `MobileUI.html`, 11). Coincide com a proibição do
  nosso próprio design system. Registrado em
  [inventario-janelas.md](inventario-janelas.md).
- **"Nunca hex cru em componente"** — achei 2 (`BasicInfoIdle.html:52` e `:62`).
- **"Não remova o anel de foco"** — `Common.css:2-4` faz `:focus { outline:
  none }` **global**. Isso é anterior a esta onda e vale para o fork inteiro;
  os botões novos precisam de `:focus-visible` próprio, senão a navegação por
  teclado fica cega.
- **"Mudança de estado instantânea (0ms) é anti-padrão"** — vale para o estado
  pressionado do botão.

## Fase 3 — a loja de NPC (NpcStoreV2)

Consultada de novo para o redesenho do comércio. O banco da skill **não tem
padrão de loja de jogo** (as buscas por stepper/carrinho voltaram genéricas;
declarado como manda o contrato dela) — o que valeu foi:

- **Input Labels / Input Types** (Forms, alta): o campo de quantidade tem
  `aria-label` por item e `inputmode="numeric"`; a busca tem `aria-label`
  visível de propósito.
- **Target Size**: degrau de quantidade com alvos de 24px (o mínimo WCAG 2.2
  AA para web), botões Máx e ± separados por gap.
- **Feedback nunca mudo**: o freio de zeny pinta o total E a bolsa de
  vermelho e trava o botão com `title` explicando — a regra "erro perto do
  campo, explicando o quê e como".
- Do **gabarito Origin** (`redesign/referencia-hud-origin.md`): copiou-se a
  ORGANIZAÇÃO (uma lista, total sempre visível, uma ação primária, nada de
  arrastar) e nenhum acabamento — forma 100% do nosso design system, como o
  gabarito manda.

As decisões de interação (lista + degrau em vez de arrastar; desconto
riscado + verde; "Você tem X Zeny" no topo) são craft geral de comércio,
declaradas aqui como fallback — não saíram de match do banco da skill.

## O que a skill NÃO decidiu

A skill é catálogo de referência. **O design system oficial do dono continua
sendo a lei** (`redesign/design-system-oficial.md`): paleta, raio, sombra
azul-nunca-preta, serifa só em título, os três tratamentos de ícone. Onde os
dois divergirem, vale o do dono — e a divergência achada nesta fase está em
`[DONO-1]` do [mapa-icones.md](mapa-icones.md).
