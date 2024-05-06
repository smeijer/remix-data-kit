# remix-data-kit

> a kit to simplify remix actions / handling form data

## Install

```sh
npm install remix-data-kit
```

## Usage

We provide the default remix `ActionFunctionArgs` as argument, and extend it with a `payload` property, that contains the FormData as an expanded object using [form-data-kit]. No more manually handling formData.

```ts
import { createActionHandlers } from 'remix-data-kit';

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

Without `remix-data-kit` it would look something like this:

```ts
export const actions = async ({ request, context }: ActionFunctionArgs) => {
	const formData = await request.formData();
	const _intent = formData.get('_intent');

	switch (_intent) {
		case 'CREATE_COMMENT': {
			assertUser(request);
			const body = formData.get('body');
			const tags = formData.get('tags');
			return context.api.createComment({ user, comment: { body, tags } });
		}

		case 'UPDATE_COMMENT': {
			assertUser(request);
			const body = formData.get('body');
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

## Validation

To ease validation, we've wrapped the `assertType` utility from [typebox-assert], that asserts and narrows the type of the submitted data using typebox.

`assertType` throws a `Response` with errors when the type is invalid. It also mutates the object to:

- remove additional properties that are not defined in the schema
- add missing properties by using schema defaults
- cast property types where possible

```ts
import { createActionHandlers, assertType } from 'remix-data-kit';
import { Type } from '@sinclair/typebox';

const CreateComment = Type.Object(
	{
		body: Type.String(),
		tags: Type.String(),
	},
	{ $id: 'CreateComment' },
);

const UpdateComment = Type.Object(
	{
		body: Type.String(),
	},
	{ $id: 'UpdateComment' },
);

export const actions = createActionHandlers({
	CREATE_COMMENT: ({ request, context, payload }) => {
		assertUser(request);
		assertType(CreateComment, payload); // throws Response when invalid
		// payload is narrowed to type CreateComment
		return context.api.createComment({ user, comment: payload });
	},
	UPDATE_COMMENT: ({ request, context, payload }) => {
		assertUser(request);
		assertType(UpdateComment, payload); // throws Response when invalid
		// payload is narrowed to type UpdateComment
		return context.api.updateComment({ user, comment: payload });
	},
});
```

[typebox-assert]: https://npmjs.com/typebox-assert
[form-data-kit]: https://npmjs.com/form-data-kit
