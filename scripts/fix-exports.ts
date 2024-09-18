import { fileURLToPath } from 'node:url';

import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

for (const file of Object.keys(pkgJson.exports)) {
	if (!file.endsWith('.test')) continue;
	delete pkgJson.exports[file];
}

fs.writeFileSync(path.join(__dirname, '..', 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');
