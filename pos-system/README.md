# Car Shop POS — Multi-Branch, WhatsApp, Thermal Print

## What's in here

```
pos-system/
├── backend/        Central API + database. One instance, hosted in the cloud.
│                    All branches connect to this over the internet.
├── frontend/        POS terminal UI (React). Runs in a browser window/kiosk
│                     on each branch's Windows 10 PC.
└── print-agent/     Tiny local helper. Runs on each branch's Windows 10 PC
                      next to the browser. Bridges the browser to the
                      physical USB thermal printer (browsers can't talk to
                      ESC/POS printers directly).
```

## How it fits together

```
Branch A PC (Windows 10)          Branch B PC (Windows 10)
┌─────────────────────┐           ┌─────────────────────┐
│ Browser: POS UI      │           │ Browser: POS UI      │
│ Print Agent (local)  │           │ Print Agent (local)  │
│ Thermal Printer (USB)│           │ Thermal Printer (USB)│
└──────────┬───────────┘           └──────────┬───────────┘
           │  HTTPS                            │  HTTPS
           └──────────────┬─────────────────────┘
                           ▼
              Central Backend (cloud server)
              ├── PostgreSQL/SQLite (all branches, one DB)
              └── WhatsApp Cloud API → customer + owner
```

Every sale is tagged with `branch_id`, so the owner's dashboard shows
consolidated revenue across all branches in real time, while each branch
only sees/creates sales for itself.

## 1. Backend setup (do this first, on your server or laptop for testing)

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set JWT_SECRET, and your WhatsApp Cloud API credentials
npm run initdb    # creates first branch + owner login (owner@example.com / changeme123)
npm start         # runs on http://localhost:4000
```

**Change the seed password immediately** — there's no reset-password flow
yet, so update it directly in the `users` table or add one before going live.

### Getting WhatsApp Cloud API credentials
1. Create a Meta Developer account → create a WhatsApp Business app.
2. Get a permanent access token and your Phone Number ID from Meta Business Manager.
3. Put them in `backend/.env`.
4. Note: messages sent outside a 24-hour customer-initiated window need a
   pre-approved **template** (Meta requires this for cold outreach). For
   receipts sent right after a sale, a free-form text usually works if the
   customer has messaged your business number before — otherwise register a
   simple "Receipt" template in Meta Business Manager and adjust
   `backend/services/whatsapp.js` to use `type: "template"`.

## 2. Frontend setup (per branch, or run centrally and open per branch)

```bash
cd frontend
npm install
# create .env with:
# VITE_API_BASE=https://your-backend-domain.com/api
# VITE_PRINT_AGENT_BASE=http://localhost:9100
npm run dev       # dev mode, http://localhost:5173
npm run build     # production build → deploy the dist/ folder, or run as a kiosk
```

For Windows 10 kiosk mode: point Chrome/Edge at the built site with
`--kiosk` flag — **or** build a real desktop `.exe` installer, see section 2b.

## 2b. Build a Windows .exe installer (recommended for cashiers)

This turns the POS into a real double-click Windows app (no browser, no
address bar, proper Start Menu shortcut). You need to do this on a Windows
or Mac/Linux machine with Node.js installed and internet access (the exe
build tools download from npm).

```bash
# 1. Build the React frontend first
cd frontend
npm install
npm run build          # produces frontend/dist

# 2. Build the Windows installer
cd ../electron-app
npm install
npm run dist            # produces the .exe in electron-app/dist-installer/
```

You'll get something like:
`electron-app/dist-installer/Car Shop POS Setup 1.0.0.exe`

Copy that `.exe` to each branch's Windows 10 PC and run it — it installs
like normal software with a desktop icon and Start Menu entry. Double-click
to open the POS, no browser needed.

**Before building**, point it at your live backend: open
`frontend/.env` (create it if missing) and set:
```
VITE_API_BASE=https://your-backend-domain.com/api
VITE_PRINT_AGENT_BASE=http://localhost:9100
```
Then rebuild (`npm run build` in frontend, then `npm run dist` in
electron-app) so the exe points at your real server, not localhost.

Optional: drop a `256x256 icon.ico` into `electron-app/build/` before
building to replace the default icon (see `ICON_README.txt` there).

Note: this `.exe` only wraps the **POS terminal UI**. You still run
`backend` centrally (cloud server) and `print-agent` locally on each branch
PC as described above — those aren't inside this exe.

## 3. Print agent setup (on EACH branch PC, next to the thermal printer)

```bash
cd print-agent
npm install
# Windows: share your thermal printer as "POS-58" (or whatever name), set
# it to "Generic / Text Only" driver if using raw ESC/POS
set PRINTER_INTERFACE=printer:POS-58
npm start          # runs on http://localhost:9100
```

Set this to auto-start on Windows boot (Task Scheduler → run at login) so
the cashier never has to remember to launch it.

## 4. Login

Default seeded login: `owner@example.com` / `changeme123`
- **Owner**: sees all branches, dashboard, can create branches/services.
- **Branch manager / cashier**: create these users manually for now (via a
  DB insert or a small admin script) and assign them a `branch_id` — they'll
  only see/checkout for their own branch.

## What's NOT built yet (next steps, tell me which to prioritize)
- User management UI (currently: DB insert only)
- Password reset flow
- Refunds/voids UI (schema supports it, no route yet)
- Electron packaging for a proper Windows installer
- Inventory/parts tracking (currently services only — easy to add a
  `products` table alongside `services` if you sell parts too)
- Postgres migration guide if SQLite outgrows you (schema is portable)

## Multi-branch note
This scaffold assumes always-online branches (per your answer). If you later
need offline support (branch keeps working during an internet outage), the
frontend would need local storage + a sync queue — a bigger change, happy to
add it if it becomes necessary.
