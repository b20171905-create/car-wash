# Deployment Guide: Vercel + Supabase

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
