module.exports = {
	extends: ['@smeijer/eslint-config'],
	plugins: ['eslint-plugin-best-practices'],
	rules: {
		'best-practices/explicit-internal-boundaries': ['error'],
		'@typescript-eslint/no-misused-promises': [
			'error',
			{
				checksVoidReturn: false,
			},
		],
	},
	overrides: [
		{
			files: ['./scripts/**/*.ts'],
			parserOptions: {
				tsconfigRootDir: __dirname,
				project: ['./tsconfig.eslint.json'],
			},
		},
	],
};
