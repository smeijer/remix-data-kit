/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const arg = process.argv.slice(2);
const [releaseType] = arg;

if (!releaseType || !['major', 'minor', 'patch'].includes(releaseType)) {
	console.error(`please specify major | minor | patch`);
	process.exit(0);
}

execSync(`npm version ${releaseType}`, { stdio: 'inherit' });
execSync(`npm run build`, { stdio: 'inherit' });
execSync(`npm publish`, { stdio: 'inherit' });
execSync(`git add package.json package-lock.json`);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

execSync(`git commit -m 'chore: bump version to ${pkgJson.version}`);
