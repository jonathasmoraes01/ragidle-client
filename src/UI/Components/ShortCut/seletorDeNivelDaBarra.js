/**
 * O SELETOR DE NIVEL DE UM SLOT JA POSTO NA BARRA (D-1908).
 *
 * Pedido do dono: *"preciso que seja possivel alterar o nivel da habilidade
 * ativa que sera usada, seja na barra (manual) ou no automatico (...) E que
 * seja facil do player identificar/fazer isso, tanto no mobile como no
 * desktop."* A janela de Habilidades escolhe o nivel ANTES de por na barra;
 * este balao muda o de um slot que ja esta la:
 *
 * - no desktop, o BOTAO DIREITO no slot (que antes so abria a descricao — ela
 *   continua a um toque, no botao "Descricao" do balao);
 * - no celular, TOCAR E SEGURAR o slot (o toque simples nao fazia nada sem
 *   algo na mao, e continua nao fazendo; o duplo toque continua usando).
 *
 * Cada "−"/"+" REGRAVA o slot pelo caminho de sempre (`ShortCut.addElement` +
 * `ShortCut.onChange`, que manda o `CZ_SHORTCUT_KEY_CHANGE2`): o servidor
 * guarda o nivel no slot, e o "max" acompanha a habilidade quando ela sobe
 * (D-1907).
 *
 * ─── POR QUE UM BALAO, E NAO UMA JANELA DA PILHA ────────────────────────
 * Registrar na `pilhaDeJanelas` marcaria o host da BARRA com `.ri-janela` e a
 * transformaria em painel de tela cheia no celular (D-932) — o motivo do
 * cartaz de boas-vindas ficar de fora tambem. O que a pilha da a uma janela e
 * mantido por outros meios: o ESC e o voltar do Android o fecham PRIMEIRO
 * (`fecharSeletorDeNivel`, que a pilha pergunta antes de olhar as janelas), um
 * toque fora fecha, e ha um so balao por vez.
 *
 * Este modulo e uma FABRICA sem dependencia da barra: quem a monta passa o que
 * ela precisa ler e escrever. E isso que deixa o comportamento inteiro ser
 * provado em jsdom (`tests/ui/seletorDeNivelDaBarra.test.js`).
 */

import {
	escapar,
	htmlDoSeletorDeNivel,
	lerPassoDoSeletor,
	nivelDoSlotComPasso,
	registrarFechamentoDoSeletor,
	fecharSeletorDeNivel,
	spLembrado
} from 'UI/nivelDeUso.js';

/** Quanto o dedo segura para abrir o seletor — o "segurar" do Android. */
export const MS_PARA_SEGURAR = 500;
/** Deslizar mais que isto e rolar/arrastar, e nao segurar. */
export const DESLIZE_QUE_CANCELA = 10;

/**
 * @param {object} d
 * @param {() => Element} d.conteiner     onde o balao mora (o `#ShortCut`)
 * @param {(indice:number) => ({isSkill:boolean, ID:number, count:number}|undefined)} d.slot
 * @param {(ID:number) => number} d.aprendido   0 = desconhecido
 * @param {(ID:number) => string} d.nome        o nome que a barra mostra
 * @param {(ID:number) => string} d.nomeNoBanco o `Name` do SkillInfo (chave do SP lembrado)
 * @param {(indice:number, ID:number, nivel:number) => void} d.regravar
 * @param {(ID:number) => void} d.descricao
 * @param {(indice:number) => Element|null} d.ancora  o slot na tela
 * @param {(px:number) => number} [d.emUnidadesDaHud]
 */
export function criarSeletorDeNivelDaBarra(d) {
	const converter = d.emUnidadesDaHud || (px => px);
	let _aberto = null;
	let _porFora = null;

	function balao() {
		const conteiner = d.conteiner();
		let el = conteiner.querySelector('.shortcut-nivel');
		if (!el) {
			el = conteiner.ownerDocument.createElement('div');
			el.className = 'shortcut-nivel';
			el.setAttribute('role', 'dialog');
			// O balao mora DENTRO do `#ShortCut`, que e o punho de arrastar a
			// barra (`draggable`): sem isto, apertar "−" carregaria a barra junto.
			el.addEventListener('mousedown', e => e.stopImmediatePropagation());
			el.addEventListener('pointerdown', e => e.stopImmediatePropagation());
			el.addEventListener('click', aoClicar);
			conteiner.appendChild(el);
		}
		return el;
	}

	function desenhar() {
		const s = _aberto === null ? undefined : d.slot(_aberto);
		if (!s || !s.isSkill || !s.ID) {
			fechar();
			return;
		}
		const el = balao();
		const aprendido = d.aprendido(s.ID);
		const nome = d.nome(s.ID);
		const nivel = aprendido >= 1 ? Math.min(s.count, aprendido) : s.count;
		el.setAttribute('aria-label', `Nível de uso de ${nome}`);
		el.innerHTML =
			`<div class="shortcut-nivel-titulo">${escapar(nome)}</div>` +
			(aprendido >= 1
				? htmlDoSeletorDeNivel({
						chave: `barra.${_aberto}`,
						nivel,
						aprendido,
						fixo: nivel < aprendido,
						sp: spLembrado(d.nomeNoBanco(s.ID), nivel),
						nome
					})
				: '<div class="shortcut-nivel-aviso">O nível aprendido ainda não chegou.</div>') +
			'<div class="shortcut-nivel-acoes">' +
			'<button type="button" class="ri-btn ri-btn--sec shortcut-nivel-acao" data-acao="descricao">Descrição</button>' +
			'<button type="button" class="ri-btn shortcut-nivel-acao" data-acao="fechar">Fechar</button>' +
			'</div>';
		el.classList.add('show');
		posicionar(el);
	}

	function posicionar(el) {
		const ancora = _aberto === null ? null : d.ancora(_aberto);
		if (!ancora || !ancora.getBoundingClientRect) {
			return;
		}
		const r = ancora.getBoundingClientRect();
		const b = el.getBoundingClientRect();
		const largura = (el.ownerDocument.defaultView && el.ownerDocument.defaultView.innerWidth) || 0;
		let left = r.left + r.width / 2 - b.width / 2;
		if (largura > 0) {
			left = Math.max(8, Math.min(left, largura - b.width - 8));
		}
		let top = r.top - b.height - 6;
		if (top < 8) {
			top = r.bottom + 6;
		}
		// Mesma conversao da dica (D-934): o host da barra pode ter `zoom`.
		el.style.left = `${converter(left)}px`;
		el.style.top = `${converter(top)}px`;
	}

	function aoClicar(e) {
		e.stopImmediatePropagation();
		const acao = e.target && e.target.closest ? e.target.closest('[data-acao]') : null;
		if (acao) {
			const s = _aberto === null ? undefined : d.slot(_aberto);
			if (acao.getAttribute('data-acao') === 'descricao' && s && s.ID) {
				d.descricao(s.ID);
			}
			fecharSeletorDeNivel();
			return;
		}
		const passo = lerPassoDoSeletor(e.target);
		if (!passo || _aberto === null) {
			return;
		}
		const s = d.slot(_aberto);
		if (!s || !s.isSkill) {
			return;
		}
		// Sem guarda de "mudou?": o botao que nao mudaria nada ja esta apagado
		// (o "−" no 1, o "+" no maximo), e o apagado nao chega aqui
		// (`lerPassoDoSeletor`).
		d.regravar(_aberto, s.ID, nivelDoSlotComPasso(s.count, d.aprendido(s.ID), passo.passo));
		desenhar();
	}

	function ligarPorFora() {
		const doc = d.conteiner().ownerDocument;
		if (_porFora) {
			return;
		}
		_porFora = e => {
			const el = d.conteiner().querySelector('.shortcut-nivel');
			const caminho = typeof e.composedPath === 'function' ? e.composedPath() : [];
			if (el && (caminho.includes(el) || el.contains(e.target))) {
				return;
			}
			fecharSeletorDeNivel();
		};
		doc.addEventListener('pointerdown', _porFora, true);
	}

	function desligarPorFora() {
		if (!_porFora) {
			return;
		}
		d.conteiner().ownerDocument.removeEventListener('pointerdown', _porFora, true);
		_porFora = null;
	}

	/** O fechamento de verdade — quem chama de fora usa `fecharSeletorDeNivel`. */
	function fechar() {
		_aberto = null;
		registrarFechamentoDoSeletor(null);
		desligarPorFora();
		const el = d.conteiner().querySelector('.shortcut-nivel');
		if (el) {
			el.classList.remove('show');
		}
	}

	/**
	 * Abre (ou redesenha) o seletor do slot. So para habilidade: item na barra
	 * nao tem nivel. Devolve se abriu.
	 */
	function abrir(indice) {
		const s = d.slot(indice);
		if (!s || !s.isSkill || !s.ID) {
			return false;
		}
		_aberto = indice;
		registrarFechamentoDoSeletor(fechar);
		ligarPorFora();
		desenhar();
		return true;
	}

	/** O slot do seletor aberto, ou null. */
	function aberto() {
		return _aberto;
	}

	/** A barra foi redesenhada (a lista do servidor): o balao aberto acompanha. */
	function redesenharSeAberto() {
		if (_aberto !== null) {
			desenhar();
		}
	}

	/*
	 * O TOCAR E SEGURAR. Os quatro ouvintes vao no `#ShortCut` (delegados), e
	 * so o DEDO (ou a caneta) conta: o mouse tem o botao direito. Deslizar
	 * cancela — e rolar a pagina de atalhos ou arrastar o icone.
	 */
	let _segurando = null;

	function cancelarSegurar() {
		if (_segurando) {
			clearTimeout(_segurando.timer);
			_segurando = null;
		}
	}

	function aoApertar(e) {
		if (e.pointerType !== 'touch' && e.pointerType !== 'pen') {
			return;
		}
		const icone = e.target && e.target.closest ? e.target.closest('.icon') : null;
		const slotEl = icone && icone.parentNode;
		const indice = slotEl ? parseInt(slotEl.getAttribute('data-index'), 10) : NaN;
		if (!Number.isInteger(indice)) {
			return;
		}
		cancelarSegurar();
		_segurando = {
			x: e.clientX,
			y: e.clientY,
			timer: setTimeout(() => {
				_segurando = null;
				abrir(indice);
			}, MS_PARA_SEGURAR)
		};
	}

	function aoMover(e) {
		if (_segurando && Math.hypot(e.clientX - _segurando.x, e.clientY - _segurando.y) > DESLIZE_QUE_CANCELA) {
			cancelarSegurar();
		}
	}

	function ligarSegurar(alvo) {
		alvo.addEventListener('pointerdown', aoApertar);
		alvo.addEventListener('pointermove', aoMover);
		alvo.addEventListener('pointerup', cancelarSegurar);
		alvo.addEventListener('pointercancel', cancelarSegurar);
		alvo.addEventListener('pointerleave', cancelarSegurar);
	}

	return { abrir, aberto, fechar, redesenharSeAberto, ligarSegurar, cancelarSegurar };
}
