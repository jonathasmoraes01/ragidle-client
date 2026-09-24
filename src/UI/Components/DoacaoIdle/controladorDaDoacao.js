/**
 * UI/Components/DoacaoIdle/controladorDaDoacao.js
 *
 * O CONTROLADOR da janela "Doacao via PIX" (23/09/2026): as telas, os
 * cliques, os campos, as travas e o relogio, sobre um elemento raiz qualquer.
 * Ele NAO importa Network, Renderer nem GUIComponent - quem liga isso ao jogo
 * e `DoacaoIdle.js`, passando `enviar`. E essa costura que deixa a janela
 * inteira rodar no jsdom (teste) e no arnes de foto sem subir servidor, o
 * mesmo desenho do `controladorDoRoShop.js`.
 *
 * ---------------------------------------------------------------------------
 * O FIO (servidor/doacao/janela-da-doacao.ts)
 * ---------------------------------------------------------------------------
 * Pedidos pelo MESMO canal JSON do RO Shop (CZ_RAGIDLE_ROSHOP):
 *   { acao: 'doacao-estado' }
 *   { acao: 'doacao-gerar', quantidade, nome, cpf }
 *   { acao: 'doacao-status', txid }
 * Respostas com `tipo: 'doacao'` (a janela do RO Shop as ignora):
 *   doacao-estado, doacao-gerar (ok/recusa), doacao-status, e
 *   doacao-confirmada, que chega SOZINHA quando o pagamento cai.
 *
 * ---------------------------------------------------------------------------
 * AS TELAS
 * ---------------------------------------------------------------------------
 *   carregando -> escolha | indisponivel
 *   escolha --gerar--> pagamento --confirmada--> sucesso
 *                          |--relogio zera----> expirado
 * A tela de ESCOLHA e desenhada UMA vez e depois so as regioes que mudam sao
 * redesenhadas (faixas, resumo, dica, botao): refazer o formulario inteiro a
 * cada tecla apagaria o foco e o cursor do campo em que o jogador digita.
 */

import {
	ATALHOS_DE_QUANTIDADE,
	LINKS,
	TRAVA_DO_JA_PAGUEI_MS,
	contagemRegressiva,
	cotar,
	cpfValido,
	creditoMinor,
	escapeHtml,
	faixasDoEstado,
	formatarInteiro,
	formatarReais,
	imagemDoQrSegura,
	indiceDaFaixa,
	lerQuantidade,
	limitarQuantidade,
	limitesDoEstado,
	mascararCpf,
	nomeParaEnvio,
	podeGerar,
	PASSOS_DO_SLIDER,
	posicaoDoSlider,
	quantidadeDoSlider,
	rotuloDaFaixa,
	soDigitos,
	textoDaCotacaoRecusada,
	textoDaDivida,
	textoDaRecusa
} from './formatoDaDoacao.js';
import { formatarRoCash } from 'Utils/roCash.js';
import RiIcones from 'UI/ri-icones.js';
import { ASSET } from '../RoShop/formatoDoRoShop.js';

/** Sem resposta do `doacao-gerar` em 15 s, a trava abre e avisa. */
export const TIMEOUT_DO_GERAR_MS = 15000;

/** A quantidade com que a janela nasce (presa aos limites do servidor). */
export const QUANTIDADE_INICIAL = 100;

/*
 * A moeda e o icone OFICIAL do RO Cash, o mesmo PNG do RO Shop (ordem do dono,
 * 23/09/2026: "troque o icone de diamante pelo nosso icone do RO Cash"). O
 * caminho vem de `ASSET.roCash` para as duas janelas nunca divergirem.
 */
const MOEDA = `<img class="dc-moeda" src="${ASSET.roCash}" alt="" aria-hidden="true" draggable="false">`;

/**
 * @param {object} opcoes
 * @param {Element|ShadowRoot} opcoes.raiz - onde mora o HTML de DoacaoIdle.html
 * @param {function(object):void} opcoes.enviar - manda um corpo JSON ao servidor
 * @param {function():number} [opcoes.agora]
 * @param {function(function, number):*} [opcoes.agendar]
 * @param {function(*):void} [opcoes.cancelar]
 * @param {function(string):Promise} [opcoes.copiar] - poe o texto na area de transferencia
 */
export function criarControladorDaDoacao(opcoes) {
	const raiz = opcoes.raiz;
	const enviar = opcoes.enviar;
	const agora = opcoes.agora || (() => Date.now());
	const agendar = opcoes.agendar || ((fn, ms) => setTimeout(fn, ms));
	const cancelar = opcoes.cancelar || (id => clearTimeout(id));
	const copiar = opcoes.copiar || copiarPadrao;
	const aoCopiar = opcoes.aoCopiar || (() => {});

	const s = {
		estado: null,
		tela: 'carregando', // carregando | escolha | indisponivel | pagamento | sucesso | expirado
		quantidade: null,
		nome: '',
		cpf: '',
		aceite: false,
		gerando: false,
		erro: '', // a recusa do ultimo gerar, na tela de escolha
		pagamento: null, // { txid, quantidade, totalCentavos, creditoMinor, copiaECola, imagemQrcode, expiraEmMs, retomado }
		recado: '', // o retorno do "Ja paguei"
		jaPagueiTravadoAte: 0,
		sucesso: null // { quantidade, creditoMinor }
	};
	let _desenhada = '';
	let _timerGerar = null;
	let _timerRelogio = null;
	let _timerTrava = null;

	const $ = sel => raiz.querySelector(sel);

	// O titulo (HTML estatico) recebe a moeda daqui, para o caminho morar num
	// lugar so (`ASSET.roCash`).
	const moedaDoTitulo = raiz.querySelector('.dc-title-moeda');
	if (moedaDoTitulo) {
		moedaDoTitulo.setAttribute('src', ASSET.roCash);
	}

	/* -------------------------------------------------------------- */
	/* Regras                                                          */
	/* -------------------------------------------------------------- */

	function limites() {
		return limitesDoEstado(s.estado);
	}

	function cotacao() {
		return s.quantidade === null ? { ok: false, recusa: 'invalida' } : cotar(s.estado, s.quantidade);
	}

	function disponivel() {
		return !!(s.estado && s.estado.disponivel === true);
	}

	function pronto() {
		return podeGerar({ cotacao: cotacao(), nome: s.nome, cpf: s.cpf, aceite: s.aceite, disponivel: disponivel() });
	}

	function jaPagueiTravado() {
		return agora() < s.jaPagueiTravadoAte;
	}

	/* -------------------------------------------------------------- */
	/* Desenho                                                         */
	/* -------------------------------------------------------------- */

	function corpo() {
		return $('.dc-corpo');
	}

	function render() {
		const el = corpo();
		if (!el) {
			return;
		}
		if (s.tela === 'escolha') {
			if (_desenhada !== 'escolha') {
				el.innerHTML = htmlDaEscolha();
				_desenhada = 'escolha';
			}
			atualizarEscolha();
			return;
		}
		_desenhada = s.tela;
		if (s.tela === 'pagamento') {
			el.innerHTML = htmlDoPagamento();
			atualizarRelogio();
			return;
		}
		if (s.tela === 'sucesso') {
			el.innerHTML = htmlDoSucesso();
			return;
		}
		if (s.tela === 'expirado') {
			el.innerHTML = telaDeRecado(RiIcones.relogio, 'O código expirou. Gere um novo.', 'Gerar um novo código', 'nova-doacao');
			return;
		}
		if (s.tela === 'indisponivel') {
			el.innerHTML = telaDeRecado(
				RiIcones.alerta,
				'A doação via PIX está indisponível no momento. Tente mais tarde.',
				'Fechar',
				'fechar'
			);
			return;
		}
		el.innerHTML = '<div class="dc-carregando" role="status">Carregando…</div>';
	}

	function telaDeRecado(icone, texto, rotulo, acao) {
		return (
			'<div class="dc-recado-tela">' +
			`<div class="dc-recado-icone" aria-hidden="true">${icone}</div>` +
			`<p class="dc-recado-texto">${escapeHtml(texto)}</p>` +
			`<button type="button" class="dc-btn dc-btn--principal" data-dc="${acao}">${escapeHtml(rotulo)}</button>` +
			'</div>'
		);
	}

	function htmlDaEscolha() {
		const l = limites();
		const atalhos = ATALHOS_DE_QUANTIDADE.filter(q => q >= l.minimo && q <= l.maximo);
		return (
			'<div class="dc-topo" data-dc-regiao="topo"></div>' +
			'<div class="dc-secao">Escolha a quantidade</div>' +
			'<div class="dc-faixas" data-dc-regiao="faixas"></div>' +
			'<div class="dc-quantidade">' +
			'<button type="button" class="dc-passo" data-dc="menos" aria-label="Diminuir">−</button>' +
			`<input type="text" class="dc-qtd" data-dc-campo="quantidade" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="Quantidade de RO Cash" value="">` +
			'<button type="button" class="dc-passo" data-dc="mais" aria-label="Aumentar">+</button>' +
			'</div>' +
			`<input type="range" class="dc-slider" data-dc-campo="slider" min="0" max="${PASSOS_DO_SLIDER}" step="1" aria-label="Quantidade de RO Cash">` +
			'<div class="dc-atalhos">' +
			atalhos
				.map(
					q =>
						`<button type="button" class="dc-atalho" data-dc="atalho" data-quantidade="${q}">${formatarInteiro(q)}</button>`
				)
				.join('') +
			'</div>' +
			'<div class="dc-resumo" data-dc-regiao="resumo"></div>' +
			'<div class="dc-dica" data-dc-regiao="dica"></div>' +
			'<div class="dc-campos">' +
			'<label class="dc-campo">' +
			'<span class="dc-rotulo">Nome completo <em>(obrigatório para gerar o PIX)</em></span>' +
			'<input type="text" class="dc-input" data-dc-campo="nome" autocomplete="name" autocapitalize="words" maxlength="140" placeholder="Seu nome completo">' +
			'</label>' +
			'<label class="dc-campo">' +
			'<span class="dc-rotulo">CPF <em>(obrigatório para gerar o PIX)</em></span>' +
			'<input type="text" class="dc-input" data-dc-campo="cpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00">' +
			'</label>' +
			'<div class="dc-campo-erro" data-dc-regiao="erro-cpf"></div>' +
			'</div>' +
			'<label class="dc-aceite">' +
			'<input type="checkbox" data-dc-campo="aceite">' +
			'<span>Ao efetuar esta doação, você reconhece que o valor pago é uma contribuição voluntária ao suporte, ao desenvolvimento e à manutenção do jogo, e que o RO Cash recebido é uma moeda de uso exclusivo dentro do jogo. Declaro que li e concordo com os ' +
			`<a href="${LINKS.termos}" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e a ` +
			`<a href="${LINKS.privacidade}" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</span>` +
			'</label>' +
			'<div class="dc-erro" data-dc-regiao="erro" role="alert"></div>' +
			'<button type="button" class="dc-btn dc-btn--principal dc-gerar" data-dc="gerar" disabled>Gerar código PIX</button>'
		);
	}

	function regiao(nome) {
		return raiz.querySelector(`[data-dc-regiao="${nome}"]`);
	}

	function campo(nome) {
		return raiz.querySelector(`[data-dc-campo="${nome}"]`);
	}

	function htmlDoTopo() {
		let html = '';
		const divida = textoDaDivida(s.estado && s.estado.dividaMinor);
		if (divida) {
			html += `<div class="dc-alerta dc-alerta--divida" role="note">${escapeHtml(divida)}</div>`;
		}
		const abertos = abertosValidos();
		if (abertos.length) {
			html +=
				'<div class="dc-abertos">' +
				'<div class="dc-abertos-titulo">Você tem um código PIX aberto</div>' +
				abertos
					.map(
						a =>
							'<div class="dc-aberto">' +
							'<span class="dc-aberto-info">' +
							`<strong>${escapeHtml(formatarReais(a.totalCentavos))}</strong>` +
							`<span>${escapeHtml(formatarInteiro(a.quantidade))} RO Cash · expira em ${escapeHtml(contagemRegressiva(a.expiraEmMs - agora()))}</span>` +
							'</span>' +
							`<button type="button" class="dc-btn dc-btn--mini" data-dc="retomar" data-txid="${escapeHtml(a.txid)}">Retomar</button>` +
							'</div>'
					)
					.join('') +
				'</div>';
		}
		return html;
	}

	function abertosValidos() {
		const lista = s.estado && Array.isArray(s.estado.abertos) ? s.estado.abertos : [];
		return lista.filter(
			a =>
				a &&
				typeof a.txid === 'string' &&
				a.txid &&
				Number.isSafeInteger(a.totalCentavos) &&
				Number.isFinite(a.expiraEmMs) &&
				a.expiraEmMs > agora()
		);
	}

	function htmlDasFaixas() {
		const faixas = faixasDoEstado(s.estado);
		const l = limites();
		const atual = s.quantidade === null ? -1 : indiceDaFaixa(faixas, s.quantidade);
		const menorPreco = faixas.reduce((m, f) => Math.min(m, f.precoPorCashCentavos), Infinity);
		return faixas
			.map((f, i) => {
				const classes = ['dc-faixa'];
				if (i === atual) {
					classes.push('is-atual');
				}
				if (f.precoPorCashCentavos === menorPreco && faixas.length > 1) {
					classes.push('is-melhor');
				}
				return (
					`<button type="button" class="${classes.join(' ')}" data-dc="faixa" data-quantidade="${f.aPartirDe}"${i === atual ? ' aria-pressed="true"' : ''}>` +
					`<span class="dc-faixa-rotulo">${escapeHtml(rotuloDaFaixa(faixas, i, l.maximo))}</span>` +
					MOEDA +
					`<span class="dc-faixa-preco"><strong>${escapeHtml(formatarReais(f.precoPorCashCentavos))}</strong> /un</span>` +
					'</button>'
				);
			})
			.join('');
	}

	function htmlDoResumo(c) {
		if (!c.ok) {
			return `<div class="dc-resumo-vazio">${escapeHtml(textoDaCotacaoRecusada(c.recusa, limites()))}</div>`;
		}
		const faixas = faixasDoEstado(s.estado);
		const l = limites();
		const rotulo = rotuloDaFaixa(faixas, c.indice, l.maximo).replace(' – ', '–');
		let html =
			'<div class="dc-resumo-linha"><span>Quantidade</span>' +
			`<strong>${escapeHtml(formatarInteiro(c.quantidade))} ${MOEDA}</strong></div>` +
			`<div class="dc-resumo-linha"><span>Faixa (${escapeHtml(rotulo)})</span>` +
			`<strong>${escapeHtml(formatarReais(c.precoPorCashCentavos))}/un</strong></div>`;
		if (l.bonusPercent > 0) {
			html +=
				`<div class="dc-resumo-linha dc-resumo-bonus"><span>Bônus de evento</span><strong>+${l.bonusPercent}%</strong></div>` +
				`<div class="dc-resumo-linha dc-resumo-bonus"><span>Você recebe</span>` +
				`<strong>${escapeHtml(formatarRoCash(c.creditoMinor))} RO Cash</strong></div>`;
		}
		html +=
			'<div class="dc-divisor" aria-hidden="true"></div>' +
			'<div class="dc-total"><span>Total</span>' +
			`<strong data-dc-regiao="total">${escapeHtml(formatarReais(c.totalCentavos))}</strong></div>`;
		if (c.descontoPercent > 0) {
			html += `<div class="dc-economia">Você economiza ${c.descontoPercent}%</div>`;
		}
		return html;
	}

	function htmlDaDica(c) {
		if (!c.ok || !c.sugestao) {
			return '';
		}
		const q = c.sugestao.quantidade;
		return (
			'<div class="dc-leve">' +
			`<span>Leve ${escapeHtml(formatarInteiro(q))} e pague ${escapeHtml(formatarReais(c.sugestao.economiaCentavos))} a menos!</span>` +
			`<button type="button" class="dc-btn dc-btn--mini dc-btn--ouro" data-dc="levar" data-quantidade="${q}">Levar ${escapeHtml(formatarInteiro(q))}</button>` +
			'</div>'
		);
	}

	/** Redesenha as regioes da escolha sem tocar nos campos em que se digita. */
	function atualizarEscolha() {
		const c = cotacao();
		const l = limites();
		const topo = regiao('topo');
		if (topo) {
			topo.innerHTML = htmlDoTopo();
		}
		const faixas = regiao('faixas');
		if (faixas) {
			faixas.innerHTML = htmlDasFaixas();
		}
		const resumo = regiao('resumo');
		if (resumo) {
			resumo.innerHTML = htmlDoResumo(c);
		}
		const dica = regiao('dica');
		if (dica) {
			dica.innerHTML = htmlDaDica(c);
		}
		const qtd = campo('quantidade');
		const valorQtd = s.quantidade === null ? '' : String(s.quantidade);
		if (qtd && qtd.value !== valorQtd && !estaFocado(qtd)) {
			qtd.value = valorQtd;
		}
		const slider = campo('slider');
		if (slider && !estaFocado(slider)) {
			slider.value = String(posicaoDoSlider(s.quantidade === null ? l.minimo : s.quantidade, l.minimo, l.maximo));
		}
		raiz.querySelectorAll('[data-dc="atalho"]').forEach(b => {
			b.classList.toggle('is-ativo', Number(b.dataset.quantidade) === s.quantidade);
		});
		const erroCpf = regiao('erro-cpf');
		if (erroCpf) {
			erroCpf.textContent = soDigitos(s.cpf).length === 11 && !cpfValido(s.cpf) ? 'CPF inválido. Confira os números.' : '';
		}
		const erro = regiao('erro');
		if (erro) {
			erro.textContent = s.erro;
		}
		const gerar = raiz.querySelector('[data-dc="gerar"]');
		if (gerar) {
			gerar.disabled = s.gerando || !pronto();
			gerar.textContent = s.gerando ? 'Gerando…' : 'Gerar código PIX';
		}
	}

	function estaFocado(el) {
		const ativo = raiz.activeElement !== undefined ? raiz.activeElement : el.ownerDocument && el.ownerDocument.activeElement;
		return ativo === el;
	}

	function htmlDoPagamento() {
		const p = s.pagamento;
		const qr = imagemDoQrSegura(p.imagemQrcode);
		const credito = Number.isSafeInteger(p.creditoMinor) ? p.creditoMinor : creditoMinor(p.quantidade, limites().bonusPercent);
		let html = '<div class="dc-pag">';
		html +=
			'<p class="dc-pag-chamada">Abra o app do seu banco e pague com PIX. O RO Cash cai na sua carteira assim que o pagamento for confirmado.</p>';
		if (qr) {
			html += `<div class="dc-qr-moldura"><img class="dc-qr" src="${escapeHtml(qr)}" alt="QR Code do PIX" draggable="false"></div>`;
		}
		if (typeof p.copiaECola === 'string' && p.copiaECola) {
			html +=
				'<div class="dc-rotulo">PIX copia e cola</div>' +
				'<div class="dc-copia-linha">' +
				`<input type="text" class="dc-input dc-copia" readonly value="${escapeHtml(p.copiaECola)}" aria-label="Código PIX copia e cola">` +
				'<button type="button" class="dc-btn dc-btn--ouro dc-copiar" data-dc="copiar">Copiar</button>' +
				'</div>';
		} else {
			html +=
				'<p class="dc-nota">O código copia-e-cola não fica guardado. Se você já está com ele no app do banco, é só pagar; se perdeu o código, volte e gere outro.</p>';
		}
		html +=
			'<div class="dc-pag-info">' +
			`<div><span>Total</span><strong>${escapeHtml(formatarReais(p.totalCentavos))}</strong></div>` +
			`<div><span>Você recebe</span><strong>${escapeHtml(formatarRoCash(credito))} RO Cash</strong></div>` +
			'</div>' +
			`<div class="dc-expira">Expira em <strong data-dc-regiao="relogio">${escapeHtml(contagemRegressiva(p.expiraEmMs - agora()))}</strong></div>` +
			`<div class="dc-recado" data-dc-regiao="recado" role="status">${escapeHtml(s.recado)}</div>` +
			`<button type="button" class="dc-btn dc-btn--principal" data-dc="ja-paguei"${jaPagueiTravado() ? ' disabled' : ''}>Já paguei</button>` +
			'<button type="button" class="dc-btn dc-btn--secundario" data-dc="voltar">Voltar</button>' +
			'</div>';
		return html;
	}

	function htmlDoSucesso() {
		const r = s.sucesso || {};
		const credito = Number.isSafeInteger(r.creditoMinor) ? r.creditoMinor : creditoMinor(r.quantidade || 0);
		return (
			'<div class="dc-recado-tela dc-sucesso">' +
			`<div class="dc-recado-icone" aria-hidden="true"><img class="dc-moeda dc-moeda--grande" src="${ASSET.roCash}" alt="" draggable="false"></div>` +
			'<p class="dc-sucesso-titulo">Obrigado pelo apoio!</p>' +
			`<p class="dc-recado-texto">+${escapeHtml(formatarRoCash(credito))} RO Cash na sua carteira.</p>` +
			'<button type="button" class="dc-btn dc-btn--principal" data-dc="fechar">Fechar</button>' +
			'<button type="button" class="dc-btn dc-btn--secundario" data-dc="nova-doacao">Fazer outra doação</button>' +
			'</div>'
		);
	}

	function atualizarRelogio() {
		if (_timerRelogio) {
			cancelar(_timerRelogio);
			_timerRelogio = null;
		}
		if (s.tela !== 'pagamento' || !s.pagamento) {
			return;
		}
		const restante = s.pagamento.expiraEmMs - agora();
		if (restante <= 0) {
			s.pagamento = null;
			s.recado = '';
			s.tela = 'expirado';
			render();
			return;
		}
		const el = regiao('relogio');
		if (el) {
			el.textContent = contagemRegressiva(restante);
		}
		/* Acorda no proximo segundo cheio, para o relogio nao pular numeros. */
		const ate = restante % 1000 || 1000;
		_timerRelogio = agendar(atualizarRelogio, ate);
	}

	function recado(texto) {
		s.recado = texto;
		const el = regiao('recado');
		if (el) {
			el.textContent = texto;
		}
	}

	/* -------------------------------------------------------------- */
	/* Acoes                                                           */
	/* -------------------------------------------------------------- */

	function definirQuantidade(n) {
		const l = limites();
		s.quantidade = limitarQuantidade(n, l.minimo, l.maximo);
		s.erro = '';
		const qtd = campo('quantidade');
		if (qtd) {
			qtd.value = String(s.quantidade);
		}
		atualizarEscolha();
	}

	function gerar() {
		if (s.gerando || !pronto()) {
			return;
		}
		s.gerando = true;
		s.erro = '';
		atualizarEscolha();
		enviar({ acao: 'doacao-gerar', quantidade: s.quantidade, nome: nomeParaEnvio(s.nome), cpf: soDigitos(s.cpf) });
		_timerGerar = agendar(() => {
			_timerGerar = null;
			if (!s.gerando) {
				return;
			}
			s.gerando = false;
			s.erro = 'O servidor não respondeu. Tente de novo.';
			if (s.tela === 'escolha') {
				atualizarEscolha();
			}
		}, TIMEOUT_DO_GERAR_MS);
	}

	function jaPaguei() {
		if (!s.pagamento || jaPagueiTravado()) {
			return;
		}
		s.jaPagueiTravadoAte = agora() + TRAVA_DO_JA_PAGUEI_MS;
		enviar({ acao: 'doacao-status', txid: s.pagamento.txid });
		const btn = raiz.querySelector('[data-dc="ja-paguei"]');
		if (btn) {
			btn.disabled = true;
		}
		recado('Verificando o pagamento…');
		if (_timerTrava) {
			cancelar(_timerTrava);
		}
		_timerTrava = agendar(() => {
			_timerTrava = null;
			const b = raiz.querySelector('[data-dc="ja-paguei"]');
			if (b) {
				b.disabled = false;
			}
		}, TRAVA_DO_JA_PAGUEI_MS);
	}

	function retomar(txid) {
		const a = abertosValidos().find(x => x.txid === txid);
		if (!a) {
			return;
		}
		s.pagamento = {
			txid: a.txid,
			quantidade: a.quantidade,
			totalCentavos: a.totalCentavos,
			creditoMinor: null,
			copiaECola: null,
			imagemQrcode: null,
			expiraEmMs: a.expiraEmMs,
			retomado: true
		};
		s.recado = '';
		s.tela = 'pagamento';
		render();
	}

	function voltarParaEscolha() {
		s.pagamento = null;
		s.sucesso = null;
		s.recado = '';
		s.erro = '';
		s.tela = s.estado ? (disponivel() ? 'escolha' : 'indisponivel') : 'carregando';
		render();
		/* O codigo que ficou aberto aparece em "Retomar" com o estado novo. */
		enviar({ acao: 'doacao-estado' });
	}

	function onClick(e) {
		const alvo = e && e.target && e.target.closest ? e.target.closest('[data-dc]') : null;
		if (!alvo || (raiz.contains && !raiz.contains(alvo))) {
			return false;
		}
		switch (alvo.dataset.dc) {
			case 'fechar':
				return 'fechar';
			case 'menos':
				definirQuantidade((s.quantidade === null ? limites().minimo : s.quantidade) - 1);
				break;
			case 'mais':
				definirQuantidade((s.quantidade === null ? limites().minimo : s.quantidade) + 1);
				break;
			case 'atalho':
			case 'faixa':
			case 'levar':
				definirQuantidade(Number(alvo.dataset.quantidade));
				break;
			case 'gerar':
				gerar();
				break;
			case 'copiar':
				copiarCodigo(alvo);
				break;
			case 'ja-paguei':
				jaPaguei();
				break;
			case 'voltar':
			case 'nova-doacao':
				voltarParaEscolha();
				break;
			case 'retomar':
				retomar(alvo.dataset.txid);
				break;
			default:
				return false;
		}
		return true;
	}

	function copiarCodigo(btn) {
		const codigo = s.pagamento && s.pagamento.copiaECola;
		if (!codigo) {
			return;
		}
		const confirmar = () => aoCopiar(btn);
		Promise.resolve()
			.then(() => copiar(codigo, $('.dc-copia')))
			.then(confirmar, () => recado('Não foi possível copiar. Selecione o código e copie à mão.'));
	}

	function onInput(e) {
		const el = e && e.target;
		const nome = el && el.dataset ? el.dataset.dcCampo : null;
		if (!nome) {
			return false;
		}
		const l = limites();
		switch (nome) {
			case 'quantidade': {
				const n = lerQuantidade(el.value, l.maximo);
				const limpo = n === null ? '' : String(n);
				if (el.value !== limpo) {
					el.value = limpo;
				}
				s.quantidade = n;
				if (e.type === 'change' && (n === null || n < l.minimo)) {
					/* Saiu do campo com menos que o minimo: prende no minimo. */
					definirQuantidade(l.minimo);
					return true;
				}
				s.erro = '';
				break;
			}
			case 'slider':
				s.quantidade = limitarQuantidade(quantidadeDoSlider(el.value, l.minimo, l.maximo), l.minimo, l.maximo);
				s.erro = '';
				{
					const qtd = campo('quantidade');
					if (qtd) {
						qtd.value = String(s.quantidade);
					}
				}
				break;
			case 'nome':
				s.nome = el.value;
				break;
			case 'cpf': {
				const mascarado = mascararCpf(el.value);
				if (el.value !== mascarado) {
					el.value = mascarado;
				}
				s.cpf = mascarado;
				break;
			}
			case 'aceite':
				s.aceite = el.checked === true;
				break;
			default:
				return false;
		}
		if (s.tela === 'escolha') {
			atualizarEscolha();
		}
		return true;
	}

	/* -------------------------------------------------------------- */
	/* O fio                                                           */
	/* -------------------------------------------------------------- */

	function receber(dados) {
		if (!dados || typeof dados !== 'object' || dados.tipo !== 'doacao') {
			return false;
		}
		switch (dados.acao) {
			case 'doacao-estado':
				receberEstado(dados);
				break;
			case 'doacao-gerar':
				receberGerar(dados);
				break;
			case 'doacao-status':
				receberStatus(dados);
				break;
			case 'doacao-confirmada':
				receberConfirmada(dados);
				break;
			default:
				return false;
		}
		return true;
	}

	function receberEstado(dados) {
		s.estado = dados;
		if (s.quantidade === null) {
			const l = limites();
			s.quantidade = limitarQuantidade(QUANTIDADE_INICIAL, l.minimo, l.maximo);
		}
		if (s.tela === 'carregando' || s.tela === 'escolha' || s.tela === 'indisponivel') {
			s.tela = disponivel() ? 'escolha' : 'indisponivel';
			render();
		}
	}

	function receberGerar(dados) {
		if (_timerGerar) {
			cancelar(_timerGerar);
			_timerGerar = null;
		}
		s.gerando = false;
		if (dados.ok === true && typeof dados.txid === 'string' && Number.isFinite(dados.expiraEmMs)) {
			s.pagamento = {
				txid: dados.txid,
				quantidade: dados.quantidade,
				totalCentavos: dados.totalCentavos,
				creditoMinor: dados.creditoMinor,
				copiaECola: dados.copiaECola,
				imagemQrcode: dados.imagemQrcode,
				expiraEmMs: dados.expiraEmMs,
				retomado: false
			};
			s.recado = '';
			s.erro = '';
			s.tela = 'pagamento';
			render();
			return;
		}
		s.erro = textoDaRecusa(dados);
		if (s.tela === 'escolha') {
			atualizarEscolha();
		}
	}

	function receberStatus(dados) {
		if (!s.pagamento || dados.txid !== s.pagamento.txid) {
			return;
		}
		switch (dados.estado) {
			case 'creditada':
				mostrarSucesso({ quantidade: s.pagamento.quantidade, creditoMinor: s.pagamento.creditoMinor });
				break;
			case 'expirada':
				s.pagamento = null;
				s.tela = 'expirado';
				render();
				break;
			case 'pendente':
				recado('Ainda não recebemos o pagamento. Se você já pagou, aguarde alguns segundos e toque de novo.');
				break;
			case 'estornada':
				recado('Esta doação foi estornada.');
				break;
			default:
				recado('Não encontramos este código. Volte e gere um novo.');
		}
	}

	function receberConfirmada(dados) {
		mostrarSucesso({ quantidade: dados.quantidade, creditoMinor: dados.creditoMinor });
	}

	function mostrarSucesso(r) {
		if (_timerRelogio) {
			cancelar(_timerRelogio);
			_timerRelogio = null;
		}
		s.pagamento = null;
		s.recado = '';
		s.sucesso = r;
		s.tela = 'sucesso';
		render();
	}

	/* -------------------------------------------------------------- */
	/* Ciclo                                                           */
	/* -------------------------------------------------------------- */

	function abrir() {
		render();
		if (s.tela === 'pagamento') {
			atualizarRelogio();
		}
		enviar({ acao: 'doacao-estado' });
	}

	function fechar() {
		/* Sucesso e expirado sao telas de UMA leitura: quem reabre volta a
		   escolher. O pagamento em curso fica (o relogio continua valendo). */
		if (s.tela === 'sucesso' || s.tela === 'expirado') {
			s.sucesso = null;
			s.tela = s.estado ? (disponivel() ? 'escolha' : 'indisponivel') : 'carregando';
		}
		if (_timerRelogio) {
			cancelar(_timerRelogio);
			_timerRelogio = null;
		}
	}

	/** Troca de personagem: nada do anterior fica (nome e CPF menos ainda). */
	function limpar() {
		[_timerGerar, _timerRelogio, _timerTrava].forEach(t => t && cancelar(t));
		_timerGerar = _timerRelogio = _timerTrava = null;
		Object.assign(s, {
			estado: null,
			tela: 'carregando',
			quantidade: null,
			nome: '',
			cpf: '',
			aceite: false,
			gerando: false,
			erro: '',
			pagamento: null,
			recado: '',
			jaPagueiTravadoAte: 0,
			sucesso: null
		});
		_desenhada = '';
		const el = corpo();
		if (el) {
			el.innerHTML = '';
		}
	}

	return {
		abrir,
		fechar,
		limpar,
		render,
		receber,
		onClick,
		onInput,
		/** Leitura para teste e prova de tela. */
		get estadoDaTela() {
			return { ...s };
		}
	};
}

/**
 * Copiar: o Clipboard API quando houver, senao o velho `select()` +
 * `execCommand` sobre o proprio campo (o mesmo par da janela de indicacao).
 */
function copiarPadrao(texto, campo) {
	const reserva = () => {
		if (!campo) {
			throw new Error('sem campo para copiar');
		}
		campo.focus();
		campo.select();
		if (!document.execCommand('copy')) {
			throw new Error('execCommand recusou');
		}
	};
	if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
		return navigator.clipboard.writeText(texto).catch(reserva);
	}
	reserva();
	return Promise.resolve();
}
