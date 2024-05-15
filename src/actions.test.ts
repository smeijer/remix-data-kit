import assert from 'node:assert/strict';
import test from 'node:test';

import { createAction, createActionHandler } from './actions.js';

async function post(
	action: ReturnType<typeof createActionHandler>,
	path: string,
	formData: FormData,
): Promise<unknown> {
	const request = new Request(`https://example.com?${path}`, {
		method: 'POST',
		body: formData,
	});

	try {
		const result = await action({ request, params: {}, context: {} });
		if (!(result instanceof Response)) return result;
		return result.json();
	} catch (err) {
		if (err instanceof Response) {
			return err.json();
		}

		throw err;
	}
}

await test('calls handler for submission', async () => {
	const action = createActionHandler({
		createComment: createAction({
			name: 'create-comment',
			handler: (data) => {
				return new Response(JSON.stringify({ ok: true, data }));
			},
		}),
	});

	const formData = new FormData();
	formData.set('name', 'stephan');
	formData.set('email', 'stephan@example.com');

	const response = await post(action, '/create-comment', formData);
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
		createComment: createAction({
			name: 'create-comment',
			handler: (data) => {
				return new Response(JSON.stringify({ ok: true, data }));
			},
		}),
	});

	const formData = new FormData();
	formData.set('name', 'stephan');

	const response = await post(action, '', formData);
	assert.deepEqual(response, {
		ok: false,
		message: 'No intent specified in search params.',
	});
});

await test('returns error when no handler exists for _intent', async () => {
	const action = createActionHandler({
		createComment: createAction({
			name: 'create-comment',
			handler: (data) => {
				return new Response(JSON.stringify({ ok: true, data }));
			},
		}),
	});

	const formData = new FormData();

	const response = await post(action, '/UPDATE_COMMENT', formData);
	assert.deepEqual(response, {
		ok: false,
		message: 'No handler found for action: UPDATE_COMMENT.',
	});
});
