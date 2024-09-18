import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import { generate } from './internal/generate.js';

void yargs(hideBin(process.argv))
	.command<{ pattern: string; outdir: string; dryRun?: boolean; format?: string; cwd?: string }>(
		'generate-types',
		'generate typebox types from json schemas',
		(y) => {
			y.example('$0', `generate-types -p '**/schemas/*.json' -o './types'`)
				.example('$0', `generate-types -p '**/schemas/*.json' -o './types' -f "$1-$2"`)
				.example('$0', `generate-types -p '**/schemas/*.json' -o './types' --cwd '../../'`)
				.option('pattern', {
					alias: 'p',
					type: 'string',
					description: 'glob to locate json schema files',
					requiresArg: true,
				})
				.option('outdir', {
					alias: 'o',
					type: 'string',
					description: 'directory to write generated files to',
					requiresArg: true,
				})
				.option('format', {
					alias: 'f',
					type: 'string',
					description: `format to generate file names, based on globstar matches.\nex: '$1 $2 $-1'`,
					requiresArg: true,
				})
				.option('cwd', {
					type: 'string',
					description: `provide a working directory`,
					requiresArg: true,
				})
				.option('dry-run', {
					type: 'boolean',
					description: `only check if generated files need updating, don't actually update them`,
					requiresArg: false,
				})
				.demandOption('pattern')
				.demandOption('outdir');
		},
		async (argv) => {
			const success = await generate({
				pattern: argv.pattern,
				outdir: argv.outdir,
				format: argv.format,
				cwd: argv.cwd || process.cwd(),
				dryRun: argv.dryRun,
			});

			process.exit(success ? 0 : 1);
		},
	)
	.demandCommand()
	.parse();
