<div align="center">

# 🛡 MZAZI TECH — Admin Panel

### Standalone admin website · shares the same Neon database as the main site

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=nextdotjs&logoColor=white)
![Neon](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E4BC?logo=postgresql&logoColor=white)
![Auth](https://img.shields.io/badge/Auth-ADMIN_JWT_SECRET-blue)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)

**[Main Site](https://github.com/mzazi89/web)** · **[WhatsApp Bot](https://github.com/mzazi89/quartz)** · **[Baileys Fork](https://github.com/mzazi89/baileys)**

</div>

---

## 🚀 Overview

The admin panel is a **fully standalone Next.js app** — it lives in its own repo, deploys on its
own domain (`admin.mzazi.shop`), and contains **zero customer-facing pages**. It talks to the
**same Neon database** as the main website and the WhatsApp bot, so everything stays in sync.

## ✨ Features

| | |
|---|---|
| 📊 **Dashboard** | Overview stats (users, revenue, sessions) |
| 👥 **Users** | Search, view, manage accounts |
| 💳 **Transactions** | Wallet & payment history |
| 📦 **Packages** | Manage sellable products |
| 🎟 **Vouchers** | Create/delete discount vouchers |
| ⭐ **Testimonials** | Moderate customer reviews |
| ✉️ **Inquiries** | View contact submissions |
| 📜 **Bot Commands** | Full CRUD on the WhatsApp command registry — saves go live on the bot within ~15s |
| 🤖 **Bot Control** | Heartbeat, sync, broadcast, bot name |
| 📱 **Sessions** | **All paired numbers across all users** — Active = the session folders the bot holds on disk; **Unlink** logs the device out, **Delete** wipes the session folder + DB row |

## 🔐 Security

- Login requires `ADMIN_EMAIL` + `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`) and issues an
  `admin_token` JWT cookie — **fail-closed**: with no credentials configured, nobody can log in.
- Admin session actions bypass user ownership (the bot skips it when no `accountId` is sent).

## ⚙️ Getting Started

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev                  # http://localhost:3000 → redirects to /admin/dashboard
```

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (**same as the main site + bot**) |
| `ADMIN_EMAIL` | Admin login email (must match what you type) |
| `ADMIN_PASSWORD` | Admin login password |
| `ADMIN_JWT_SECRET` | Secret for the admin session cookie |
| `ADMIN_PASSWORD_HASH` | Optional — bcrypt hash; **overrides** `ADMIN_PASSWORD` when set |

## ☁️ Deployment

1. Add this repo as a **new Vercel project**.
2. Set the 4 environment variables above (`DATABASE_URL` identical to the main site).
3. Deploy — optionally bind it to `admin.mzazi.shop`.
4. The main site's footer "Admin" link points to `https://admin.mzazi.shop`.

## 📦 Related Repos

- [**web**](https://github.com/mzazi89/web) — main website (same DB)
- [**quartz**](https://github.com/mzazi89/quartz) — WhatsApp × Telegram bot (same DB)
- [**baileys**](https://github.com/mzazi89/baileys) — custom Baileys fork

---

<div align="center"><sub>MZAZI TECH INC — Power Your Digital World ⚡</sub></div>
