# remix-data-kit

> a kit to simplify remix actions / handling validated form data including file uploads.

## Install

```sh
npm install remix-data-kit
```

## Usage

We provide the `createActionHandler` method that creates a remix `ActionFunction`. In our actions, validated `data` is the first argument, remix `AppLoadContext` the second, and the remix default `ActionFunctionArgs` as third in case you'd really need it.

The data argument is the posted json, or FormData expanded using [form-data-kit]. Any file streams are piped to your `onFile` handler. No more manually handling FormData.

```ts
import { createActionHandler, createAction } from 'remix-data-kit';
import { Static, Type } from '@sinclair/typebox';
import { json } from '@remix-run/node';

export const CreateCommentSchema = Type.Object({
  body: Type.String({ minLength: 1, maxLength: 280 }),
  author: Type.String(),
});

const createComment = createAction({
  // the name is used as action intent
  name: 'create-comment',
  // schema to validate the posted json or FormData
  schema: CreateCommentSchema,
  // we provide data as first arg, and the context as second for convinience
  handler: async (data, { db }, args) => {
    // data is validated & typed!
    const inserted = await db.comments.insert(data);

    // return a remix/react-router valid response
    return json({ ok: true, comment: inserted });
  },
});

export const action = createActionHandler({
  createComment,
  // updateComment,
  // deleteComment,
});
```

Without `remix-data-kit` it would look something like this:

```ts
export const action = async ({ request, context }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const _intent = formData.get('_intent');

  switch (_intent) {
    case 'create-comment': {
      assertUser(request);
      const body = formData.get('body').trim();
      const author = formData.get('author');

      if (body.length < 1 || body.length > 280) {
        throw json({ msg: 'invalid' }, { status: 422 });
      }

      const inserted = await db.comments.insert({ author, body });
      return json({ ok: true, comment: inserted });
    }

    case 'update-comment': {
      // ...
    }

    case 'delete-comment': {
      // ...
    }

    default: {
      throw json({ ok: false, message: `No handler found for action: ${_intent}` }, { status: 404 });
    }
  }
};
```

## Intent

We can't submit the forms without an intent, so let's handle that first. To make `remix-data-kit` understand your action intent, add one of the intent keys to your form `action` attribute:

```tsx
<form method="post" action="?/create-comment">
<form method="post" action="?action=create-comment">
<form method="post" action="?intent=create-comment">
```

It's a popular convention to use a named submit button, instead of this action url, but adding the intent to the url, allows us to extract the intent, before the full body is received, parsed, and validated. This way we can return a 404 before say all file uploads are processed.

## Validation

To ease validation, we're providing a [typebox] schema to our createAction method. Under the hood, we're using the `assertType` utility from [typebox-assert] to assert and narrow the type, and have wrapped that to throw a response instead of Error, that asserts and narrows the type of the submitted data.

`assertType` throws a `Response` with errors when the type is invalid. It also mutates the object to:

- remove additional properties that are not defined in the schema
- add missing properties by using schema defaults
- cast property types where possible

```ts
import { createActionHandler, createAction, assertType } from 'remix-data-kit';
import { Type, Static } from '@sinclair/typebox';

const CreateComment = Type.Object({
  body: Type.String(),
  tags: Type.String(),
});

export const action = createActionHandler({
  createComment: createAction({
    schema: CreateComment,
    handler: async (data) => {
      // data is typed as Static<CreateComment>
    },
  }),
});

// this would be the same:
export const action = createActionHandler({
  createComment: createAction({
    handler: async (data: unknown) => {
      assertType(CreateComment, data, 'data is not a valid comment');
      // data is narrowed to Static<CreateComment>
    },
  }),
});
```

Our recommendation is to use the `schema` property for actions, while using `assertType` to verify data structured from data that you fetch inside the actions, from say third party services.

## Expansion

We use [form-data-kit] to expand form data. Meaning, the data on your server is a structured json object even when form fields themselves are flat. For example:

```tsx
<input name="user.name" value="Alex" />
<input name="user.handle" value="@example" />
<input name="colors[].label" value="blue" />
<input name="colors[].label" value="red" />
<input name="colors[].label" value="green" />
```

Maps into:

```ts
const data = {
  user: { name: 'Alex', handle: '@example' },
  colors: [{ label: 'blue' }, { label: 'red' }, { label: 'green' }],
};
```

## File uploads

File uploads are handled by simply adding an `onFile` handler. Write the file to disk, or stream
it to another service provider. By the time all files are handled, the remaining payload is validated
and the `handler` is called to return a response.

```ts
import { assertType, readableStreamToFile } from 'remix-data-kit';

export const AttachmentSchema = Type.Object({
  id: Type.String(),
  files: Type.Array(
    Type.Object({
      id: Type.Number(),
      name: Type.String(),
      url: Type.String(),
    }),
  ),
});

export const createAttachmentAction = createAction({
  name: 'create-attachment',
  schema: AttachmentSchema,
  handler: (data) => {
    // here, data is of type Static<AttachmentSchema>, and `files` is
    // no longer a blob, but the meta data from the files
    return json({ ok: true, data });
  },
  // on file runs for every file upload (blob in FormData), and before handler
  onFile: async ({ file, info }) => {
    const blob = await uploadToS3({ file, info });
    // assign some data to `info` to make it available in `handler`,
    // be sure to match your schema type
    info.id = blob.id;
    info.url = blob.url;
  },
});
```

## Stream utilities

We're providing two stream utilities to make it easier to deal with file uploads.

**readableStreamToFile**, converts a ReadableStream to a File
**readableStreamToBlob**, converts a ReadableStream to a Blob

These methods make it trivial to map the stream into a format that can be provided to say FormData.

The `onFile` handler provides you with a Web ReadableStream, remember to use `Readable.fromWeb` if you'd need a Node stream.

## Limits

We support a couple of limits to manage how big a posted json object could be, or to accept only a certain file count of file type. The currently supported limits are:

- **fileCount** _number_

  The maximum number of files a user can upload. Note that empty file fields, still count against the file count limit.

- **fileSize** _number | string_

  The maximum size per file in bytes.

- **fieldSize** _number | string_;

  The maximum size of text fields.

- **jsonSize** _number | string_;

  The maximum size of json payloads.

- **mimeType** _string | string[]_;

  A valid [HTML accept](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept) string to restrict mime-types

Provide these to your action's limits property:

```ts
export const createAttachmentAction = createAction({
  name: 'create-attachment',
  schema: AttachmentSchema,
  handler: async (data) => {
    /* ... */
  },
  onFile: async ({ file, info }) => {
    /* ... */
  },
  limits: {
    fileCount: 3,
    fileSize: '1mb',
    fieldSize: '10kb',
    jsonSize: '150kb',
    mimeType: ['image/png', 'image/jpg'],
  },
});
```

## Content-Type

When using `createAction`, your endpoint suddenly supports not only FormData, but also json. Post using any of the content types:

- application/json
- application/x-www-form-urlencoded
- multipart/form-data

[typebox-assert]: https://npmjs.com/typebox-assert
[form-data-kit]: https://npmjs.com/form-data-kit
[typebox]: https://github.com/sinclairzx81/typebox
