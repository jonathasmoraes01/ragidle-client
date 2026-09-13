import { describe, expect, it } from 'vitest';

import { canalDaRespostaDeComando } from '../../src/UI/Components/ChatBox/respostaDeComando.js';

// Os canais e o so-leitura, como o ChatBox os declara.
const CANAIS = ['global', 'guilda', 'party', 'trade', 'farm', 'logs'];
const SEM_DIGITACAO = ['trade'];

describe('a resposta do comando vai para a aba de quem digitou (D-1364)', () => {
	it('digitado no Global, a resposta aparece no Global', () => {
		expect(canalDaRespostaDeComando('global', CANAIS, SEM_DIGITACAO)).toBe('global');
	});

	it('digitado na Party ou na Guilda, a resposta fica ali', () => {
		expect(canalDaRespostaDeComando('party', CANAIS, SEM_DIGITACAO)).toBe('party');
		expect(canalDaRespostaDeComando('guilda', CANAIS, SEM_DIGITACAO)).toBe('guilda');
	});

	it('CONTROLE: sem comando digitado nesta sessao, o Logs de sempre', () => {
		expect(canalDaRespostaDeComando(null, CANAIS, SEM_DIGITACAO)).toBe('logs');
	});

	it('uma aba que nao aceita digitacao nao recebe resposta — o Logs', () => {
		expect(canalDaRespostaDeComando('trade', CANAIS, SEM_DIGITACAO)).toBe('logs');
	});

	it('um canal que nao existe cai no Logs, e nao numa aba inventada', () => {
		expect(canalDaRespostaDeComando('sussurro', CANAIS, SEM_DIGITACAO)).toBe('logs');
	});
});
