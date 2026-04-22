import { closeDb } from './client.js';
import { ensureDatabase } from './init.js';

await ensureDatabase();
await closeDb();
