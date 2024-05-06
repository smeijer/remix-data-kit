import { json } from '@remix-run/server-runtime';
import { Static, TSchema } from '@sinclair/typebox';
import { assert, AssertionError } from 'typebox-assert';

export function assertType<T extends TSchema>(schema: T, value: unknown, message?: string): asserts value is Static<T> {
	try {
		assert(schema, value, message);
	} catch (e) {
		if (e instanceof AssertionError) {
			throw json({ ok: false, message: e.message, errors: e.errors });
		}

		throw e;
	}
}
