import { blob } from 'node:stream/consumers';
import { ReadableStream } from 'node:stream/web';

import { FileInfo } from './internal/body-parser.js';

export async function readableStreamToBlob(stream: ReadableStream): Promise<Blob> {
	return blob(stream) as Promise<Blob>;
}

export async function readableStreamToFile(stream: ReadableStream, info: FileInfo): Promise<File> {
	const blob = await readableStreamToBlob(stream);
	return new File([blob], info.name, { type: info.type });
}
