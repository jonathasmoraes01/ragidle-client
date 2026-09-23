# RO Shop, rodada 2 - o cliente (Agente 2, 22/09/2026)

Contrato lido: `docs/ro-shop/CONTRATO.md` do servidor (worktree
`rag-idle-master/.claude/worktrees/ro-shop`), commit **06e5e71c** ("rodada 2:
contrato aditivo dos 4 SKUs ativados, slots, carga e icones"). Nenhum campo
daqui foi inventado: o que nao estava no contrato ficou de fora.

## O que mudou

| decisao / risco | onde | como |
|---|---|---|
| Troca de Nome | `formatoDoRoShop.js` (`parametrosDoServico`, `usoDeServicoHtml`), `controladorDoRoShop.js` | formulario com o nome atual (`estado.personagem`), faixa de `servicos[].limites.novoNome` (reserva 4-23 do contrato), nome normalizado como o servidor (aparar, juntar espacos); manda `parametros.novoNome` |
| Alteracao Visual/Sexo | idem | Manter / Masculino / Feminino (0 = feminino, 1 = masculino), o sexo atual marcado, cabelo 0-27 e cor 0-8 de `limites`; `limites.sexo.fixo` desliga o sexo; manda SO o escolhido |
| chave do servico | controlador | presa aos parametros (como a do checkout ao carrinho): reenvio depois de 10 s usa a mesma; nome trocado depois disso e outro pedido |
| recusa | controlador + formato | o `texto` do servidor; "Corrigir e tentar de novo" volta ao formulario com o que foi digitado e a frase do campo de `parametrosRecusados`; mexer no campo apaga a frase |
| `requerRelog` / `desequipados` | formato | aviso "a mudanca aparece quando voce entrar de novo" so com `requerRelog === true`; lista "Guardado na mochila" |
| Seus servicos | formato | cada credito na categoria do SKU dele (resets em Utilidades, trocas em Conta) |
| "X de Y" | `contadorDaConta` | armazem `expansoes/teto`, vagas `slots.total/teto`, carga `carga.expansoes/teto`, nas cartas e no detalhe; nada calculado no cliente |
| +1 Slot na selecao | `CharSelect/vagasDaSelecao.js` + `CharSelectCommon.js` + V4 html/css | a grade V4 (15 canvas) desenha o total que o servidor informa em `TotalSlotNum` (secao 5 do contrato), esconde o resto, `create()` recusa vaga alem do total, cursor preso; contador "X de Y vagas em uso" |
| P1-02 saldo divergente | `Utils/saldoDeCash.js` | fonte UNICA: o 0x0fce (HUD), o estado do RO Shop, o `saldoDepoisMinor` da compra (nunca o de replay), o estado da Temporada e o do Passe PUBLICAM; as quatro carteiras LEEM/assinam. `Session.cash` continua sendo o que a HUD le. Troca de conta no login esquece |
| P1-10 | controlador | payload torto (tipos errados em `parametrosRecusados`, `desequipados`, `conta`, `personagem`) desenha sem excecao; o `RoShop.js` continua o unico dono do 0x0fb8 |
| modais da Temporada < 600px | `TemporadaIdle.css` | **defeito real, medido**: a regra D-932 punha `.te-modal-caixa.ri-window` estatica e o toque em Confirmar/Cancelar da compra caia no `te-modal-fundo` (360, 390, 430). Conserto: `#TemporadaIdle .te-modal-caixa.ri-window { position: relative !important; z-index: 1 }`. Desktop igual |
| itens 9000100-9000110 | `DB/Items/nomesLocais.js` (Rodada 9), `FichaDoItem.js` | nomes de `game/itens-custom.ts`; descricoes de `ITEM_IMPLEMENTATION.md` secao 3. Icone: nenhum candidato do Agente 1 esta publicado em `public/ragidle/item/`; o card do RO Shop cai no icone do conteudo (505/504/601/602) e a mochila na reserva |
| icones de buff (secao 5) | `DB/Status/StatusInfo.js` + `StatusInfoPtBr.js` | 252 Bencao (`item.tga`), 312 Manual de Job (`job.tga`), 923 Manual de EXP (`exp.tga`, entrada NOVA), com titulo e textos em portugues; o 250 continua do evento de EXP |

## Aviso para o merge

`tests/db/nomesLocais.test.js` cruza a tabela com o `conteudo.json` do jogo
quando acha a arvore irma (ou `RAG_JOGO`). Contra o pacote de hoje da arvore
principal ele REPROVA apontando 9000102-9000110: os itens so entram no
`conteudo.json` depois da regeracao da branch do RO Shop (B-RS-08 do servidor).
E o aviso certo, e some com a regeracao. Na worktree o cruzamento pula (sem
arvore irma).

## Prova

- `node scripts/foto-ro-shop.mjs` (porta 7361): os estados novos 18-25 em 390 e
  1440, com medida (transbordo, texto cortado, clique que chega). Pegou dois
  defeitos meus antes do commit: "Masculino (atual)" cortado e "Manter" e
  "Feminino" marcados juntos (`Number(null) === 0`).
- `node scripts/foto-selecao-de-personagem.mjs` (porta 7362): 15 vagas nas 7
  larguras, 9 e 12 em 390 e 1440, o fim da grade rolada.
- `node scripts/foto-temporada-modais.mjs` (porta 7363): antes/depois do
  conserto (`RAG_ROTULO_FOTO_TEMPORADA=antes|depois`).
- `python docs/ro-shop/provas-de-tela/folhas.py`: as folhas de contato em JPEG
  (os PNG ficam fora do git).
- `node scripts/mutantes-ro-shop-rodada2.mjs`: 29 mutantes nos pontos novos,
  todos mortos. **ERRATA (rodada 3, 22/09/2026):** a frase estava errada. O
  F8 ("limites do servidor ignorados") NUNCA foi aplicado: o trecho procurado
  era uma linha so, e o codigo esta em tres (o ternario quebrado pelo
  prettier); o script imprimia `TRECHO ACHADO 0x - mutante nao aplicado` e o
  placar real era **28/29** (QA independente, achado A-02). Conserto na rodada
  3: o trecho casa as tres linhas, e a bateria deu **29/29 mortos**, com o F8
  morto (1 teste reprova). Ver `RODADA-3-CLIENTE.md`.

## O que NAO foi verificado aqui

- Ponta a ponta contra o servidor real (0x0fb8/0x0fb9, 0x0fce, char-server com
  12/15 vagas): e do Agente 3.
- O sprite do personagem na selecao (o arnes nao tem GRF nem Renderer).
- Os icones de buff no jogo vivo (so a tabela foi conferida).
