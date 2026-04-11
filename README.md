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

## Production Deployment

### Railway (Recommended - Easiest)

1. **Create Railway Account**: Go to [railway.app](https://railway.app) and sign up
2. **Connect GitHub**: Link your GitHub account
3. **Deploy from GitHub**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `Aetherion-Core` repository
   - Railway will auto-detect Node.js and deploy

4. **Set Environment Variables** in Railway dashboard:
   ```
   CORS_ORIGINS=https://your-app-name.railway.app
   SESSION_COOKIE_SAMESITE=lax
   SESSION_COOKIE_SECURE=true
   SESSION_SECRET=your-secure-random-secret-here
   NODE_ENV=production
   PORT=3000
   ```

5. **Update Frontend Config**:
   - In `public/js/config.js`, change the default URL to your Railway URL
   - Commit and push the changes

6. **Access Your App**: Railway will give you a URL like `https://your-app-name.railway.app`

### Alternative: Render

1. **Create Render Account**: [render.com](https://render.com)
2. **New Web Service** → Connect GitHub
3. **Configure**:
   - Build Command: `npm install`
   - Start Command: `npm run railway:start`
4. **Add Environment Variables** (same as Railway)
5. **Deploy**

### Alternative: Heroku

1. **Install Heroku CLI**
2. **Login**: `heroku login`
3. **Create App**: `heroku create your-app-name`
4. **Set Environment Variables**: `heroku config:set KEY=value`
5. **Deploy**: `git push heroku main`

## Cloudflare frontend + external API

If your frontend is on `*.workers.dev` but your Node API is hosted elsewhere:

1. Set frontend API base URL in [`public/js/config.js`](public/js/config.js):
   - `apiBaseUrl: 'https://your-api-domain.com'`
   - Quick runtime option from browser console: `setApiBaseUrl('https://your-api-domain.com')`
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
