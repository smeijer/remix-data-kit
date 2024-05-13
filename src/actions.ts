import { ActionFunctionArgs, json } from '@remix-run/server-runtime';
import { expand } from 'form-data-kit';

export type SubmissionHandlerArgs = ActionFunctionArgs & { payload: unknown };
export type SubmissionHandler = (args: SubmissionHandlerArgs) => Promise<Response> | Response;
export type SubmissionHandlers = Record<string, SubmissionHandler>;

async function handleFormSubmission(args: ActionFunctionArgs, handlers: SubmissionHandlers) {
	const request = args.request.clone();
	const { _intent: action, ...payload } = expand(await request.formData());

	if (!action || typeof action !== 'string') {
		throw json({ ok: false, message: `No intent specified in form data` }, { status: 404 });
	}

	const handler = handlers[action];
	if (!handler) {
		throw json({ ok: false, message: `No handler found for action: ${action}` }, { status: 404 });
	}

	return handler({ ...args, payload });
}

export function createActionHandler(handlers: SubmissionHandlers) {
	return async function action(args: ActionFunctionArgs): Promise<Response> {
		return await handleFormSubmission(args, handlers).catch((err) => {
			if (err instanceof Response) return err;
			throw err;
		});
	};
}
