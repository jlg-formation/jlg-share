import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';
import { createApp } from '../src/server/app';
const directory=mkdtempSync(join(tmpdir(),'jlg-e2e-'));
const store=new Store(directory);
const app=createApp(store,{origin:'http://127.0.0.1:4173',passwordHash:await Bun.password.hash('e2e-only-password'),secure:false});
const server=Bun.serve({port:4173,hostname:'127.0.0.1',fetch:app.fetch,websocket:app.websocket,maxRequestBodySize:50_100_000});
function stop(){app.close();server.stop(true);store.db.close();rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
