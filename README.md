# Drive WebUI

Next.js 16.3 frontend for the Drive UI. It connects to the [Go backend](https://github.com/suraj7026/suraj-drive-api) for:

- Google login and session lookup
- Metadata-backed drive browsing
- Search
- Folder creation
- File upload via presigned URLs
- File download via presigned URLs
- File copy and soft trash

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
- Root archive routes resolve against the authenticated user's stable `drive_id` returned by `GET /api/auth/me`; storage bucket names stay server-side.

## Upload recovery

The upload view shares three transfer slots across selections and retries. Verification runs independently, with at most six admitted files or 64 GiB in the pipeline; a file larger than that budget runs alone. Requests without upload progress fail after 90 seconds, and transient multipart failures retry up to five times with fresh signed URLs. Completed parts are reused.

The transfer drawer distinguishes queued, preparing, uploading, verifying, scanning and failed files. Retry failed files to reuse active upload sessions or check an interrupted verification. Reloading or navigating away requires reselecting local files; IndexedDB retains transfer metadata, not file contents or background upload permission.

Use the matching backend changes for refreshed single-file upload URLs and useful verification failure messages. The deployment's storage quota, available disk space and malware scanner limits still apply. Run `npm run test:unit` for the 107-file stalled-queue, chunk retry, cancellation and backpressure regression suite.
