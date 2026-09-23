/**
 * UI/Components/RoShop/controladorDoRoShop.js
 *
 * O CONTROLADOR do RO Shop: estado da tela, cliques, carrinho, trava e
 * checkout, sobre um elemento raiz qualquer. NAO importa Network, Renderer,
 * DB nem GUIComponent - quem liga isso ao jogo e `RoShop.js`, passando
 * `enviar`/`abrirTemporada`/`resolverIcone`. E essa costura que deixa a janela
 * inteira rodar no jsdom (teste) e no arnes de foto do Playwright com um
 * `estado` de exemplo, sem subir servidor.
 *
 * ---------------------------------------------------------------------------
 * A CHAVE DO CHECKOUT (idempotencia, CONTRATO.md secao 3)
 * ---------------------------------------------------------------------------
 * A `chave` nasce UMA vez por checkout - no clique em "Confirmar compra" - e
 * fica presa ao carrinho daquele momento (`assinatura`). Se o servidor nao
 * responde em 10 s, a trava abre e o proximo "Confirmar" REENVIA A MESMA
 * chave: se o primeiro pedido chegou e so a resposta se perdeu, o servidor
 * devolve o MESMO pedido, sem novo debito. A chave so e trocada quando o
 * carrinho muda ou quando o servidor responde (ok ou recusa).
 *
 * ---------------------------------------------------------------------------
 * A TRAVA
 * ---------------------------------------------------------------------------
 * Enquanto um checkout esta no fio, `enviando` e verdadeiro e TODO botao que
 * gasta (Confirmar, Comprar) fica desabilitado no HTML e recusado aqui: dois
 * cliques rapidos nunca geram dois pedidos.
 *
 * ---------------------------------------------------------------------------
 * O SALDO E UM SO NA TELA INTEIRA (rodada 2, risco P1-02 da QA)
 * ---------------------------------------------------------------------------
 * Todo saldo que chega aqui (o `estado`, o `saldoDepoisMinor` de uma compra)
 * e PUBLICADO por `opcoes.aoSaldo`, e todo saldo que chega por fora (a HUD, a
 * Temporada, o Passe) entra por `atualizarSaldo`. Quem liga os dois lados a
 * `Utils/saldoDeCash.js` e o `RoShop.js`.
 */

import {
	adicionarAoCarrinho,
	assinaturaDoCarrinho,
	atalhoTemporadaHtml,
	buscarProdutos,
	camposIniciaisDoServico,
	carrinhoHtml,
	carteiraHtml,
	deslocamentoParaMostrar,
	categoriasDoEstado,
	categoriasHtml,
	checkoutHtml,
	definirQuantidade,
	detalhesHtml,
	escapeHtml,
	gradeHtml,
	paginacaoHtml,
	paginar,
	parametrosDoServico,
	pedidoDeCheckout,
	produtoPorSku,
	produtosDaCategoria,
	quantidadeNoCarrinho,
	reconciliarCarrinho,
	normalizar,
	removerDoCarrinho,
	resumoDoCarrinho,
	servicoPorId,
	servicosHtml,
	textoDaRecarga,
	textoDaRecusa,
	usoDeServicoHtml,
	POR_PAGINA
} from './formatoDoRoShop.js';
import { ehMinor, formatarRoCash } from 'Utils/roCash.js';

/** A tarefa pede: sem resposta em 10 s, destrava e avisa. */
export const TIMEOUT_MS = 10000;

/** Quanto o aviso do rodape fica na tela. */
const AVISO_MS = 4200;

/** Icone real por id: a arte publicada do cliente. Quem monta pode trocar. */
function resolverIconePadrao(id, aoCarregar, aoFalhar) {
	const img = new Image();
	img.onload = () => aoCarregar(img.src);
	img.onerror = () => aoFalhar();
	img.src = `/ragidle/item/${id}.png`;
}

/**
 * @param {object} opcoes
 * @param {Element|ShadowRoot} opcoes.raiz - onde mora o HTML de RoShop.html
 * @param {function(object):void} opcoes.enviar - manda um corpo JSON ao servidor
 * @param {function():void} [opcoes.abrirTemporada]
 * @param {function():string} opcoes.gerarChave
 * @param {function(number, function(string):void, function():void):void} [opcoes.resolverIcone]
 * @param {function(number):void} [opcoes.aoSaldo] - um saldo novo do servidor chegou por esta janela
 */
export function criarControlador(opcoes) {
	const raiz = opcoes.raiz;
	const enviar = opcoes.enviar;
	const abrirTemporada = opcoes.abrirTemporada || (() => {});
	const aoSaldo = opcoes.aoSaldo || (() => {});
	const gerarChave = opcoes.gerarChave;
	const resolverIcone = opcoes.resolverIcone || resolverIconePadrao;
	const agendar = opcoes.agendar || ((fn, ms) => setTimeout(fn, ms));
	const cancelar = opcoes.cancelar || (id => clearTimeout(id));

	const s = {
		estado: null,
		carga: 'carregando', // 'carregando' | 'pronto' | 'erro'
		categoria: null,
		busca: '',
		pagina: 1,
		carrinho: [],
		gaveta: false,
		detalhes: null, // sku aberto no modal de detalhes
		checkout: null, // { fase, chave, assinatura, resultado }
		servico: null // { fase, id, chave, assinatura, campos, recusados, resultado } - o uso de um credito de servico
	};
	/* O que o modal de servico tem desenhado: o formulario so e refeito quando
	   isto muda, para uma re-renderizacao no meio da digitacao (um estado novo,
	   um saldo novo) nunca apagar o foco nem o cursor do campo de nome. */
	let _servicoDesenhado = '';
	/* A categoria que a fita do celular ja trouxe para a vista (A-06). */
	let _categoriaMostrada = null;
	let _timerEstado = null;
	let _timerCheckout = null;
	let _timerServico = null;
	let _timerAviso = null;

	const $ = sel => raiz.querySelector(sel);

	/* -------------------------------------------------------------- */
	/* Aviso                                                           */
	/* -------------------------------------------------------------- */

	function aviso(texto, tipo = 'info') {
		const el = $('.rs-aviso');
		if (!el || !texto) {
			return;
		}
		el.textContent = texto;
		el.dataset.tipo = tipo;
		el.classList.add('is-visivel');
		if (_timerAviso) {
			cancelar(_timerAviso);
		}
		_timerAviso = agendar(() => {
			el.classList.remove('is-visivel');
			_timerAviso = null;
		}, AVISO_MS);
	}

	/* -------------------------------------------------------------- */
	/* Pedidos                                                         */
	/* -------------------------------------------------------------- */

	function pedirEstado() {
		if (_timerEstado) {
			cancelar(_timerEstado);
		}
		_timerEstado = agendar(() => {
			_timerEstado = null;
			if (!s.estado) {
				s.carga = 'erro';
				render();
			}
		}, TIMEOUT_MS);
		enviar({ acao: 'estado' });
	}

	function enviandoCheckout() {
		return !!(s.checkout && s.checkout.fase === 'enviando');
	}

	function enviandoServico() {
		return !!(s.servico && s.servico.fase === 'enviando');
	}

	/**
	 * O uso de um credito de servico (`usar-servico`). Mesma disciplina do
	 * checkout: a `chave` nasce no primeiro "Usar agora" e e REUSADA no reenvio
	 * depois de 10 s sem resposta; a trava segura o clique duplo.
	 */
	function confirmarServico() {
		if (!s.servico || enviandoServico() || enviandoCheckout()) {
			return;
		}
		/* Troca de Nome e de Aparencia levam `parametros`; o basico e conferido
		   aqui e o resto e do servidor. Invalido nao sai do cliente. */
		const p = parametrosDoServico(s.servico.id, s.servico.campos, servicoPorId(s.estado, s.servico.id));
		if (!p.ok) {
			aviso(p.erro, 'erro');
			return;
		}
		/* A chave fica presa aos parametros, como a do checkout fica ao
		   carrinho: o reenvio do MESMO pedido reusa; um nome diferente depois do
		   timeout e OUTRO pedido, com chave nova (o servidor recusaria a velha
		   como `chave-reutilizada`). */
		const assinatura = JSON.stringify(p.parametros);
		if (!s.servico.chave || s.servico.assinatura !== assinatura) {
			s.servico.chave = gerarChave();
			s.servico.assinatura = assinatura;
		}
		s.servico.fase = 'enviando';
		render();
		if (_timerServico) {
			cancelar(_timerServico);
		}
		_timerServico = agendar(() => {
			_timerServico = null;
			if (enviandoServico()) {
				s.servico.fase = 'confirmar';
				render();
				aviso('Sem resposta do servidor. Confirme de novo para reenviar o mesmo pedido.', 'erro');
			}
		}, TIMEOUT_MS);
		const corpo = { acao: 'usar-servico', chave: s.servico.chave, servico: s.servico.id };
		if (p.parametros) {
			corpo.parametros = p.parametros;
		}
		enviar(corpo);
	}

	/** O checkout: mesma chave enquanto o carrinho nao mudar (reenvio). */
	function confirmarCheckout() {
		if (enviandoCheckout() || !s.checkout) {
			return;
		}
		const resumo = resumoDoCarrinho(s.carrinho, s.estado);
		if (!resumo.linhas.length || resumo.saldoMinor === null) {
			return;
		}
		const assinatura = assinaturaDoCarrinho(s.carrinho);
		if (!s.checkout.chave || s.checkout.assinatura !== assinatura) {
			s.checkout.chave = gerarChave();
			s.checkout.assinatura = assinatura;
		}
		s.checkout.fase = 'enviando';
		render();
		if (_timerCheckout) {
			cancelar(_timerCheckout);
		}
		_timerCheckout = agendar(() => {
			_timerCheckout = null;
			if (enviandoCheckout()) {
				/* A chave FICA: o proximo Confirmar reenvia o mesmo pedido. */
				s.checkout.fase = 'confirmar';
				render();
				aviso('Sem resposta do servidor. Confirme de novo para reenviar o mesmo pedido.', 'erro');
			}
		}, TIMEOUT_MS);
		enviar(pedidoDeCheckout(s.carrinho, s.estado, s.checkout.chave));
	}

	/* -------------------------------------------------------------- */
	/* Pacotes                                                         */
	/* -------------------------------------------------------------- */

	/** Um saldo que chegou por ESTA janela vai para a fonte unica. */
	function publicar(minor) {
		if (ehMinor(minor) && minor >= 0) {
			aoSaldo(minor);
		}
	}

	function receberEstado(dados) {
		s.estado = dados;
		s.carga = 'pronto';
		publicar(dados && dados.moeda && dados.moeda.saldoMinor);
		if (_timerEstado) {
			cancelar(_timerEstado);
			_timerEstado = null;
		}
		const cats = categoriasDoEstado(dados);
		if (!cats.some(c => String(c.id) === String(s.categoria))) {
			s.categoria = cats.length ? cats[0].id : null;
		}
		/* Nao reconcilia no meio de um checkout: o carrinho que esta no fio e o
		   que a chave assinou. */
		if (!enviandoCheckout()) {
			const r = reconciliarCarrinho(s.carrinho, dados);
			s.carrinho = r.carrinho;
			if (r.removidos.length) {
				aviso(`${r.removidos[0].nome} saiu do carrinho: ${r.removidos[0].texto}`, 'erro');
			} else if (r.ajustados.length) {
				aviso(`${r.ajustados[0].nome}: quantidade ajustada ao limite de ${r.ajustados[0].quantidade}.`, 'info');
			}
		}
		render();
	}

	function receberResultado(dados) {
		if (dados.acao === 'usar-servico' && s.servico && s.servico.chave && s.servico.chave === dados.chave) {
			if (_timerServico) {
				cancelar(_timerServico);
				_timerServico = null;
			}
			/* Os campos FICAM: numa recusa ("nome em uso") o jogador corrige e
			   tenta de novo sem redigitar tudo - e o proximo pedido e outro, com
			   chave nova. `parametrosRecusados` diz QUAL campo o servidor recusou. */
			const recusados =
				dados.ok !== true && dados.parametrosRecusados && typeof dados.parametrosRecusados === 'object'
					? dados.parametrosRecusados
					: null;
			s.servico = {
				fase: dados.ok === true ? 'sucesso' : 'erro',
				id: s.servico.id,
				chave: null,
				assinatura: '',
				campos: s.servico.campos,
				recusados,
				resultado: dados
			};
			render();
			return;
		}
		if (dados.acao !== 'checkout') {
			if (dados.texto) {
				aviso(String(dados.texto), dados.ok === false ? 'erro' : 'sucesso');
			}
			return;
		}
		const pendente = s.checkout && s.checkout.chave && s.checkout.chave === dados.chave;
		if (!pendente) {
			/* Resposta de um checkout que esta janela ja largou (reabriu, trocou
			   de personagem): so o texto, sem mexer no carrinho de agora. */
			if (dados.texto) {
				aviso(String(dados.texto), dados.ok === false ? 'erro' : 'sucesso');
			}
			return;
		}
		if (_timerCheckout) {
			cancelar(_timerCheckout);
			_timerCheckout = null;
		}
		if (dados.ok === true) {
			/* O saldo depois da compra entra na fonte unica AGORA: a Temporada e
			   o Passe abertos nao esperam o pacote deles para concordar. O
			   replay (`repetido`) nao publica: o saldo dele e o do instante da
			   compra ORIGINAL, e o `estado` que vem logo atras traz o de agora. */
			if (dados.pedido && dados.pedido.repetido !== true) {
				publicar(dados.pedido.saldoDepoisMinor);
			}
			s.carrinho = [];
			s.gaveta = false;
			s.checkout = { fase: 'sucesso', chave: null, assinatura: '', resultado: dados };
		} else {
			/* Recusado: a chave morre com o pedido; o proximo e outro pedido. */
			s.checkout = { fase: 'erro', chave: null, assinatura: '', resultado: dados };
		}
		render();
	}

	/**
	 * A entrada unica do ZC_RAGIDLE_ROSHOP. Defensiva por regra do projeto: uma
	 * excecao num handler aborta o laco de rede e descarta o resto do quadro.
	 */
	function receber(dados) {
		if (!dados || typeof dados !== 'object') {
			return;
		}
		if (dados.versao !== 1) {
			/* Versao que esta janela nao sabe ler: nao adivinha campo. */
			return;
		}
		if (dados.tipo === 'estado') {
			receberEstado(dados);
		} else if (dados.tipo === 'resultado') {
			receberResultado(dados);
		}
	}

	/* -------------------------------------------------------------- */
	/* Desenho                                                         */
	/* -------------------------------------------------------------- */

	function categoriaAtiva() {
		return categoriasDoEstado(s.estado).find(c => String(c.id) === String(s.categoria)) || null;
	}

	function listaVisivel() {
		if (s.busca.trim()) {
			return buscarProdutos(s.estado, s.busca);
		}
		return produtosDaCategoria(s.estado, categoriaAtiva());
	}

	function melhorarIcones(escopo) {
		if (!escopo) {
			return;
		}
		escopo.querySelectorAll('[data-item-ids]').forEach(el => {
			if (el.dataset.tentado) {
				return;
			}
			el.dataset.tentado = '1';
			const ids = String(el.dataset.itemIds)
				.split(',')
				.map(Number)
				.filter(n => Number.isInteger(n) && n > 0);
			const tentar = i => {
				if (i >= ids.length) {
					return;
				}
				try {
					resolverIcone(
						ids[i],
						url => {
							const img = el.querySelector('img');
							if (img && url) {
								img.src = url;
								img.className = 'rs-retrato-arte';
								el.classList.add('is-arte');
							}
						},
						() => tentar(i + 1)
					);
				} catch (_err) {
					tentar(i + 1);
				}
			};
			tentar(0);
		});
	}

	/**
	 * A CHIP ATIVA DENTRO DA VISTA (rodada 3, achado A-06 da QA). No celular a
	 * barra de categorias e uma fita que rola na horizontal, e "Conta" ativa
	 * ficava fora da vista - o jogador via a grade de Conta sem saber em que
	 * aba estava. So a fita rola, e so na HORIZONTAL (`scrollLeft`): um
	 * `scrollIntoView` tambem rolaria a area principal na vertical. E so quando
	 * a categoria MUDA ou a janela reabre: um redesenho qualquer (saldo novo,
	 * item no carrinho) nao puxa de volta a fita que o jogador rolou com o dedo.
	 */
	function mostrarCategoriaAtiva(cats) {
		const chave = s.busca.trim() ? '' : String(s.categoria);
		if (chave === _categoriaMostrada) {
			return;
		}
		_categoriaMostrada = chave;
		const chip = cats.querySelector('.rs-categoria.is-ativa');
		if (!chip || cats.scrollWidth <= cats.clientWidth) {
			return;
		}
		const delta = deslocamentoParaMostrar(cats.getBoundingClientRect(), chip.getBoundingClientRect());
		if (delta) {
			cats.scrollLeft += delta;
		}
	}

	function renderCarteiras() {
		raiz.querySelectorAll('[data-slot="carteira"]').forEach(el => {
			el.innerHTML = carteiraHtml(s.estado);
		});
	}

	function renderPrincipal() {
		const cats = $('.rs-categorias');
		const grade = $('.rs-grade');
		const pag = $('.rs-paginacao');
		const titulo = $('.rs-grade-titulo');
		const temporada = $('[data-slot="temporada"]');
		if (cats) {
			cats.innerHTML = categoriasHtml(categoriasDoEstado(s.estado), s.categoria, !!s.busca.trim());
			mostrarCategoriaAtiva(cats);
		}
		if (temporada) {
			temporada.innerHTML = atalhoTemporadaHtml(s.estado && s.estado.temporada);
		}
		/* Os creditos de servico moram em Utilidades e Conta, que e onde o
		   jogador comprou o servico - e somem na busca. */
		const servicos = $('[data-slot="servicos"]');
		if (servicos) {
			const cat = categoriaAtiva();
			const chave = cat ? normalizar(cat.id) || normalizar(cat.nome) : '';
			servicos.innerHTML =
				!s.busca.trim() && (chave === 'utilidades' || chave === 'conta') ? servicosHtml(s.estado, chave) : '';
		}
		if (!grade) {
			return;
		}
		/* Carregando e erro NAO tem paginacao: "Pagina 1 de 1" embaixo de "Nao
		   foi possivel carregar a loja" dizia que havia uma pagina de produtos
		   (rodada 3, achado A-08 da QA). */
		if (s.carga === 'carregando' && !s.estado) {
			grade.dataset.estado = 'carregando';
			grade.innerHTML =
				'<div class="rs-grade-estado"><span class="rs-girando" aria-hidden="true"></span><p>Carregando a loja...</p></div>';
			if (pag) {
				pag.innerHTML = '';
			}
			if (titulo) {
				titulo.innerHTML = '';
			}
			return;
		}
		if (s.carga === 'erro' && !s.estado) {
			grade.dataset.estado = 'erro';
			grade.innerHTML =
				'<div class="rs-grade-estado rs-grade-estado--erro"><p>Não foi possível carregar a loja.</p>' +
				'<button type="button" class="rs-btn rs-btn--sec" data-rs="tentar-de-novo">Tentar de novo</button></div>';
			if (pag) {
				pag.innerHTML = '';
			}
			if (titulo) {
				titulo.innerHTML = '';
			}
			return;
		}
		grade.dataset.estado = 'pronto';
		const lista = listaVisivel();
		const pagina = paginar(lista, s.pagina, POR_PAGINA);
		s.pagina = pagina.pagina;
		const termo = s.busca.trim();
		const vazio = termo
			? `Nenhum produto encontrado para "${termo}".`
			: 'Nenhum produto nesta categoria no momento.';
		grade.innerHTML = gradeHtml(pagina.itens, s.estado, s.carrinho, vazio);
		if (titulo) {
			const cat = categoriaAtiva();
			titulo.innerHTML = termo
				? `<span>Resultados para <strong>"${escapeHtml(termo)}"</strong> (${lista.length})</span>` +
					'<button type="button" class="rs-link" data-rs="limpar-busca">Limpar busca</button>'
				: cat
					? `<h3>${escapeHtml(cat.nome || cat.id)}</h3><span>${lista.length} ${lista.length === 1 ? 'produto' : 'produtos'}</span>`
					: '';
		}
		if (pag) {
			pag.innerHTML = paginacaoHtml(pagina.pagina, pagina.totalPaginas);
		}
		melhorarIcones(grade);
	}

	function renderCarrinho() {
		const resumo = resumoDoCarrinho(s.carrinho, s.estado);
		const corpo = $('.rs-carrinho-corpo');
		if (corpo) {
			corpo.innerHTML = carrinhoHtml(resumo, s.estado, enviandoCheckout());
			melhorarIcones(corpo);
		}
		const contagem = raiz.querySelectorAll('[data-slot="contagem"]');
		contagem.forEach(el => {
			el.textContent = String(resumo.quantidadeTotal);
			el.hidden = resumo.quantidadeTotal === 0;
		});
		const totalMovel = $('[data-slot="total-movel"]');
		if (totalMovel) {
			totalMovel.textContent = resumo.linhas.length ? `${formatarRoCash(resumo.totalMinor)} RO Cash` : 'Vazio';
		}
		const janela = $('.rs-window');
		if (janela) {
			janela.classList.toggle('is-gaveta-aberta', s.gaveta);
		}
	}

	function renderModais() {
		const det = $('.rs-modal--detalhes');
		if (det) {
			const produto = s.detalhes ? produtoPorSku(s.estado, s.detalhes) : null;
			det.hidden = !produto;
			const corpo = det.querySelector('.rs-modal-corpo');
			if (produto && corpo) {
				corpo.innerHTML = detalhesHtml(produto, s.estado, quantidadeNoCarrinho(s.carrinho, produto.sku));
				melhorarIcones(corpo);
				const t = det.querySelector('.rs-modal-titulo');
				if (t) {
					t.textContent = 'Detalhes';
				}
			}
		}
		const chk = $('.rs-modal--checkout');
		if (chk) {
			chk.hidden = !s.checkout;
			const corpo = chk.querySelector('.rs-modal-corpo');
			if (s.checkout && corpo) {
				const resumo = resumoDoCarrinho(s.carrinho, s.estado);
				corpo.innerHTML = checkoutHtml(s.checkout.fase, resumo, s.checkout.resultado);
				const t = chk.querySelector('.rs-modal-titulo');
				if (t) {
					t.textContent =
						s.checkout.fase === 'sucesso'
							? 'Compra concluída'
							: s.checkout.fase === 'erro'
								? 'Compra não concluída'
								: 'Confirmar compra';
				}
			}
		}
	}

	function renderServico() {
		const modal = $('.rs-modal--servico');
		if (!modal) {
			return;
		}
		modal.hidden = !s.servico;
		const corpo = modal.querySelector('.rs-modal-corpo');
		if (!s.servico) {
			_servicoDesenhado = '';
		}
		if (s.servico && corpo) {
			/* Refaz o corpo so quando a FORMA muda (fase, servico, sexo escolhido,
			   um resultado novo). Digitar no campo nao muda a forma: o texto ja
			   esta no campo, e so o "Usar agora" acende ou apaga. */
			const forma = [
				s.servico.fase,
				s.servico.id,
				s.servico.campos ? String(s.servico.campos.sexo) : '',
				s.servico.resultado ? String(s.servico.resultado.chave) : ''
			].join('|');
			if (forma === _servicoDesenhado && corpo.firstChild) {
				atualizarBotaoDoServico();
				return;
			}
			_servicoDesenhado = forma;
			corpo.innerHTML = usoDeServicoHtml(
				s.servico.fase,
				servicoPorId(s.estado, s.servico.id) || { servico: s.servico.id },
				s.servico.resultado,
				{
					campos: s.servico.campos,
					personagem: (s.estado && s.estado.personagem) || null,
					recusados: s.servico.recusados || null
				}
			);
			const t = modal.querySelector('.rs-modal-titulo');
			if (t) {
				t.textContent =
					s.servico.fase === 'sucesso'
						? 'Serviço aplicado'
						: s.servico.fase === 'erro'
							? 'Serviço não aplicado'
							: 'Usar serviço';
			}
		}
	}

	/** O "Usar agora" acende so com os parametros aceitos (e nunca no fio). */
	function atualizarBotaoDoServico() {
		const btn = $('.rs-modal--servico [data-rs="confirmar-servico"]');
		if (!btn || !s.servico) {
			return;
		}
		btn.disabled =
			enviandoServico() ||
			!parametrosDoServico(s.servico.id, s.servico.campos, servicoPorId(s.estado, s.servico.id)).ok;
	}

	/**
	 * Um saldo NOVO chegou por fora desta janela (a HUD, a Temporada, o Passe -
	 * `Utils/saldoDeCash.js`). Ele entra no estado desenhado, e a carteira, o
	 * "Saldo apos" do carrinho e a confirmacao aberta passam a concordar com a
	 * pilula da HUD. Sem estado ainda, nada a fazer: o estado que vier traz o
	 * dele.
	 */
	function atualizarSaldo(minor) {
		if (!s.estado || !ehMinor(minor) || minor < 0) {
			return;
		}
		const moeda = s.estado.moeda || {};
		if (moeda.saldoMinor === minor) {
			return;
		}
		s.estado = { ...s.estado, moeda: { ...moeda, saldoMinor: minor } };
		renderCarteiras();
		renderCarrinho();
		renderModais();
	}

	function render() {
		renderServico();
		renderCarteiras();
		renderPrincipal();
		renderCarrinho();
		renderModais();
	}

	/* -------------------------------------------------------------- */
	/* Cliques                                                         */
	/* -------------------------------------------------------------- */

	function mexerNoCarrinho(novo) {
		s.carrinho = novo;
		/* Carrinho mudou: um checkout que ainda nao foi enviado perde a chave. */
		if (s.checkout && s.checkout.fase !== 'enviando') {
			s.checkout.chave = null;
		}
	}

	function adicionar(sku) {
		const produto = produtoPorSku(s.estado, sku);
		const r = adicionarAoCarrinho(s.carrinho, produto, 1);
		if (r.recusa) {
			aviso(textoDaRecusa(r.recusa, produto), 'erro');
			render();
			return false;
		}
		mexerNoCarrinho(r.carrinho);
		aviso(`${produto.nome} no carrinho.`, 'sucesso');
		render();
		return true;
	}

	function onClick(e) {
		const alvo = e.target && e.target.closest ? e.target.closest('[data-rs]') : null;
		if (!alvo) {
			if (e.target && e.target.classList && e.target.classList.contains('rs-modal-fundo')) {
				fecharModalDoTopo();
			}
			return false;
		}
		if (alvo.disabled) {
			return true;
		}
		const acao = alvo.dataset.rs;
		const sku = alvo.dataset.sku;
		switch (acao) {
			case 'fechar':
				return 'fechar';
			case 'categoria':
				s.categoria = alvo.dataset.categoria;
				s.busca = '';
				s.pagina = 1;
				limparCampoDeBusca();
				render();
				break;
			case 'buscar':
				s.busca = lerCampoDeBusca();
				s.pagina = 1;
				render();
				break;
			case 'limpar-busca':
				s.busca = '';
				s.pagina = 1;
				limparCampoDeBusca();
				render();
				break;
			case 'pagina':
				s.pagina = Number(alvo.dataset.pagina) || 1;
				render();
				break;
			case 'adicionar':
				if (adicionar(sku) && alvo.dataset.fecha) {
					s.detalhes = null;
					render();
				}
				break;
			case 'detalhes':
				s.detalhes = sku;
				render();
				break;
			case 'mais':
			case 'menos': {
				if (enviandoCheckout()) {
					break;
				}
				const produto = produtoPorSku(s.estado, sku);
				const atual = quantidadeNoCarrinho(s.carrinho, sku);
				mexerNoCarrinho(definirQuantidade(s.carrinho, produto, atual + (acao === 'mais' ? 1 : -1)));
				render();
				break;
			}
			case 'remover':
				if (enviandoCheckout()) {
					break;
				}
				mexerNoCarrinho(removerDoCarrinho(s.carrinho, sku));
				render();
				break;
			case 'comprar':
				if (enviandoCheckout() || enviandoServico()) {
					break;
				}
				s.checkout = { fase: 'confirmar', chave: null, assinatura: '', resultado: null };
				render();
				break;
			case 'confirmar':
				confirmarCheckout();
				break;
			case 'fechar-checkout':
				if (enviandoCheckout()) {
					break;
				}
				s.checkout = null;
				render();
				break;
			case 'fechar-detalhes':
				s.detalhes = null;
				render();
				break;
			case 'abrir-gaveta':
				s.gaveta = true;
				render();
				break;
			case 'fechar-gaveta':
				s.gaveta = false;
				render();
				break;
			case 'recarregar':
				/* So MOSTRA o texto do servidor - nenhum pacote, nenhum credito. */
				aviso(textoDaRecarga(s.estado), 'info');
				break;
			case 'usar-servico':
				if (enviandoCheckout() || enviandoServico()) {
					break;
				}
				s.servico = {
					fase: 'confirmar',
					id: alvo.dataset.servico,
					chave: null,
					assinatura: '',
					campos: camposIniciaisDoServico(alvo.dataset.servico),
					resultado: null
				};
				render();
				focarPrimeiroCampo();
				break;
			case 'confirmar-servico':
				confirmarServico();
				break;
			case 'aparencia-sexo':
				if (!s.servico || s.servico.fase !== 'confirmar' || !s.servico.campos) {
					break;
				}
				s.servico.campos = {
					...s.servico.campos,
					sexo: alvo.dataset.valor === '' ? null : Number(alvo.dataset.valor)
				};
				if (s.servico.recusados) {
					s.servico.recusados = { ...s.servico.recusados, sexo: null, parametros: null };
				}
				renderServico();
				break;
			case 'voltar-servico':
				/* Da recusa de volta ao formulario, com o que o jogador ja tinha
				   escrito; o proximo pedido nasce com chave nova. */
				if (!s.servico || s.servico.fase !== 'erro') {
					break;
				}
				s.servico = { ...s.servico, fase: 'confirmar', chave: null, assinatura: '', resultado: null };
				renderServico();
				focarPrimeiroCampo();
				break;
			case 'fechar-servico':
				if (enviandoServico()) {
					break;
				}
				s.servico = null;
				render();
				break;
			case 'ir-temporada':
				abrirTemporada();
				break;
			case 'tentar-de-novo':
				s.carga = 'carregando';
				render();
				pedirEstado();
				break;
			default:
				return false;
		}
		return true;
	}

	function lerCampoDeBusca() {
		const campo = $('.rs-busca-campo');
		return campo ? String(campo.value || '') : '';
	}

	function limparCampoDeBusca() {
		const campo = $('.rs-busca-campo');
		if (campo) {
			campo.value = '';
		}
	}

	/** O campo de texto do formulario de servico recebe o foco ao abrir. */
	function focarPrimeiroCampo() {
		const campo = $('.rs-modal--servico [data-rs-campo]');
		if (campo && typeof campo.focus === 'function') {
			try {
				campo.focus({ preventScroll: true });
			} catch (_err) {
				/* jsdom antigo sem opcoes de foco: sem foco, sem dano */
			}
		}
	}

	/** Busca ao digitar (o catalogo tem 18 produtos: filtrar a cada tecla e barato). */
	function onInput(e) {
		const campo = e.target && e.target.dataset ? e.target.dataset.rsCampo : null;
		if (campo) {
			/* O formulario do servico: guarda o que foi digitado e so acende ou
			   apaga o "Usar agora" - sem redesenhar (o cursor fica onde esta). */
			if (s.servico && s.servico.fase === 'confirmar' && s.servico.campos && campo in s.servico.campos) {
				s.servico.campos = { ...s.servico.campos, [campo]: String(e.target.value || '') };
				/* Mexeu no campo que o servidor recusou: a frase da recusa sai. */
				if (s.servico.recusados && s.servico.recusados[campo]) {
					s.servico.recusados = { ...s.servico.recusados, [campo]: null };
					const erro = $(`.rs-modal--servico [data-rs-erro="${campo}"]`);
					if (erro) {
						erro.remove();
					}
					e.target.classList.remove('is-invalido');
				}
				atualizarBotaoDoServico();
			}
			return;
		}
		if (!e.target || !e.target.classList || !e.target.classList.contains('rs-busca-campo')) {
			return;
		}
		s.busca = String(e.target.value || '');
		s.pagina = 1;
		renderPrincipal();
	}

	/** O ESC fecha o que esta por cima; devolve true se fechou algo. */
	function fecharModalDoTopo() {
		if (s.servico) {
			if (!enviandoServico()) {
				s.servico = null;
				render();
			}
			return true;
		}
		if (s.checkout) {
			if (enviandoCheckout()) {
				return true;
			}
			s.checkout = null;
			render();
			return true;
		}
		if (s.detalhes) {
			s.detalhes = null;
			render();
			return true;
		}
		if (s.gaveta) {
			s.gaveta = false;
			render();
			return true;
		}
		return false;
	}

	/** Ao abrir a janela: desenha o que tem e pede o estado novo. */
	function abrir() {
		if (!s.estado) {
			s.carga = 'carregando';
		}
		/* A janela reabre com a fita no comeco: a chip ativa volta para a vista. */
		_categoriaMostrada = null;
		render();
		pedirEstado();
	}

	/** Ao fechar: modais e gaveta saem; o carrinho fica (mesma sessao). */
	function fechar() {
		if (!enviandoCheckout()) {
			s.checkout = null;
		}
		if (!enviandoServico()) {
			s.servico = null;
		}
		s.detalhes = null;
		s.gaveta = false;
		render();
	}

	/** Troca de personagem: nada do anterior sobrevive. */
	function limpar() {
		[_timerEstado, _timerCheckout, _timerServico, _timerAviso].forEach(t => t && cancelar(t));
		_timerEstado = _timerCheckout = _timerServico = _timerAviso = null;
		s.estado = null;
		s.carga = 'carregando';
		s.categoria = null;
		s.busca = '';
		s.pagina = 1;
		s.carrinho = [];
		s.gaveta = false;
		s.detalhes = null;
		s.checkout = null;
		s.servico = null;
		limparCampoDeBusca();
		render();
	}

	return {
		abrir,
		fechar,
		limpar,
		receber,
		render,
		onClick,
		onInput,
		fecharModalDoTopo,
		atualizarSaldo,
		/** So para teste e para o arnes de foto: o estado interno, somente leitura. */
		espiar: () => ({ ...s, carrinho: s.carrinho.map(l => ({ ...l })) })
	};
}
