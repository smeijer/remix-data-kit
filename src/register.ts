import { unwrapPromise } from './unwrap.js';

function unwrap<T>(this: Promise<T>) {
	return unwrapPromise<T>(this);
}

void Object.defineProperty(Promise.prototype, 'unwrap', {
	enumerable: false,
	value: unwrap,
});

declare global {
	interface Promise<T> {
		unwrap(): Promise<[T, null] | [null, Error]>;
	}
}
