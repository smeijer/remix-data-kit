import assert from 'node:assert/strict';
import test from 'node:test';

import { createActionHandler } from './actions.js';

async function post(action: ReturnType<typeof createActionHandler>, formData: FormData): Promise<unknown> {
	const url = new URL('https://example.com');
	const request = new Request(url, {
		method: 'POST',
		body: formData,
	});

	return action({ request, params: {}, context: {} })
		.then((x) => x.json())
		.catch((err) => {
			if (err instanceof Response) {
				return err.json();
			}

			throw err;
		});
}

await test('calls handler for submission', async () => {
	const action = createActionHandler({
		CREATE_COMMENT: ({ payload }) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			return new Response(JSON.stringify({ ok: true, data: payload }));
		},
	});

	const formData = new FormData();
	formData.set('_intent', 'CREATE_COMMENT');
	formData.set('name', 'stephan');
	formData.set('email', 'stephan@example.com');

	const response = await post(action, formData);
	assert.deepEqual(response, {
		ok: true,
		data: {
			name: 'stephan',
			email: 'stephan@example.com',
		},
	});
});

await test('returns error when _intent is missing', async () => {
	const action = createActionHandler({
		CREATE_COMMENT: ({ payload }) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			return new Response(JSON.stringify({ ok: true, data: payload }));
		},
	});

	const formData = new FormData();
	formData.set('name', 'stephan');

	const response = await post(action, formData);
	assert.deepEqual(response, {
		ok: false,
		message: 'No intent specified in form data',
	});
});

await test('returns error when no handler exists for _intent', async () => {
	const action = createActionHandler({
		CREATE_COMMENT: (data) => {
			return new Response(JSON.stringify({ ok: true, data }));
		},
	});

	const formData = new FormData();
	formData.set('_intent', 'UPDATE_COMMENT');

	const response = await post(action, formData);
	assert.deepEqual(response, {
		ok: false,
		message: 'No handler found for action: UPDATE_COMMENT',
	});
});
