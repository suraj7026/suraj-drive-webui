# Drive WebUI

Next.js 16 frontend for the Drive archive UI. It connects to the [Go backend](https://github.com/suraj7026/suraj-drive-api) for:

- Google login and session lookup
- Bucket browsing
- Search
- Folder creation
- File upload via presigned URLs
- File download via presigned URLs
- File copy and delete

## Prerequisites

- Node.js 20+ and npm
- A running instance of the [`suraj-drive-api`](https://github.com/suraj7026/suraj-drive-api) Go backend (defaults to `http://localhost:4001`)

## Local Setup

1. Start the Go backend (see its repo for instructions).
2. Create `./.env.local` in this repo with:

   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:4001
   ```

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

The frontend runs on [http://localhost:4000](http://localhost:4000).

## Environment Variables

| Variable               | Default                  | Purpose                                     |
| ---------------------- | ------------------------ | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:4001`  | Browser-facing base URL for the Go backend. |
| `API_URL`              | falls back to above      | Server-side base URL (used in Server Components / Route Handlers). |

See `.env.example` for a starter file.

## Verification

```bash
npm run lint
npm run build
```

## Notes

- The backend must allow `http://localhost:4000` in its CORS config.
- The Shared screen remains a placeholder view until the backend exposes dedicated endpoints for it.
- Root archive routes resolve against the authenticated user bucket returned by `GET /api/auth/me`.
