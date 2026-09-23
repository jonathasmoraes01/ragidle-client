/**
 * A JANELA DE CADASTRO DENTRO DA TELA DE LOGIN (23/09/2026, pedido do dono).
 *
 * O "Criar conta" do login levava o jogador para fora do jogo, ao site. Agora a
 * MESMA janela do site (`#pre-modal`, rag-idle-site) abre aqui, por cima do
 * login, com os mesmos campos e o mesmo `POST /cadastrar` no balcao.
 *
 * O depois tambem e o do site (D-1379): o balcao devolve um passe de uso unico,
 * `armarEntrada` o registra e o login sai com ele, entao o jogador entra ja
 * logado, direto na criacao de personagem, e a conversao do Pixel conta. Sem
 * passe na resposta (servidor anterior a D-1379), entra com a senha digitada.
 *
 * As regras de `conferirCadastro` sao as do site (`conferirPreRegistro`), que
 * copiam `servidor/contas.ts`. O servidor confere de novo: esta copia e
 * conforto, nunca a guarda.
 * Teste: `tests/ui/cadastroNaEntrada.test.js`.
 */
import Configs from 'Core/Configs.js';
import { rotaDoBalcao } from 'UI/enderecoDoBalcao.js';
import { armarEntrada } from 'Engine/entradaPosCadastro.js';

const USUARIO_VALIDO = /^[A-Za-z0-9_]{4,23}$/;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;
const REF_VALIDO = /^[A-Za-z0-9]{6}$/;

/**
 * @param {{nome: string, telefone: string, email: string, usuario: string, senha: string}} d
 * @returns {string | null} o problema, ou `null`
 */
export function conferirCadastro(d) {
	if (d.nome.length < 2 || d.nome.length > 60) return 'Diga seu nome (2 a 60 caracteres).';
	if (!EMAIL_VALIDO.test(d.email) || d.email.length > 120) return 'O e-mail não parece válido.';
	if (d.telefone.length > 24) return 'O telefone é longo demais.';
	if ((d.telefone.match(/\d/g) || []).length < 8) return 'O telefone precisa ter ao menos 8 dígitos.';
	if (!USUARIO_VALIDO.test(d.usuario)) return 'O usuário precisa ter de 4 a 23 caracteres: letras, números e _.';
	if (d.senha.length < 4 || d.senha.length > 23) return 'A senha precisa ter de 4 a 23 caracteres.';
	return null;
}

/**
 * Manda o cadastro ao balcao e diz como entrar.
 *
 * @param {object} dados - ja conferidos
 * @param {typeof fetch} buscar
 * @returns {Promise<{erro: string} | {usuario: string, senha: string, comPasse: boolean}>}
 */
export async function enviarCadastro(dados, buscar = fetch) {
	let resposta;
	let json;
	try {
		resposta = await buscar(rotaDoBalcao('/cadastrar'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(dados)
		});
		json = await resposta.json();
	} catch (_e) {
		return { erro: 'Não foi possível falar com o servidor agora. Tente de novo daqui a pouco.' };
	}
	if (!resposta.ok || !json || !json.ok) {
		return { erro: (json && json.erro) || 'Não foi possível concluir o cadastro.' };
	}
	const usuario = typeof json.usuario === 'string' ? json.usuario : dados.usuario;
	if (typeof json.entrada === 'string' && armarEntrada(usuario, json.entrada)) {
		return { usuario, senha: json.entrada, comPasse: true };
	}
	return { usuario, senha: dados.senha, comPasse: false };
}

/**
 * Liga a janela que ja veio no template do login.
 *
 * @param {ShadowRoot | HTMLElement} root
 * @param {{ aoEntrar: (usuario: string, senha: string) => void }} opcoes
 * @returns {{ abrir: () => void, fechar: () => void, aberta: () => boolean, enviar: () => void, janela: HTMLElement } | null}
 */
export function montarCadastroNaEntrada(root, { aoEntrar }) {
	const modal = root.querySelector('.cad');
	if (!modal) return null;

	const janela = modal.querySelector('.cad-janela');
	const form = modal.querySelector('.cad-form');
	const recado = modal.querySelector('.cad-recado');
	const botao = modal.querySelector('.cad-enviar');
	const campo = nome => form.querySelector(`[name="${nome}"]`);
	let ocupado = false;

	// O mesmo cuidado dos campos do login: o mousedown nao pode chegar ao motor.
	for (const input of form.querySelectorAll('input')) {
		input.addEventListener('mousedown', event => event.stopImmediatePropagation());
	}

	const olho = modal.querySelector('.cad-olho');
	olho.addEventListener('click', () => {
		const senha = campo('senha');
		const revelar = senha.type === 'password';
		senha.type = revelar ? 'text' : 'password';
		olho.classList.toggle('is-revelado', revelar);
		olho.setAttribute('aria-label', revelar ? 'Ocultar senha' : 'Mostrar senha');
	});

	for (const fechador of modal.querySelectorAll('[data-fechar-cad]')) {
		fechador.addEventListener('click', event => {
			event.preventDefault();
			fechar();
		});
	}

	form.addEventListener('submit', event => {
		event.preventDefault();
		enviar();
	});

	function dizer(texto) {
		recado.textContent = texto;
		recado.hidden = !texto;
	}

	function abrir() {
		dizer('');
		modal.hidden = false;
		void modal.offsetWidth; // deixa a transicao pegar
		modal.classList.add('is-open');
		campo('nome').focus();
	}

	function fechar() {
		if (ocupado) return;
		modal.classList.remove('is-open');
		modal.hidden = true;
	}

	async function enviar() {
		if (ocupado) return;
		const dados = {
			nome: campo('nome').value.trim(),
			telefone: campo('telefone').value.trim(),
			email: campo('email').value.trim(),
			usuario: campo('usuario').value.trim(),
			senha: campo('senha').value,
			sexo: Number(form.querySelector('input[name="sexo"]:checked').value)
		};
		// INDIQUE & GANHE (D-1164): o codigo que a casca guardou do `?ref=`.
		const ref = Configs.get('codigoDeIndicacao');
		if (ref && REF_VALIDO.test(String(ref))) dados.ref = String(ref).toUpperCase();

		const problema = conferirCadastro(dados);
		if (problema) {
			dizer(problema);
			return;
		}

		dizer('');
		ocupado = true;
		botao.classList.add('is-loading');
		const resultado = await enviarCadastro(dados);
		ocupado = false;
		botao.classList.remove('is-loading');

		if ('erro' in resultado) {
			dizer(resultado.erro);
			return;
		}
		fechar();
		form.reset();
		aoEntrar(resultado.usuario, resultado.senha);
	}

	return { abrir, fechar, aberta: () => !modal.hidden, enviar, janela };
}
