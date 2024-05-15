import { ActionFunction, ActionFunctionArgs, json } from '@remix-run/server-runtime';
import type { AppLoadContext } from '@remix-run/server-runtime/dist/data.js';
import { Static, TSchema } from '@sinclair/typebox';

import { assertType } from './assert.js';
import { bodyparser, BodyParserOptions } from './internal/body-parser.js';

const actionIntentKeys = ['action', 'intent', '_action', '_intent'];

function getActionName(url: string) {
	const searchParams = new URL(url).searchParams;

	if (searchParams.size === 1) {
		const key = String(searchParams.keys().next().value || '');
		if (key[0] === '/' && key.length > 1) {
			return key.slice(1);
		}
	}

	// use get vs has, so empty values are ignored (example.com?action&q=search)
	const intentKey = actionIntentKeys.find((key) => searchParams.get(key));
	if (intentKey) {
		return searchParams.get(intentKey)!;
	}

	throw json({ ok: false, message: `No intent specified in search params.` }, { status: 404 });
}

async function getRequestBody(request: Request, options?: BodyParserOptions) {
	const body = await bodyparser(request, options);

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw json({ ok: false, message: `Expecting an object in the request body, found ${typeof body}` });
	}

	return body;
}

export function createActionHandler(handlers: Record<string, ActionHandler> | Array<ActionHandler>) {
	const fns = Array.isArray(handlers) ? handlers : Object.values(handlers);
	const actionMap = new Map<string, ActionHandler>();

	for (const handler of fns) {
		actionMap.set(handler.name, handler);
	}

	return function pageAction(args: ActionFunctionArgs) {
		const actionName = getActionName(args.request.url);
		const formAction = actionMap.get(actionName);

		if (!formAction) {
			return json({ ok: false, message: `No handler found for action: ${actionName}.` }, { status: 404 });
		}

		return formAction.handle(args);
	};
}

export type CreateActionArgs<
	T extends TSchema | undefined = undefined,
	TData = T extends TSchema ? Static<T> : unknown,
> = {
	name: string;
	schema?: T;
	handler: (data: TData, context: AppLoadContext, args: ActionFunctionArgs) => Promise<Response> | Response;
	onFile?: BodyParserOptions['onFile'];
	limits?: BodyParserOptions['limits'];
};

export type ActionHandler = {
	name: string;
	handle: ActionFunction;
};

export function createAction<T extends TSchema, TData = T extends TSchema ? Static<T> : unknown>(
	handler: CreateActionArgs<T, TData>,
): ActionHandler {
	return {
		name: handler.name,
		handle: async function handleAction(args: ActionFunctionArgs): Promise<Response> {
			try {
				const body: unknown = await getRequestBody(args.request, { limits: handler.limits, onFile: handler.onFile });
				if (handler.schema) assertType(handler.schema, body);
				return await handler.handler(body as TData, args.context, args);
			} catch (err) {
				if (err instanceof Response) return err;
				throw err;
			}
		},
	};
}
