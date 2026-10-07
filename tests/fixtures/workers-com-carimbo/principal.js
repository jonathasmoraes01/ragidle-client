// Fixture do teste carimboDosWorkers: as DUAS formas de criar worker que o
// cliente usa (src/Core/Thread.js e src/UI/Components/Navigation/Navigation.js).
// Roda no topo: o build do vite (app) nao preserva os exports da entrada.
const modulo = new Worker(new URL('./trabalho.js', import.meta.url), { type: 'module' });
const classico = new Worker(new URL('./caminho.js', import.meta.url).href);
globalThis.__workersDaFixture = [modulo, classico];
