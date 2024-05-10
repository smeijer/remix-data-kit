export async function unwrapPromise<T>(maybePromise: Promise<T>): Promise<[T, null] | [null, Error]> {
	try {
		return [await maybePromise, null];
	} catch (error) {
		return wrapError(error);
	}
}

function wrapError(error: unknown): [null, Error] {
	if (error instanceof Error) {
		return [null, error];
	}

	if (typeof error === 'string') {
		return [null, new Error(error)];
	}

	return [null, new PromiseError(error)];
}

export class PromiseError extends Error {
	constructor(public error: unknown) {
		super('Promise rejected with non-standard Error.');
	}
}
