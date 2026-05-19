# Next.js Simple Example

Minimal single-avatar demo using `@runwayml/avatars-react` with [Next.js](https://nextjs.org/) App Router. Great starting point for trying the SDK.

## Quick start

```bash
npx degit runwayml/avatars-sdk-react/examples/nextjs-simple my-avatar-app
cd my-avatar-app
cp .env.example .env.local
# Add your RUNWAYML_API_SECRET from https://dev.runwayml.com/

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Custom avatars

To use a custom avatar instead of the default preset, update `MY_AVATAR` in `app/page.tsx` with your avatar ID from the [Developer Portal](https://dev.runwayml.com/). The API route handles both preset and custom avatar types automatically.

## Learn more

- [Runway Avatar SDK](https://github.com/runwayml/avatars-sdk-react)
- [Next.js Documentation](https://nextjs.org/docs)
