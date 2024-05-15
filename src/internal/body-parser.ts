/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-argument */
// based on https://github.com/smeijer/next-runtime/blob/60c4fcd11e5430323fbb2f5ab0d75ccf96f979f5/src/runtime/body-parser.ts

import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

import { ValueError } from '@sinclair/typebox/errors';
import Accept from 'attr-accept';
import Busboy, { FieldInfo } from 'busboy';
import bytes from 'bytes';
import { setField } from 'form-data-kit';
import fs from 'fs';
import path from 'path';
import Picoid from 'picoid';

import { isAssertionError } from '../assert.js';
import { ensureArray, oneOf } from './arrays.js';
import { BodyParserError } from './errors.js';

const picoid = Picoid.default;
const accept = Accept.default;

type ContentType = 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data';

export type FileInfo = {
	name: string;
	size: number;
	type: string;
	path?: string;
} & Record<string, unknown>;

export type BodyParserOptions = {
	limits?: {
		/**
		 * The maximum number of files a user can upload. Note that empty file
		 * fields, still count against the file count limit.
		 */
		fileCount?: number;

		/**
		 * The maximum size per file in bytes.
		 */
		fileSize?: number | string;

		/**
		 * The maximum size of text fields.
		 */
		fieldSize?: number | string;

		/**
		 * The maximum size of json payloads.
		 */
		jsonSize?: number | string;

		/**
		 * A valid HTML accept string to restrict mime-types.
		 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept
		 */
		mimeType?: string | string[];
	};

	/**
	 * The directory where files should be stored
	 */
	uploadDir?: string;

	/**
	 * Handle the file streams, and pipe them to S3, file system, or whatever.
	 * When using this, files will no longer be written to the file system.
	 */
	onFile?: (params: { field: string; file: ReadableStream; info: FileInfo }) => Promise<void> | void;
};

const ACCEPT: ContentType[] = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'];

export async function bodyparser(req: Request, options?: BodyParserOptions): Promise<Record<string, unknown> | null> {
	const limits = options?.limits || {};
	const errors: Partial<ValueError>[] = [];

	// convert string based sizes to numbers
	const maxFileCount = limits.fileCount ?? undefined;
	const maxFileSize: number | undefined = bytes.parse(limits.fileSize || '') ?? undefined;
	const maxFieldSize: number | undefined = bytes.parse(limits.fieldSize || '') ?? undefined;
	const maxJsonSize: number | undefined = bytes.parse(limits.jsonSize || '') ?? undefined;

	const contentType = req.headers.get('content-type');

	if (!contentType || !req.body) return null;
	if (!ACCEPT.some((type) => contentType.startsWith(type))) {
		return null;
	}

	// application/json is handled by bodyParser, as busboy doesn't support it
	if (contentType.startsWith('application/json')) {
		let lastKey: string;

		const reviver = (maxSize: number) => (key: string, value: unknown) => {
			if (typeof value === 'string' && value.length > maxSize) {
				const field = /[0-9]+/.test(key) ? `${lastKey}.${key}` : key;
				errors.push({
					path: `/${field}`,
					message: `field '${field}' exceeds ${bytes(maxSize)}`,
				});
			}

			lastKey = /[0-9]+/.test(key) ? lastKey : key;
			return value;
		};

		return new Promise(async (resolve, reject) => {
			const body = req.clone();
			const text = await body.text();

			if (maxJsonSize && text.length > maxJsonSize) {
				errors.push({
					path: '/',
					message: `json object exceeds ${bytes(maxJsonSize || 0)}`,
				});

				return reject(new BodyParserError('could not accept form data', errors));
			}

			const json = JSON.parse(text, maxFieldSize ? reviver(maxFieldSize) : undefined);

			if (errors.length) {
				return reject(new BodyParserError('could not accept form data', errors));
			}

			// TODO; this is still text?Also, support json5
			resolve(json);
		});
	}

	// busboy handles application/x-www-form-urlencoded and multipart/form-data,
	return new Promise((resolve, reject) => {
		const busboy = Busboy({
			headers: Object.fromEntries(req.headers),
			limits: {
				files: maxFileCount,
				fileSize: maxFileSize,
				fieldSize: maxFieldSize,
			},
		});

		const data: Record<string, unknown> = {};
		const uploads: Promise<unknown>[] = [];

		// We don't want to have these heavy ops when the developer didn't think of it.
		if (maxFileCount || options?.uploadDir || options?.onFile) {
			busboy.on('file', (field, stream, info) => {
				const fileInfo: FileInfo = { name: info.filename, type: info.mimeType, size: 0 };

				// skip empty fields
				if (!fileInfo.name) {
					stream.resume();
					return;
				}

				if (limits.mimeType && !accept(fileInfo, limits.mimeType)) {
					const types = ensureArray(limits.mimeType, ',');
					errors.push({
						value: fileInfo.type,
						path: `/${field}`,
						message: `file '${fileInfo.name}' is not of type ${oneOf(types)}`,
					});
					stream.resume();
					return;
				}

				stream.on('data', (data: []) => {
					fileInfo.size += data.length;
				});

				stream.on('end', () => {
					if (stream.truncated) {
						errors.push({
							path: `/${field}`,
							message: `file '${fileInfo.name}' exceeds ${bytes.format(maxFileSize || 0)}`,
						});

						return;
					}

					setField(data, field, fileInfo);
				});

				if (options?.onFile) {
					const filePromise = new Promise<void>(async (resolve) => {
						try {
							const webStream = Readable.toWeb(stream as Readable);
							await options.onFile!({ field, file: webStream, info: fileInfo });
						} catch (e) {
							if (e instanceof Response) {
								const fileErrors = await e.json();
								if (isAssertionError(fileErrors)) {
									errors.push(...fileErrors.errors);
									return;
								}
							}

							errors.push({
								path: `/${field}`,
								message: e instanceof Error ? e.message : String(e),
								...(typeof e === 'object' ? e : {}),
							});
						} finally {
							resolve();
						}
					});

					uploads.push(filePromise);
				} else if (options?.uploadDir) {
					// write to disk when the user doesn't provide an onFile handler
					const filePromise = new Promise<void>(async (resolve) => {
						try {
							await fs.promises.mkdir(options.uploadDir!, { recursive: true });
							fileInfo.path = path.join(options.uploadDir!, path.basename(field) + '_' + picoid(17));
							await new Promise((resolve, reject) => {
								stream.pipe(fs.createWriteStream(fileInfo.path!)).on('error', reject).on('finish', resolve);
							});
						} finally {
							resolve();
						}
					});

					uploads.push(filePromise);
				} else {
					throw new Error(`Neither uploadDir nor onFile are provided`);
				}
			});
		}

		busboy.on('field', function (field: string, value: unknown, info: FieldInfo) {
			if (info.nameTruncated || info.valueTruncated) {
				errors.push({
					path: `/${field}`,
					message: `field '${field}' exceeds ${bytes(maxFieldSize || 0)}`,
				});
				return;
			}

			setField(data, field, value);
		});

		busboy.on('filesLimit', () => {
			errors.push({
				path: '/',
				message: `file count exceeds ${maxFileCount}`,
			});
		});

		busboy.on('finish', () => {
			Promise.allSettled(uploads)
				.then(() => {
					if (errors.length > 0) {
						return reject(new BodyParserError('could not accept form data', errors));
					}

					resolve(data);
				})
				.catch((err) => {
					reject(err);
				});
		});

		const nodeStream = Readable.fromWeb(req.body as ReadableStream<Uint8Array>);
		nodeStream.pipe(busboy);
	});
}
