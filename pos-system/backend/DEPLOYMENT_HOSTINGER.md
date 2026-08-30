# Deployment Guide: Hostinger

## Quick Setup

### 1. Hostinger MySQL Database Setup
- Log in to Hostinger control panel
- Go to **Databases** section
- Create a new MySQL database with:
  - Database name: `u715178331_tcw_database`
  - Username: `u715178331_tcw_service`
  - Password: Your secure password (will be URL-encoded in connection string)
  - Host: `localhost` (standard for Hostinger shared hosting)

### 2. Environment Variables Configuration

Set these in **Hostinger Dashboard → Websites → Web Apps → Environment variables**:

```
PORT=4000
NODE_ENV=PRODUCTION
DB_CLIENT=MYSQL
DATABASE_URL=mysql://u715178331_tcw_service:password%40123@localhost:3306/u715178331_tcw_database
JWT_SECRET=YOUR_LONG_SECURE_SECRET_HERE
OWNER_NAME=Hammad Khan
OWNER_EMAIL=tigercarwash.com
OWNER_PASSWORD=Ashnabmalik@123
WHATSAPP_TOKEN=(optional)
WHATSAPP_PHONE_NUMBER_ID=(optional)
OWNER_WHATSAPP_NUMBER=(optional)
```

**Important**: If your password contains special characters (@, #, $), encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`

### 3. Deploy Backend

1. Go to **Hostinger → Websites → Web Apps**
2. Click **Create App** or upload your project
3. Select **Express** framework and **Node 22.x**
4. Set root directory to `pos-system/backend`
5. Add the environment variables (see step 2)
6. Click **Deploy**

Hostinger will:
- Install dependencies (`npm install`)
- Run database initialization (`npm run initdb`)
- Start the backend on configured PORT

### 4. Verify Backend is Running

Test the health endpoint:
```bash
curl https://steelblue-squid-715050.hostingersite.com/health
```

Expected response:
```json
{"ok":true,"time":"2026-08-30T..."}
```

### 5. Deploy Frontend

1. Build the frontend:
```bash
cd pos-system/frontend
npm install
npm run build
```

2. Upload `dist/` contents to `public_html`:
   - Go to **Hostinger → Files → File Manager**
   - Navigate to `public_html`
   - Upload all files from `frontend/dist/`

3. Update frontend environment:
```
VITE_API_BASE=https://steelblue-squid-715050.hostingersite.com/api
VITE_PRINT_AGENT_BASE=http://localhost:9100
```

### 6. Test the Application

Visit: `https://steelblue-squid-715050.hostingersite.com`

Login with:
- Email: `tigercarwash.com`
- Password: `Ashnabmalik@123`

## Troubleshooting

### "Cannot GET /"
- Frontend files not uploaded correctly to `public_html`
- Check that files are directly in `public_html`, not in a subfolder
- Verify `index.html` is present

### "Invalid credentials" on login
- Check OWNER_EMAIL and OWNER_PASSWORD in environment variables
- Database initialization may have failed - check Runtime logs
- Verify MySQL connection string is correct

### "Connection refused" / Database errors
- Verify DATABASE_URL is correct in environment variables
- Check MySQL database exists and username has access
- Test MySQL connection via phpMyAdmin
- Check that DB_CLIENT is set to `MYSQL`

### Slow loading
- Check performance in Hostinger dashboard
- Clear browser cache (Ctrl+Shift+Del)
- Check Runtime logs for errors

### API endpoints not responding
- Verify backend deployment status is "Running"
- Check environment variables are all set
- Test `/health` endpoint first: `curl https://your-url/health`

## Update Workflow

### Update Backend Code
1. Edit code locally
2. Upload updated files to Hostinger Web Apps
3. Hostinger auto-redeploys on changes

### Update Frontend Code
1. Edit code locally
2. Run `npm run build`
3. Upload new `dist/` to `public_html`
4. Clear browser cache

### Update Database Schema
1. Modify schema files locally
2. Run `npm run initdb` manually if needed
3. Or update via phpMyAdmin

## Environment Variables Checklist

- ✅ PORT (4000)
- ✅ NODE_ENV (PRODUCTION)
- ✅ DB_CLIENT (MYSQL)
- ✅ DATABASE_URL (MySQL connection string with encoded password)
- ✅ JWT_SECRET (long random string)
- ✅ OWNER_NAME
- ✅ OWNER_EMAIL
- ✅ OWNER_PASSWORD

## Database Connection String Format

```
mysql://username:password@host:port/database
```

Example:
```
mysql://u715178331_tcw_service:Ashnabmalik%40123@localhost:3306/u715178331_tcw_database
```

## File Structure

```
pos-system/
├── backend/
│   ├── server.js              # Main Express server
│   ├── db/
│   │   ├── index.js           # MySQL connection pool
│   │   ├── schema.mysql.sql   # MySQL schema
│   │   ├── init.js            # Database seed script
│   ├── routes/                # API endpoints
│   ├── services/              # Email, WhatsApp, printing
│   ├── .env.example           # Environment template
│   └── package.json           # Dependencies
└── frontend/
    ├── src/                   # React components
    ├── dist/                  # Built files (upload to public_html)
    ├── .env.production        # Production config
    └── package.json
```

## Next Steps

1. ✅ Create MySQL database on Hostinger
2. ✅ Deploy backend via Web Apps
3. ✅ Build and deploy frontend to public_html
4. ✅ Test login and dashboard
5. Configure WhatsApp notifications (optional)
6. Set up branch thermal printers (optional)
