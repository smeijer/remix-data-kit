import { json } from '@remix-run/server-runtime';
import { Static, TSchema } from '@sinclair/typebox';
import { ValueError, ValueErrorType } from '@sinclair/typebox/errors';
import { assert, AssertionError } from 'typebox-assert';

type SerializedAssertionError = {
	ok: false;
	message: string;
	errors: ValueError[];
};

export function assertType<T extends TSchema>(schema: T, value: unknown, message?: string): asserts value is Static<T> {
	try {
		assert(schema, value, message);
	} catch (e) {
		if (e instanceof AssertionError) {
			throw json<SerializedAssertionError>({ ok: false, message: e.message, errors: e.errors }, { status: 422 });
		}

		throw e;
	}
}

const knownErrorValues = new Set<number>(
	Object.values(ValueErrorType).flatMap((x) => (typeof x === 'number' ? [x] : [])),
);

function isValueError(value: unknown): value is ValueError {
	if (value == null || typeof value !== 'object') return false;
	if (!('type' in value) || typeof value.type !== 'number' || !knownErrorValues.has(value.type)) return false;
	if (!Object.values(ValueErrorType).includes(value.type)) return false;
	if (!('message' in value) || typeof value.message !== 'string') return false;
	if (!('path' in value) || typeof value.path !== 'string') return false;
	// don't check value, type is `unknown` so can be undefined, and thereby omitted in responses
	// if (!('value' in value)) return false;
	if (!('schema' in value) || typeof value.schema !== 'object') return false;
	return true;
}

/**
 * Check if provided `value` is a valid AssertionError. This util is to be used in
 * components to see if a fetcher caught an AssertionError, thrown by the action
 * @param value
 */
export function isAssertionError(value: unknown): value is SerializedAssertionError {
	if (value == null || typeof value !== 'object') return false;
	if (!('ok' in value) || value.ok !== false) return false;
	if (!('message' in value) || typeof value.message !== 'string') return false;
	if (!('errors' in value) || !Array.isArray(value.errors)) return false;
	if (!value.errors.every((x) => isValueError(x))) return false;
	return true;
}
