# Inventário de janelas, telas e overlays

> Fase 1 da onda de padronização visual (01/09/2026). **120 componentes** em
> `src/UI/Components/`. Este documento é o mapa de onde a Fase 3 passou.

## ✅ FASE 3 EXECUTADA (01/09/2026, commits 82e7b061 · 5c212d14 · 7734dd6f · 89d70045)

O dono decidiu: **todas** as janelas clássicas entram no padrão. Feito:

- **A loja de NPC virou NpcStoreV2** (componente versionado; a V1 clássica é
  reserva por config `uiVersions.NpcStore = 'default'`). Uma janela para os 8
  tipos de comércio: lista com busca, degrau de quantidade por linha, total
  vivo e freio de zeny. Provada em jogo com interação real
  (`rag-idle-master/scripts/fotografar-loja-npc.ts`).
- **Animação única de abrir/fechar** agora alcança janela NATIVA:
  `Comp.riAnimaJanela = true` + proxy `ui.show()/hide()` e `append/remove`
  de GUIComponent (opt-in; ContextMenu e SkillTargetSelection ficaram FORA
  de propósito — popup de alta frequência e mira precisam ser instantâneos).
- **Todo o P2/P3/P4 legado foi reformado** (~50 componentes, ver o commit
  89d70045 para a lista completa): chrome de bitmap → `.ri-*`, cores →
  tokens, rótulos de bitmap → texto PT-BR, dicas → cápsula de vidro escuro.
  Arte de CONTEÚDO (slots de encaixe, silhuetas, animações de refino,
  ícones) continua do cliente, decisão documentada janela a janela.
- **Prova**: máquina `fotografar-janelas-legadas.ts` (antes/depois, mesmo
  personagem) — nada que montava quebrou; Clan e Navigation passaram a
  montar. Pranchas em [prints/fase-3/](prints/fase-3/).
- Armadilha nova cicatrizada em 3 janelas (Enchant/EnchantGrade/Refine):
  **altura 100% na raiz colapsa no container do Shadow DOM** e a janela some
  inteira — pixel cravado igual ao `:host`, sempre.

**Fica de fora, com motivo:** MobileUI/Joystick (aguarda `[DONO-8]`);
Mail/Rodex nativos (inalcançáveis — candidatos a remoção); envelopes por
linha do CorreioIdle (vira badge em passada própria); diagramas-bitmap de
equipamento (projeto de arte próprio); contraste de `skills`/`ro-shop` no
disco claro (opção medida à parte); P5 (ferramentas de dev, fora de escopo).

---

## Leia isto antes do resto

**As cinco janelas que o briefing manda "reconstruir por completo" já estão no
padrão.** Medi cada uma:

| janela | componente ativo | aderência a token | veredito |
|---|---|---|---|
| Login | `WinLogin/WinLoginV2` | **100%** (26 tokens, 0 cor crua) | já refeita |
| Seleção de Personagem | `CharSelect/CharSelectV4` | **96%** (46 / 2) | já refeita |
| Amigos | `PartyFriends/PartyFriendsV1` | **100%** (66 / 0) | já refeita |
| Guilda | `Guild` | **99%** (124 / 1) | já refeita |
| Configurações | `GraphicsOption`, `SoundOption`, `ShortCutOption` | **100 / 100 / 98%** | já refeitas |

O que enganou: cada uma dessas pastas guarda também as versões **antigas**
(`WinLogin/WinLogin`, `CharSelect/CharSelectV1..V3`, …), que continuam na
árvore e ainda são clássicas. Quem varre a pasta inteira vê o legado e conclui
errado — foi o meu primeiro erro nesta fase, corrigido medindo a versão ativa
isoladamente. Ver `[DONO-6]`.

## Como o estado foi classificado

Não por impressão. Para cada componente, medi no CSS:

- **tokens** — ocorrências de `var(--…)`
- **cruas** — cores literais (`#hex`, `rgb()`, `rgba()`) fora de linha que
  *define* um token
- **sprite** — referências a `.bmp`/`.tga` (a arte do cliente clássico)

A **aderência** é `tokens / (tokens + cruas)`:

| estado | critério |
|---|---|
| **PADRÃO** | ≥ 85% — fala a língua do design system |
| **PARCIAL** | 40–84% — migrado pela metade |
| **LEGADO** | < 40% — escrito antes do design system |

Contagem de sprite alta **não** significa legado: `CharCreatev4` tem 100% de
aderência e 74 refs a `.bmp` porque os botões de aparência (cabelo, roupa) são
arte de jogo legítima. Sprite só condena quando é o *chrome* (moldura, botão
fechar, barra de título) que vem de bitmap.

**Resumo: 30 PADRÃO · 13 PARCIAL · 62 LEGADO · 13 sem superfície pintada · 2
sem CSS.**

---

## P1 — O jogador vê sempre, ou é a porta de entrada

| janela / tela | componente ativo | estado | notas |
|---|---|---|---|
| Menu da HUD (cluster + leque) | `TopMenuIdle` | PADRÃO 90% | **epicentro da Fase 2** — 20 botões de ícone |
| Barra de ações (dock) | `DockIdle` | PARCIAL 76% | 54 tokens, 17 cruas |
| Painel do personagem (HP/SP/EXP) | `BasicInfoIdle` | PARCIAL 71% | **2 SVG com cor cravada** (`.html:52`, `:62`) |
| Chat (4 abas) | `ChatBox` | PADRÃO 88% | |
| Minimapa | `MiniMap/MiniMapV2` | PADRÃO 100% | |
| Botão de Caçar | `HuntButtonIdle` | PADRÃO 100% | |
| Rastreador de missão | `MissoesTrackerIdle` | PADRÃO 92% | |
| Ícones de status / buff | `StatusIcons` | PARCIAL 50% | arte de buff vem do GRF |
| Launcher / carregamento | `Intro` | PARCIAL 82% | **sistema de token PRÓPRIO** + emoji |
| Login | `WinLogin/WinLoginV2` | PADRÃO 100% | |
| Seleção de personagem | `CharSelect/CharSelectV4` | PADRÃO 96% | |
| Criação de personagem | `CharCreate/CharCreatev4` | PADRÃO 100% | |
| HUD de celular | `MobileUI` | LEGADO 0% | **11 emoji como ícone** |
| Joystick | `JoystickUI` | LEGADO 0% | |

## P2 — Núcleo do laço de jogo (as janelas próprias)

| janela | componente | estado |
|---|---|---|
| Mochila (inventário + equipamento) | `MochilaIdle` | PADRÃO 97% |
| Status / atributos | `StatusIdle` | PADRÃO 92% |
| Habilidades (árvore) | `IdleSkills` | PADRÃO 98% |
| Mapa de Caça | `HuntMap` | PADRÃO 92% |
| Configuração de Caça | `IdleConfig` | PADRÃO 95% |
| Análise de Caça | `HuntAnalyzer` | PADRÃO 100% |
| Missões | `MissoesIdle` | PADRÃO 100% |
| Correio | `CorreioIdle` | PADRÃO 100% |
| Codex | `CodexIdle` | PADRÃO 100% |
| Recompensas / passe | `PasseIdle` | PADRÃO 96% |
| Procurar Grupo (LFG) | `LFGIdle` | PADRÃO 89% |
| Guilda | `Guild` | PADRÃO 99% |
| Criar guilda | `GuildCompanion` | PADRÃO 100% |
| Amigos | `PartyFriends/PartyFriendsV1` | PADRÃO 100% |
| Atalhos (hotbar) | `ShortCut` | PADRÃO 90% |
| Menu ESC | `Escape` | PADRÃO 100% |
| Painel de admin | `AdminPanel` | PARCIAL 75% |
| **Modal de morte** | `DeathWindow` | **PARCIAL 67%** |
| Tooltip de item | `ItemInfo` | PARCIAL 70% |
| Descrição de skill | `SkillDescription` | PADRÃO 100% |
| Diálogo de NPC | `NpcBox` | PADRÃO 90% |
| Menu de NPC | `NpcMenu` | PADRÃO 92% |
| Loja de NPC (compra/venda) | `NpcStore` | PADRÃO 97% |
| Armazém (Kafra) | `Storage/StorageV3` | PADRÃO 87% |
| Confirmação genérica | `WinPopup` | **PARCIAL 52%** |
| Prompt | `WinPrompt` | **SEM CSS** |
| Entrada de texto | `InputBox` | **LEGADO 0%** |

Os três últimos importam mais do que parecem: são os diálogos que **todas** as
outras janelas usam. Um `WinPopup` fora do padrão contamina toda janela que
pede confirmação.

## P3 — Nativas escondidas pelas janelas próprias

Continuam no código, mas outra janela tomou o lugar e as esconde. **Candidatas
a remoção, não a reforma** — ver `[DONO-7]`.

| nativa | quem a esconde | estado |
|---|---|---|
| `Inventory/InventoryV3` | `MochilaIdle.js:509` | PARCIAL 83% |
| `Equipment/EquipmentV3` | `MochilaIdle.js:513` | PADRÃO 88% |
| `BasicInfo/BasicInfoV5` | `BasicInfoIdle.js:329` | LEGADO 0% |
| `SkillList/SkillListV2` | `IdleSkills` | LEGADO 0% |
| `WinStats/WinStatsV1` | `StatusIdle` | sem cor |
| `Quest/Quest` | `MissoesIdle` | LEGADO 0% |
| `Rodex/*` | `CorreioIdle` | LEGADO 0% |
| `CombatCornerIdle` | aposentado | PARCIAL 71% |
| `CashShopIcon` | aposentado (`MapEngine.js:1007` comentado) | — |

## P4 — Clássicas ainda ligadas (a reforma de verdade)

Todas LEGADO, com `<ui-image src="*.bmp">` e layout de tabela.

| janela | componente | cruas | sprite |
|---|---|---|---|
| Loja de cash (RO Shop) | `CashShop` | 17 | **45** |
| Correio clássico | `Mail` | 24 | 20 |
| Refino | `Refine` + `RefineWeaponSelection` | 5 | 36 |
| Troca entre jogadores | `Trade` | 4 | 15 |
| Loja de jogador | `Vending` / `VendingShop` / `VendingReport` | 14 | 34 |
| Banco | `Bank` | 2 | 30 |
| Conquistas | `Achievement` | **39** | 22 |
| Presente diário | `CheckAttendance` | 5 | 3 |
| Clã | `Clan` | 8 | 8 |
| Reputação | `Reputation` | 3 | 17 |
| Encantamento | `Enchant` / `EnchantGrade` | 23 | 28 |
| Reforma de item | `ItemReform` | 1 | 12 |
| Laphine | `LaphineSys` / `LaphineUpg` | 8 | 34 |
| Roleta | `Roulette` | 25 | 5 |
| Mapa-múndi / navegação | `WorldMap` / `Navigation` | 73 | 18 |
| Pincode | `PincodeWindow` | — | **53** |
| Captcha (4 telas) | `Captcha` | 24 | 36 |
| Sala de chat | `ChatRoom` / `ChatRoomCreate` | 13 | 14 |
| Sussurro | `WhisperBox` | 6 | 3 |
| Config. do chat | `ChatBoxSettings` | 14 | 29 |
| Comparar item | `ItemCompare` | 10 | 5 |
| Pet / Homúnculo / Mercenário | `PetInformations`, `PetEvolution`, `HomunInformations`, `MercenaryInformations` | 6 | 43 |
| Carrinho | `CartItems`, `CartDecoration`, `ChangeCart` | 4 | 22 |
| Equipar / ver equipamento | `SwitchEquip`, `PlayerViewEquip` | 6 | 8 |
| Fabricação | `MakeItemSelection`, `MakeArrowSelection`, `MakeReadBook` | 17 | 44 |
| Emoticons | `Emoticons` | 3 | 5 |
| Menu de contexto | `ContextMenu` | 2 | 0 |
| Aviso de mudança de classe | `ClassChangeNotice` | 18 | 0 |
| Erro fatal | `Error` | 5 | 0 |
| Lista de servidores | `WinList` | 3 | 8 |

## P5 — Fora de escopo (ferramenta de desenvolvimento)

`GrfViewer` · `ModelViewer` · `GrannyModelViewer` · `StrViewer` ·
`EffectViewer` · `FPS` · `EntityRoom`

## Overlays e toasts

`Announce` · `MapName` · `PCGoldTimer` · `PvPCount` · `PvPTimer` · `Sense` ·
`ItemObtain` · `EntitySignboard` · `CardIllustration` · `ItemPreview` ·
`ItemSelection` · `SkillTargetSelection` · `ClassChangeNotice` · o toast "Em
breve" do `TopMenuIdle` · o overlay modal de `UIManager.js:128`

Entram na Fase 3 só quando a animação de abrir/fechar tiver que alcançá-los.

---

## Violações do design system já encontradas

Estas são regra escrita do documento oficial, quebradas hoje:

1. **Emoji como ícone** — o design system diz "Sem emoji" duas vezes.
   `Intro.html:22,:69` (`⚔️`, `⚙`) e `MobileUI.html` (11 emoji: 🛠️ ⛶ 🖐 💬 🔄
   ⚔️ 🧎 👀 ⚙️ 👥 🎯).
2. **Cor literal em componente** — `BasicInfoIdle.html:52` (`stroke="#e5484d"`)
   e `:62` (`stroke="#3e8bef"`), os dois SVG inline da barra de HP e SP.
3. **Sistema de token paralelo** — `Intro.css:3-15` define `--gold`, `--bg-void`,
   `--bg-panel`, `--radius` próprios, num tema escuro que não é o oficial.

## Ordem que proponho para a Fase 3

| lote | janelas | por quê |
|---|---|---|
| **1** | `TopMenuIdle`, `DockIdle`, `BasicInfoIdle` | a Fase 2 já mexe neles; e são os 3 que o jogador nunca deixa de ver |
| **2** | `WinPopup`, `WinPrompt`, `InputBox`, `DeathWindow` | os diálogos compartilhados — consertar aqui conserta em toda janela |
| **3** | `Intro`, `StatusIcons`, `ItemInfo` | as PARCIAIS que sobraram do chrome permanente |
| **4** | `CashShop`, `CheckAttendance`, `Achievement` | as clássicas que o jogador mais encontra |
| **5** | `Refine`, `Trade`, `Vending`, `Bank` | economia entre jogadores |
| **6+** | resto do P4, por frequência | |

`MobileUI` e `JoystickUI` ficam fora até você decidir `[DONO-8]`.

## Pendências desta fase

- **`[DONO-6]`** — Confirmo que Login, Seleção de Personagem, Amigos, Guilda e
  Configurações **saem** da Fase 3: já estão no padrão. Reconstruí-las seria
  refazer trabalho pronto. Concorda?
- **`[DONO-7]`** — As nativas do P3 estão escondidas por código. Quer que eu as
  **remova** em vez de reformar? É menos código e menos superfície para
  divergir.
- **`[DONO-8]`** — `MobileUI` + `JoystickUI`: 81 cores cruas, 11 emoji, zero
  token. É uma reforma inteira sozinha. Entra nesta onda ou vira a próxima?

As decisões `[DONO-1]` a `[DONO-5]`, sobre os ícones, estão em
[mapa-icones.md](mapa-icones.md).
