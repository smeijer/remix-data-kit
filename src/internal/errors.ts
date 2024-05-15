import { ValueError } from '@sinclair/typebox/errors';

export class BodyParserError extends Error {
	errors: Partial<ValueError>[];
	constructor(message: string, errors: Partial<ValueError>[]) {
		super(message);
		this.errors = errors;
	}
}
