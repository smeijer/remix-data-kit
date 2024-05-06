import assert from 'node:assert/strict';
import test from 'node:test';

import { Type } from '@sinclair/typebox';

import { assertType } from './index.js';

const User = Type.Object(
	{
		name: Type.String(),
		email: Type.String(),
	},
	{
		$id: 'User',
	},
);

await test('throws Response when does not pass validation', async () => {
	let thrown: unknown;

	assert.throws(
		() => assertType(User, { name: 'stephan' }),
		(t) => {
			// can't await t.json() here, so we bring it up
			thrown = t;
			return true;
		},
	);

	assert(thrown instanceof Response);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const json = await thrown.json();
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	delete json['errors'];
	assert.deepEqual(json, { ok: false, message: 'Invalid data provided for type: User' });
});

await test('throws no error when all props are valid', () => {
	assert.doesNotThrow(() => assertType(User, { name: 'stephan', email: 'stephan@example.com' }));
});

await test('narrows the type', () => {
	const data = { name: 'stephan', email: 'stephan@example.com' } as unknown;
	assertType(User, data);
	// TS would throw here if `data` wasn't narrowed to User
	assert.strictEqual(data.name, 'stephan');
	assert.strictEqual(data.email, 'stephan@example.com');
});
