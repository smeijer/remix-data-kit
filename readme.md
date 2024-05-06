# remix-data-kit

> a kit to simplify remix actions / handling form data

## Install

```sh
npm install remix-data-kit
```

## Usage

Without `remix-data-kit`

```ts
export const actions = async ({ request, context }: ActionFunctionArgs) => {
	const formData = await request.formData();
	const _intent = formData.get("_intent");

	switch (_intent) {
		case "CREATE_COMMENT": {
			assertUser(request);
			const body = formData.get("body");
			const tags = formData.get("tags");
			return context.api.createComment({ user, comment: { body, tags } });
		}

		case "UPDATE_COMMENT": {
			assertUser(request);
			const body = formData.get("body");
			return context.api.updateComment({ user, comment: { body } });
		}

		default: {
			throw json({
				ok: false,
				message: `No handler found for action: ${_intent}`,
			});
		}
	}
};
```

Using `remix-data-kit`

We provide the default remix `ActionFunctionArgs` as argument, and extend it with a `payload` property, that contains the FormData as an expanded object using [form-data-kit]. No more manually handling formData.

```ts
import { createActionHandlers } from "remix-data-kit";

export const actions = createActionHandlers({
	CREATE_COMMENT: ({ request, context, payload }) => {
		assertUser(request);
		return context.api.createComment({ user, comment: payload });
	},
	UPDATE_COMMENT: ({ request, context, payload }) => {
		assertUser(request);
		return context.api.updateComment({ user, comment: payload });
	},
});
```

[form-data-kit]: https://npmjs.com/form-data-kit
