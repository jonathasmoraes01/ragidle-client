import { WebSocketServer } from 'ws';
import net from 'net';

// Parse command line arguments
const args = {};
for (let i = 2; i < process.argv.length; i++) {
	const arg = process.argv[i];
	if (arg.startsWith('-')) {
		const key = arg.replace(/^-+/, '');
		const val = process.argv[i + 1];
		if (val && !val.startsWith('-')) {
			args[key] = val;
			i++;
		} else {
			args[key] = true;
		}
	}
}

const port = parseInt(args.p || args.port || process.env.PORT || '5999', 10);
/*
 * A PONTE ESCUTA SO EM LOOPBACK (08/09/2026) — medido em producao.
 *
 * Ate hoje ela subia sem `host`, e o padrao do `ws` e escutar em TODAS as
 * interfaces. Conferido na VPS com `ss -ltnp`: `*:5999`, enquanto as seis
 * portas do jogo apareciam certinhas em `127.0.0.1`. Quem impedia o mundo de
 * alcancar a ponte era so o firewall da maquina (`ufw`, `deny incoming`) —
 * **uma protecao que mora fora deste repositorio e some numa recriacao de VPS
 * sem nada avisar**.
 *
 * Fechar em loopback e seguro porque quem fala com ela e o `cloudflared`, na
 * MESMA maquina: o `/etc/cloudflared/config.yml` de producao aponta os tres
 * hostnames para `http://127.0.0.1:5999`, `:8000` e `:8889`. O tunel e conexao
 * de SAIDA — nao existe ninguem legitimo chegando por outra interface.
 *
 * `WSPROXY_HOST` continua permitindo abrir, para quem precisar servir a ponte
 * na rede local (um celular de verdade apontando para o PC de desenvolvimento,
 * por exemplo). O PADRAO e que mudou: era aberto, agora e fechado.
 */
const host = process.env.WSPROXY_HOST ?? '127.0.0.1';
const redirectStr = args.r || args.redirect || '';
/*
 * `Object.create(null)`, E NAO `{}` (08/09/2026) — REPRODUZIDO, nao suposto.
 *
 * Este mapa e consultado com uma chave que vem CRUA da URL do WebSocket
 * (`redirects[target]`, no handler de conexao). Com um objeto comum, chave
 * nenhuma esta vazia: `redirects['constructor']` desce pela cadeia de
 * prototipo e devolve a funcao `Object` — que e truthy. O codigo entao faz
 * `target = redirects[target]` e, na linha seguinte, `target.split(':')`.
 * Funcao nao tem `.split`.
 *
 * O `TypeError` acontece DENTRO de um listener de evento, e listener de evento
 * nao tem quem o contenha: **o processo da ponte morre**. Como toda pessoa que
 * joga entra por aqui, todo mundo cai junto — e nada religa a ponte.
 *
 * Medido em 08/09/2026, na configuracao de producao (`WSPROXY_ALVOS` definida,
 * sem `-r`): um WebSocket para `/constructor` derruba a ponte com codigo 1,
 * enquanto o controle (um destino legitimo) a mantem viva. Vale igual para
 * `__proto__`, `toString`, `valueOf` e qualquer nome de `Object.prototype`.
 *
 * Um objeto sem prototipo nao tem chave herdada nenhuma: `redirects[qualquer]`
 * so e truthy se alguem o TIVER posto ali, que e o que a linha sempre quis
 * dizer. As outras duas camadas (o try/catch do handler e o gancho de ultimo
 * caso, mais abaixo) existem porque uma linha nao pode ser a unica defesa de
 * um processo do qual todo mundo depende.
 */
const redirects = Object.create(null);

if (redirectStr) {
	redirectStr.split(',').forEach(pair => {
		const [src, dest] = pair.split('=');
		if (src && dest) {
			redirects[src.trim()] = dest.trim();
		}
	});
}

/*
 * A LISTA DE DESTINOS PERMITIDOS (D-540).
 *
 * Esta ponte conecta a QUALQUER `host:porta` que o cliente pedir na URL do
 * WebSocket — o que é conveniente numa máquina de desenvolvimento e é um
 * PROXY TCP ABERTO no instante em que ela fica exposta na internet: qualquer
 * pessoa com a URL poderia alcançar serviços da rede onde ela roda.
 *
 * Como a v0 pública põe esta ponte atrás de um túnel, a lista deixou de ser
 * opcional. O padrão são as três portas do próprio jogo em `127.0.0.1`;
 * `WSPROXY_ALVOS` (separados por vírgula) substitui a lista quando for
 * preciso outra coisa, e `WSPROXY_ABERTO=1` volta ao comportamento antigo —
 * com aviso alto, porque quem liga isso precisa saber o que está ligando.
 */
const ALVOS_PADRAO = ['127.0.0.1:6900', '127.0.0.1:6121', '127.0.0.1:5121'];
const aberto = process.env.WSPROXY_ABERTO === '1';
const alvosPermitidos = new Set(
	(process.env.WSPROXY_ALVOS ?? ALVOS_PADRAO.join(',')).split(',').map(t => t.trim()).filter(Boolean)
);

if (host !== '127.0.0.1' && host !== 'localhost') {
	// Quem abre precisa VER que abriu. A linha e o unico aviso que existe entre
	// "so o tunel alcanca" e "a internet alcanca, se o firewall deixar".
	console.log(`[wsProxy] ATENCAO: escutando em ${host} — fora de loopback. Confira o firewall.`);
}
if (aberto) {
	console.log('[wsProxy] ATENCAO: WSPROXY_ABERTO=1 — a ponte aceita QUALQUER destino.');
	console.log('[wsProxy] Nao exponha esta ponte na internet assim.');
} else {
	console.log('[wsProxy] destinos permitidos:', [...alvosPermitidos].join(', '));
}
if (Object.keys(redirects).length > 0) {
	console.log('[wsProxy] Configured redirects:', redirects);
}

/**
 * O TETO DE FRAME (27/08/2026, auditoria).
 *
 * O padrao do `ws` e **100 MiB por mensagem**, e esta ponte fica atras de um
 * tunel publico. Um cliente pode abrir a conexao e mandar um unico frame de
 * 100 MiB, que o processo monta INTEIRO em memoria antes de o `on('message')`
 * sequer rodar — nada aqui teria como recusar depois.
 *
 * O maior pacote do protocolo do RO nao chega perto disso: os variaveis
 * declaram o comprimento em 2 bytes, entao o teto natural e 64 KiB. 256 KiB
 * deixa folga de 4x para qualquer coisa que o cliente mande em rajada, e ainda
 * assim e 400x menor que o padrao.
 */
const TETO_DE_FRAME = 256 * 1024;


const wss = new WebSocketServer({ port, host, maxPayload: TETO_DE_FRAME });

/*
 * "Listening on" SO QUANDO ESCUTA (10/09/2026).
 *
 * A linha era impressa no topo do arquivo, antes ate de o servidor ser
 * criado — e o `listen` e assincrono. Quem esperava por ela (o
 * `tests/wsproxy-nao-morre.test.js`) conectava numa porta que as vezes ainda
 * nao escutava: medido, uma em tres conexoes feitas no instante da linha deu
 * `ECONNREFUSED`, e o teste reprovou tres vezes seguidas com a ponte perfeita.
 * Em producao a mentira era a mesma com outra cara: porta ocupada imprimia
 * "Listening on" e morria logo em seguida.
 */
wss.on('listening', () => {
	console.log(`[wsProxy] Listening on ${host}:${port}`);
});

/*
 * O HANDLER INTEIRO NUMA GUARDA (08/09/2026).
 *
 * Uma excecao dentro de um listener de evento nao tem quem a contenha: ela
 * sobe como excecao nao tratada e MATA O PROCESSO. Numa ponte pela qual todo
 * jogador passa, isso quer dizer que qualquer defeito no tratamento de UMA
 * conexao derruba TODAS — e foi exatamente esse o caminho do `/constructor`.
 *
 * A guarda inverte o custo: o pedido esquisito perde a conexao dele, e nao o
 * jogo inteiro. E o mesmo idioma do `try/catch` por handler que o servidor de
 * jogo ja usa (`servidor/transporte.ts`, ~395).
 */
wss.on('connection', (ws, req) => {
	try {
		aceitarConexao(ws, req);
	} catch (erro) {
		console.error(`[wsProxy] conexao recusada por excecao (${req && req.url}): ${erro && erro.message}`);
		try {
			ws.close();
		} catch {
			/* fechar ja fechado nao e problema de ninguem */
		}
	}
});

function aceitarConexao(ws, req) {
	const from = req.socket.remoteAddress;
	let target = req.url.slice(1); // Remove leading slash

	// Apply redirects
	if (redirects[target]) {
		console.log(`[wsProxy] Redirecting ${target} -> ${redirects[target]}`);
		target = redirects[target];
	}

	console.log(`[wsProxy] Connection request from ${from} to ${target}`);

	const parts = target.split(':');
	if (parts.length !== 2) {
		console.log(`[wsProxy] Invalid target format: ${target}`);
		ws.close();
		return;
	}

	const [host, portStr] = parts;
	const targetPort = parseInt(portStr, 10);

	// A tranca de D-540: destino fora da lista é recusado ANTES de qualquer
	// socket ser aberto. O log diz o que foi pedido — quem administra precisa
	// ver a tentativa; quem tentou não recebe nada além do fechamento.
	if (!aberto && !alvosPermitidos.has(`${host}:${targetPort}`)) {
		console.log(`[wsProxy] RECUSADO destino fora da lista: ${host}:${targetPort} (de ${from})`);
		ws.close();
		return;
	}

	const tcp = net.connect(targetPort, host, () => {
		console.log(`[wsProxy] Connected to target ${host}:${targetPort}`);
	});

	tcp.setNoDelay(true);

	/*
	 * BACKPRESSURE NAS DUAS DIRECOES (27/08/2026, auditoria).
	 *
	 * Os dois repasses eram `write`/`send` incondicionais. Cada lado tem um
	 * jeito de encher:
	 *
	 * - **servidor -> cliente**: um cliente entra no mapa pelo tunel e para de
	 *   ler o proprio socket (aba minimizada com rede ruim, ou de proposito). O
	 *   servidor continua empurrando posicao e entidades a cada tique, e
	 *   `ws.send` enfileira em `bufferedAmount` — memoria do processo da ponte,
	 *   sem teto.
	 * - **cliente -> servidor**: `tcp.write` devolve `false` quando o buffer do
	 *   socket encheu, e ninguem olhava.
	 *
	 * O idioma do Node para isso e `pause()`/`resume()`: parar de LER a origem
	 * enquanto o destino nao vaza. Assim a pressao volta para quem a criou, em
	 * vez de virar memoria aqui.
	 */
	ws.on('message', message => {
		if (!tcp.writable) return;
		// `write` devolve false quando o buffer encheu: para de ler o WS ate o
		// socket TCP drenar.
		if (!tcp.write(message)) {
			ws.pause();
			tcp.once('drain', () => ws.resume());
		}
	});

	tcp.on('data', data => {
		if (ws.readyState !== ws.OPEN) return;
		ws.send(data);
		/*
		 * `ws.send` nao tem valor de retorno util; o sinal e `bufferedAmount`.
		 * Passou do teto, para de ler o TCP e so volta quando drenar — o
		 * `setTimeout` e a unica forma, porque o `ws` nao emite evento de
		 * drenagem por conexao.
		 */
		if (ws.bufferedAmount > TETO_DE_FRAME) {
			tcp.pause();
			const esperarDrenar = () => {
				if (ws.readyState !== ws.OPEN) return; // caiu: nao ha o que retomar
				if (ws.bufferedAmount > TETO_DE_FRAME) setTimeout(esperarDrenar, 50);
				else tcp.resume();
			};
			setTimeout(esperarDrenar, 50);
		}
	});

	const cleanup = () => {
		tcp.end();
		ws.close();
		console.log(`[wsProxy] Connection closed for ${target}`);
	};

	ws.on('close', cleanup);
	ws.on('error', cleanup);
	tcp.on('close', cleanup);
	tcp.on('error', err => {
		console.error(`[wsProxy] TCP Error for ${target}:`, err.message);
		cleanup();
	});
}

/*
 * O GANCHO DE ULTIMO CASO (08/09/2026) — o mesmo que o servidor de jogo ganhou
 * em D-1191, e pela mesma razao.
 *
 * A ponte e um ponto unico de falha: ela nao guarda estado, mas TODO mundo
 * passa por ela, e quando ela morre ninguem consegue nem entrar. Ficar de pe
 * com um erro registrado e sempre melhor do que sair calada — e sair calada e
 * literalmente o que acontecia, porque o supervisor de producao nao vigiava a
 * saida desta peca.
 */
process.on('uncaughtException', (erro) => {
	console.error(`[wsProxy] QUEDA EVITADA (uncaughtException): ${erro && erro.message}`);
	console.error(erro && erro.stack ? erro.stack : '(sem pilha)');
});
process.on('unhandledRejection', (erro) => {
	console.error(`[wsProxy] QUEDA EVITADA (unhandledRejection): ${erro && erro.message ? erro.message : String(erro)}`);
});
