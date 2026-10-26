#!/usr/bin/env node
// Sets a new admin code: writes its salted PBKDF2 hash into game/src/core/admin.ts. The code itself is never stored.
// usage: node tools/admin_code.mjs "<new secret code>"
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const code = process.argv[2];
if (!code || code.length < 10) { console.error('Give a code of at least 10 characters.'); process.exit(1); }
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../game/src/core/admin.ts');
const salt = `mm-admin-v1:${crypto.randomBytes(8).toString('hex')}`;
const hash = crypto.pbkdf2Sync(code, salt, 100000, 32, 'sha256').toString('hex');
let src = fs.readFileSync(file, 'utf8');
src = src.replace(/const SALT = '[^']*';/, `const SALT = '${salt}';`).replace(/const ADMIN_HASH = '[^']*';/, `const ADMIN_HASH = '${hash}';`);
fs.writeFileSync(file, src);
console.log('Admin code updated. Rebuild and redeploy for it to take effect.');
