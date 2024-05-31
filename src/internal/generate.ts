/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,no-console */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import * as TypeBox from '@sinclair/typebox';
import * as Value from '@sinclair/typebox/value';
import { glob } from 'glob';
import { Listr } from 'listr2';
import colors from 'picocolors';
import { schema2typebox } from 'schema2typebox';
import vm from 'vm';

TypeBox.TypeRegistry.Set(
	'ExtendedOneOf',
	(schema: { oneOf: Array<TypeBox.TSchema> }, value) =>
		1 === schema.oneOf.reduce((acc: number, schema: TypeBox.TSchema) => acc + (Value.Check(schema, value) ? 1 : 0), 0),
);

const OneOf = <T extends TypeBox.TSchema[]>(oneOf: [...T], options: TypeBox.SchemaOptions = {}) =>
	TypeBox.Type.Unsafe<TypeBox.Static<TypeBox.TUnion<T>>>({
		...options,
		[TypeBox.Kind]: 'ExtendedOneOf',
		oneOf,
	});

const sandbox = {
	...TypeBox,
	...Value,
	OneOf,
	result: null,
};

vm.createContext(sandbox);

function cleanImports(content: string) {
	const lines = content.split('\n');

	for (let idx = lines.length; idx >= 0; idx--) {
		const line = lines[idx] || '';

		if (!line.startsWith('import')) {
			continue;
		}

		const importSegments = line.split(/[{,}]/).map((x) => x.trim());
		const usedImports: string[] = [];

		for (const segment of importSegments.slice(1, -1)) {
			if (
				!lines.some(
					(x) =>
						x.includes(`${segment}.`) ||
						x.includes(`${segment}<`) ||
						x.includes(`<${segment}>`) ||
						x.includes(`: ${segment}`),
				)
			) {
				continue;
			}

			usedImports.push(segment);
		}

		if (!usedImports.length) {
			lines.splice(idx, 1);
			continue;
		}

		lines[idx] = `${importSegments.at(0)} { ${usedImports.join(', ')} } ${importSegments.at(-1)}`;
	}

	return lines.join('\n');
}

const typeRegex = /export type (.*?) =/i;
const schemaRegex = /export const (.*?) =/i;

async function convert(input: string, output: string, type?: string) {
	const file = readFileSync(input, 'utf-8');
	const json: any = JSON.parse(file);

	type = json.title ? pascalCase(String(json.title)) : type;
	json.title = type;

	if (!json.title) {
		throw new Error(`unable to determine type name, schema does not contain a title, nor was a type provided.`);
	}

	const jsonSchema = JSON.stringify(json, null, 2);
	let result = await schema2typebox({ input: jsonSchema });

	result = result.slice(result.indexOf('*/') + 2).trim();
	result =
		`/**\n * THIS CODE IS GENERATED USING REMIX-DATA-KIT\n * DO NOT EDIT MANUALLY\n */\n` +
		`import { Schema } from '@cfworker/json-schema';\n` +
		result;

	result = result.replace(typeRegex, 'export type $1Type =');
	result = result.replace(/Static<\s*typeof (.*?)\s*>/, 'Static<typeof $1Schema>');
	result = result.replace(schemaRegex, '\nexport const $1Schema =');
	result += `\n\nexport const ${type}JSONSchema = Type.Strict(${type}Schema);`;
	result += '\n';

	result = cleanImports(result);

	mkdirSync(path.dirname(output), { recursive: true });
	writeFileSync(output, result);
}

type GenerateOptions = {
	pattern: string;
	outdir: string;
	format?: string;
	cwd?: string;
};
export async function generate({ pattern, outdir, format, cwd }: GenerateOptions) {
	cwd = cwd ? path.resolve(cwd) : process.cwd();
	const files = extractParts(pattern, await glob(pattern, { nocase: true, cwd, absolute: true })).map((x) => {
		const output = kebabcase(format ? formatString(x.matches, format) : x.matches.join('-'));
		const type = output ? pascalCase(output) : undefined;
		return {
			input: x.file,
			output: path.join(outdir, output) + '.ts',
			type,
		};
	});

	if (!files.length) {
		console.log(`no files found matching pattern ${pattern}`);
		return;
	}

	const basePath = getBasePath(files.map((x) => x.input));

	const tasks = new Listr(
		files.map((file) => ({
			title: `generate: ${file.output} ${colors.dim(`(input: ${file.input.replace(basePath, '')})`)}`,
			task: async () => convert(file.input, file.output, file.type),
		})),
	);

	try {
		await tasks.run();
	} catch (e) {
		console.error(e);
	}
}

function getBasePath(files: string[]) {
	if (files.length === 0) return '';

	const sortedArr = files.concat().sort();

	const first = sortedArr[0]!;
	const last = sortedArr[sortedArr.length - 1]!;
	let i = 0;

	while (i < first.length && first[i] === last[i]) {
		i++;
	}

	return first.substring(0, i);
}

const httpMethods = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE']);

function pascalCase(str: string): string {
	return str
		.trim()
		.replace(/([a-z])([A-Z])/g, '$1 $2') // Ensure there is a space before each capital in camelCase
		.replace(/\W/g, ' ') // Replace all non-alphanumeric characters with space
		.replace(/\s+/g, ' ') // Replace multiple spaces with a single space
		.split(' ') // Split the string into words by spaces
		.map((word) =>
			httpMethods.has(word.toUpperCase())
				? word.toUpperCase()
				: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join('');
}

function kebabcase(str: string) {
	return str
		.trim()
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/\W/g, (m) => (/[À-ž]/.test(m) ? m : '-'))
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-')
		.toLowerCase();
}

/**
 * Extracts parts from paths that match a given glob pattern.
 * @param pattern - The glob pattern to match files.
 * @param files - The files array to run the pattern on.
 * @returns Array of file names with extracted matches.
 */
function extractParts(pattern: string, files: string[]): Array<{ file: string; matches: string[] }> {
	const regex = new RegExp(pattern.replace(/(\*\*)|(\*)/g, (match) => (match === '**' ? '(.*?)' : '([^/]+)')));

	return files.map((file) => {
		const matches = file.match(regex);
		return { file, matches: (matches?.slice(1) || []).flatMap((x) => x.split('/')) };
	});
}

/**
 * Formats a string based on an array of matches using placeholders like $1, $2, $-1, etc.
 * @param {string[]} matches - The array of strings to use for replacements.
 * @param {string} format - The format string with placeholders.
 * @returns {string} - The formatted string with replacements applied.
 */
function formatString(matches: string[], format: string): string {
	const seenIndices = new Set(); // Track seen indices to avoid duplication

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore - ts is wrong, (match, number) is a valid overload
	const formatted = format.replace(/\$(\d+|-\d+)/g, (match, number) => {
		const index = parseInt(String(number), 10);
		const actualIndex = index > 0 ? index - 1 : matches.length + index;

		if (actualIndex >= 0 && actualIndex < matches.length && !seenIndices.has(actualIndex)) {
			seenIndices.add(actualIndex); // Mark this index as seen
			return matches[actualIndex];
		}

		return '';
	});

	return formatted.replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
}
