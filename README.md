# Aetherion Core

Modern Minecraft server website built with Node.js, Express, SQLite, bcrypt, express-session, WebSocket, and file system file manager.

## Features

- Landing page with server status and player count
- Signup / login with hashed passwords
- Role-based access control (admin, staff, user)
- Shop with categories and API endpoints
- Staff list page and API
- Admin panel for users, shop items, staff, file manager, and live console
- WebSocket-based live console logs and command input
- File browser, editor, upload, delete with path validation
- Server status checker and player list endpoint

## Setup

1. Install dependencies:

```bash
npm install
```

2. Seed the database:

```bash
npm run seed
```

3. Start the server:

```bash
npm start
```

4. Open `http://localhost:3000` in your browser.

## Cloudflare frontend + external API

If your frontend is on `*.workers.dev` but your Node API is hosted elsewhere:

1. Set frontend API base URL in [`public/js/config.js`](public/js/config.js):
   - `apiBaseUrl: 'https://your-api-domain.com'`
2. Set backend env vars:
   - `CORS_ORIGINS=https://your-frontend-domain.workers.dev`
   - `SESSION_COOKIE_SAMESITE=none`
   - `SESSION_COOKIE_SECURE=true`
3. Restart backend after changing env.

Without this, login/signup can fail with generic server/network errors due to CORS/cookie blocking.

## Auto commit + push

Run:

```bash
npm run git:auto -- "your commit message"
```

If no message is provided, it uses a timestamp message automatically.

## Admin account

The seed script creates a default admin account:

- username: `admin`
- email: `admin@aetherion.local`
- password: `Admin@123`

## Project structure

- `app.js` - Express server and WebSocket setup
- `server/` - route handlers, middleware, database helpers, and console simulator
- `public/` - frontend HTML, CSS, and JavaScript
- `server_files/` - admin file manager sandbox
- `server.sqlite` - generated SQLite database file
