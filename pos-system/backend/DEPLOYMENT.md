# Deployment Guide: Hostinger + Supabase

## Hostinger deployment

This project needs two parts:

- The React frontend can run on Hostinger shared hosting in `public_html`.
- The Express backend needs a Hostinger VPS (Node.js + PM2) or another Node.js server. Shared hosting alone cannot keep this backend running.
- PostgreSQL is still required. The current setup uses Supabase PostgreSQL; do not replace it with a file-based SQLite database on a serverless/shared plan.

### 1. Create DNS records

Use separate subdomains, for example:

```text
pos.example.com       -> Hostinger shared hosting (frontend)
api.example.com       -> Hostinger VPS public IP (backend)
```

Wait for both DNS records to resolve, then enable SSL for both domains in Hostinger.

### 2. Deploy the backend on a Hostinger VPS

SSH into the VPS and install Node.js, Git, and PM2. Then run:

```bash
git clone https://github.com/b20171905-create/car-wash.git
cd car-wash/pos-system/backend
npm ci --omit=dev
cp .env.example .env
nano .env
npm run initdb
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Set these values in `.env` before `npm run initdb`:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
JWT_SECRET=replace_with_a_long_random_secret
OWNER_NAME=Your Name
OWNER_EMAIL=your-email@example.com
OWNER_PASSWORD=use_a_strong_initial_password
```

Also add the WhatsApp and email variables if those notifications are enabled. Never commit `.env`.

The backend should be reverse-proxied from `api.example.com` to `127.0.0.1:4000` using Nginx or the Hostinger VPS application proxy. Test it with:

```bash
curl https://api.example.com/health
```

It must return JSON containing `"ok":true` before deploying the frontend.

### 3. Build and deploy the frontend on Hostinger

On a local machine, set the production API URL and build:

```bash
cd pos-system/frontend
npm ci
printf 'VITE_API_BASE=https://api.example.com/api\nVITE_PRINT_AGENT_BASE=http://localhost:9100\n' > .env.production
npm run build
```

Upload everything inside `frontend/dist/` to the Hostinger `public_html/` directory. The included `.htaccess` keeps the React app working when a page is refreshed.

### 4. Configure each branch computer

Install and run the print agent on each branch PC. Keep `VITE_PRINT_AGENT_BASE=http://localhost:9100` when building the frontend so printing remains local to that branch. Start the print agent automatically with Windows Task Scheduler.

### 5. Update deployments

For a backend update:

```bash
cd ~/car-wash
git pull origin main
cd pos-system/backend
npm ci --omit=dev
pm2 restart tiger-car-wash-api --update-env
```

For a frontend update, rebuild `frontend/dist/` locally and upload its contents to `public_html/`.

## Quick Setup

### 1. Supabase Database Connection
- Go to your [Supabase project](https://app.supabase.com)
- Navigate to **Settings → Database → Connection String**
- Copy the connection string (it will look like):
  ```
  postgresql://postgres:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- **Important**: The default URL shown uses port 5432. Change it to port 6543 with `?pgbouncer=true` for production pooling.

### 2. Encode the Database Password
If your Supabase password contains special characters (@, #, $, etc.), you must percent-encode it:

**Linux/Mac:**
```bash
node -e "console.log(encodeURIComponent('YOUR_PASSWORD'))"
```

**Windows (PowerShell):**
```powershell
node -e "console.log(encodeURIComponent('YOUR_PASSWORD'))"
```

Replace `YOUR_PASSWORD` with your actual database password. Copy the output and insert it into the connection string.

### 3. Deploy on Vercel

#### Option A: Via Vercel Dashboard (Recommended)
1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Select `pos-system/backend` as the root directory
5. Set **Environment Variables**:
   - `DATABASE_URL` = Full connection string (pooler, port 6543 with ?pgbouncer=true)
   - `DIRECT_URL` = Connection string for migrations (port 5432)
   - `PORT` = 4000 (or leave empty; Vercel assigns a port)
   - `JWT_SECRET` = Generate a random long string
   - `OWNER_NAME` = Name of initial owner user
   - `OWNER_EMAIL` = Email for login
   - `OWNER_PASSWORD` = Initial password
   - (Optional) `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `OWNER_WHATSAPP_NUMBER`
6. Click **Deploy**

#### Option B: Via Vercel CLI
```bash
cd pos-system/backend
npm install -g vercel
vercel login
vercel env add DATABASE_URL  # Paste full pooler URL here
vercel env add DIRECT_URL     # Paste direct URL here
vercel env add OWNER_EMAIL
vercel env add OWNER_PASSWORD
vercel env add OWNER_NAME
vercel env add JWT_SECRET
vercel deploy --prod
```

### 4. Initialize Database (One-time)

After deployment, initialize the database by running:

```bash
# Via Vercel CLI
vercel env pull        # Download env vars to .env.local
npm run initdb         # Run seed script locally

# Or manually via Supabase SQL Editor
# Paste the schema from db/schema.sql into the SQL Editor and execute
# If the database already exists, also run db/migrate_vehicle_types.sql once.
```

### 5. Test the Backend

```bash
# Test login (replace with your deployed Vercel URL)
curl -X POST https://your-vercel-domain.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"your_password"}'
```

### 6. Frontend Configuration

Update your frontend `.env` to point to the backend:

```env
VITE_API_BASE=https://your-vercel-domain.vercel.app/api
```

## Troubleshooting

### "Error: password authentication failed"
- Verify the database password is correct in Supabase
- Check that the password is properly percent-encoded (especially if it contains special characters)
- Try copying the connection string directly from Supabase UI (it auto-encodes)

### "Error: connect ENOTFOUND"
- Verify the host URL is correct (should be `aws-0-ap-northeast-1.pooler.supabase.com`)
- Check that DATABASE_URL is set in Vercel environment variables
- Ensure port is 6543 (pooler) for production

### "Database initialization failed"
- Make sure `OWNER_EMAIL` and `OWNER_PASSWORD` are set before running init
- Check Vercel logs: `vercel logs`
- Run init locally first to test: `npm run initdb`

### Can't access API endpoints
- Verify the backend URL in Vercel dashboard under **Deployments**
- Check API routes start with `/api/` (e.g., `/api/auth/login`)
- Look at Vercel logs for errors: `vercel logs`

## Environment Variables Checklist

- ✅ DATABASE_URL (Supabase pooler, port 6543)
- ✅ DIRECT_URL (Supabase direct, port 5432)
- ✅ PORT (default 4000)
- ✅ JWT_SECRET (long random string)
- ✅ OWNER_NAME
- ✅ OWNER_EMAIL
- ✅ OWNER_PASSWORD

## File Structure

```
pos-system/
├── backend/                    # Express API
│   ├── server.js              # Main server file
│   ├── db/
│   │   ├── index.js           # PostgreSQL connection pool
│   │   ├── schema.sql         # Database schema
│   │   ├── init.js            # Seed script
│   ├── routes/                # API endpoints
│   ├── .env.example           # Environment template
│   ├── package.json
│   └── vercel.json            # Vercel configuration
└── frontend/                  # Next.js / React frontend
    └── .env.local             # Frontend config
```

## Supabase Connection Pooling

For serverless/production use, Vercel recommends using Supabase's **PgBouncer pooler**:

- **Pooler URL** (for app): `postgresql://postgres:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
- **Direct URL** (for migrations): `postgresql://postgres:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`

The pooler maintains persistent connections and is optimized for serverless environments.

## Next Steps

1. Connect your GitHub repo to Vercel
2. Set the environment variables (especially DATABASE_URL with encoded password)
3. Deploy and check logs
4. Run `npm run initdb` to seed the owner account and initial data
5. Update frontend to point to the Vercel backend URL
