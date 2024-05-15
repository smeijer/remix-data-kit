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
};
