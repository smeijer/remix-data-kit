import * as fs from 'fs/promises';
import * as path from 'path';
import { build } from 'unbuild';

const copy = (file: string) => fs.copyFile(`./${file}`, `./dist/${file}`);

function removeRedundantFields(obj: Record<string, unknown>) {
	for (const key of ['scripts', 'simple-git-hooks', 'devDependencies', 'files']) {
		delete obj[key];
	}

	return obj;
}

function replaceDistPaths(obj: Record<string, unknown>) {
	for (const key of ['main', 'module', 'types', 'bin', 'exports']) {
		obj[key] = traverseAndReplace(obj[key], './dist/', './');
	}

	return obj;
}

const traverseAndReplace = (obj: unknown, searchValue: string, replaceValue: string) => {
	if (!obj) return obj;
	if (typeof obj === 'string') return obj.replace(searchValue, replaceValue);
	if (typeof obj !== 'object' || Array.isArray(obj)) return obj;

	for (const [k, v] of Object.entries(obj)) {
		(obj as Record<string, unknown>)[k] = traverseAndReplace(v, searchValue, replaceValue);
	}

	return obj;
};

await build(process.cwd(), false);
await copy('package.json');
await copy('readme.md');
await copy('license');

let pkgJson = JSON.parse(await fs.readFile('./dist/package.json', 'utf-8')) as Record<string, unknown>;
pkgJson = removeRedundantFields(pkgJson);
pkgJson = replaceDistPaths(pkgJson);
await fs.writeFile('./dist/package.json', JSON.stringify(pkgJson, null, 2), 'utf-8');

if ('bin' in pkgJson && typeof pkgJson['bin'] === 'string') {
	const binName = path.basename(pkgJson['bin'], path.extname(pkgJson['bin']));
	for (const dts of ['.d.ts', '.d.cts', '.d.mts']) {
		await fs.unlink(path.join('./dist', binName + dts)).catch(() => void 0);
	}
}
