import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
const dataDir = join(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

console.log('Running database migrations...');
initializeDatabase();
console.log('Migrations complete!');
