/**
 * UI/Components/CombatCornerIdle/arcoDeSkills.js
 *
 * O ARCO DE SKILLS EM VOLTA DO BOTAO AUTO (pedido do dono, 15/10/2026, HUD mobile premium): as tres skills
 * do rodizio do Bot (`BotMenu/rodizioDoAuto.js`) em discos em volta do Auto, com o icone de verdade; tocar
 * USA a skill na hora, pelo mesmo caminho da barra de atalhos (`ShortCut.useSkill`).
 *
 * Este modulo e so o DESENHO e a DECISAO do toque, sem gancho de rede, para o teste alcancar em jsdom. Quem
 * ouve o Bot, a barra e o clique e o `CombatCornerIdle.js`.
 *
 * Os discos existem sempre que o componente existe, e so a HUD premium os mostra (CSS): no desktop e na HUD
 * vertical de D-939 o `.cc-rodizio` e `display: none`.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

import { TETO_DO_ARCO } from 'UI/Components/BotMenu/rodizioDoAuto.js';

/** O icone publicado da skill (o mesmo do rodizio na janela do Bot, `editorDoRodizio.js`). */
export function iconeDaSkill(chave) {
	return chave ? '/ragidle/skills/' + encodeURIComponent(chave) + '.png' : '';
}

function garantirDiscos(container) {
	const doc = container.ownerDocument;
	while (container.children.length < TETO_DO_ARCO) {
		const i = container.children.length;
		const b = doc.createElement('button');
		b.type = 'button';
		b.className = 'cc-skill';
		b.dataset.pos = String(i);
		const icone = doc.createElement('span');
		icone.className = 'cc-skill-icone';
		const img = doc.createElement('img');
		img.alt = '';
		img.setAttribute('aria-hidden', 'true');
		img.draggable = false;
		/* Icone que nao chegou (skill sem icone publicado): o disco cai na inicial da skill (CSS), e a marca
		   segura o mesmo endereco de ser pedido de novo a cada desenho. */
		img.addEventListener('error', () => {
			img.dataset.falhou = img.getAttribute('src') || '';
		});
		icone.appendChild(img);
		b.appendChild(icone);
		container.appendChild(b);
	}
	return Array.prototype.slice.call(container.children, 0, TETO_DO_ARCO);
}

function definir(el, nome, valor) {
	if (valor === null) {
		if (el.hasAttribute(nome)) el.removeAttribute(nome);
	} else if (el.getAttribute(nome) !== valor) {
		el.setAttribute(nome, valor);
	}
}

/** A letra do disco sem icone: a primeira do nome (o `#123` de skill sem nome vira `#`). */
function inicialDe(nome) {
	const primeira = String(nome || '')
		.trim()
		.charAt(0);
	return primeira ? primeira.toUpperCase() : null;
}

/*
 * Troca o icone so quando o endereco muda. Sem icone o `src` SAI do elemento: `src=""` faz o navegador pedir a
 * propria pagina de novo.
 */
function trocarIcone(img, src) {
	if (!src) {
		if (img.hasAttribute('src')) img.removeAttribute('src');
		delete img.dataset.falhou;
		return;
	}
	if (img.getAttribute('src') !== src) {
		delete img.dataset.falhou;
		img.setAttribute('src', src);
	}
}

/**
 * Desenha os tres discos. Disco sem skill vira o "+" que leva ao menu do Bot (onde o rodizio se escolhe):
 * nada de disco falso, todo disco tem destino.
 *
 * @param {Element} container o `.cc-rodizio`
 * @param {import('UI/Components/BotMenu/rodizioDoAuto.js').SkillDoArco[]} itens
 */
export function desenharArco(container, itens) {
	const discos = garantirDiscos(container);
	discos.forEach((b, i) => {
		const item = itens[i] || null;
		const img = b.querySelector('img');
		b.classList.toggle('is-vazio', !item);
		b.classList.toggle('is-desligada', !!item && !item.ativa);
		if (item) {
			definir(b, 'data-skill', String(item.skillId));
			definir(b, 'data-nivel', item.nivel === null ? null : String(item.nivel));
			const rotulo = item.ativa ? `Usar ${item.nome}` : `Usar ${item.nome} (desligada no automático)`;
			definir(b, 'aria-label', rotulo);
			definir(b, 'title', rotulo);
			definir(b, 'data-inicial', inicialDe(item.nome));
			trocarIcone(img, iconeDaSkill(item.chave));
		} else {
			definir(b, 'data-skill', null);
			definir(b, 'data-nivel', null);
			definir(b, 'aria-label', 'Escolher as skills do automático');
			definir(b, 'title', 'Escolher as skills do automático');
			definir(b, 'data-inicial', null);
			trocarIcone(img, '');
		}
	});
	return discos;
}

/**
 * O que um toque no disco pede: usar a skill (com o nivel do rodizio, ou o escolhido na janela de skills
 * quando o rodizio diz "aprendido" e o nivel ainda nao chegou), ou abrir o menu do Bot no disco vazio.
 *
 * @param {Element} disco
 * @returns {{acao: 'usar', skillId: number, nivel: number|undefined}|{acao: 'escolher'}|null}
 */
export function acaoDoToque(disco) {
	if (!disco || !disco.classList || !disco.classList.contains('cc-skill')) {
		return null;
	}
	if (disco.classList.contains('is-vazio')) {
		return { acao: 'escolher' };
	}
	const skillId = Number(disco.getAttribute('data-skill'));
	if (!Number.isInteger(skillId) || skillId <= 0) {
		return null;
	}
	const nivel = Number(disco.getAttribute('data-nivel'));
	return { acao: 'usar', skillId, nivel: Number.isInteger(nivel) && nivel > 0 ? nivel : undefined };
}

/** Os slots que o relogio de recarga (`ShortCut/relogioDaBarra.js`) desenha: a skill e o icone de cada disco. */
export function slotsDoArco(container) {
	if (!container) {
		return [];
	}
	return Array.prototype.map.call(container.querySelectorAll('.cc-skill'), b => {
		const id = Number(b.getAttribute('data-skill'));
		return {
			skillId: Number.isInteger(id) && id > 0 ? id : null,
			icone: b.querySelector('.cc-skill-icone')
		};
	});
}
