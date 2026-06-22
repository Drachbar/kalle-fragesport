# Driftsättning

Filer för att köra Kalle Frågesport i produktion. Den fullständiga steg-för-steg-
guiden finns i [huvud-README:ns driftsättningsavsnitt](../README.md#driftsättning-i-produktion);
det här är en karta över vad som ligger var.

```text
deploy/
├── quadlet/   Kör backend- och frontend-containrarna som systemd-tjänster
└── nginx/     nginx-proxy framför containrarna
```

## Helhet

```text
                    ┌─────────── nginx (deploy/nginx) ────────────┐
   TLS-proxy   ───► │  /api/ + /socket.io/  ──►  backend  :3000   │
   (uppströms)      │  allt annat           ──►  frontend :4000   │
                    └─────────────────────────────────────────────┘
                                   backend ──► PostgreSQL (separat server)
```

- **TLS** termineras av en proxy *framför* den här nginx:en – nginx kör HTTP.
- **Containrarna** körs av podman+systemd via Quadlet, på ett gemensamt nät så
  frontend når backend på `http://backend:3000`.
- **Postgres** körs separat; backend ansluter via `DATABASE_URL` och kör
  migreringarna automatiskt vid uppstart.

## Delarna

| Mapp | Vad | Hamnar på servern i |
|------|-----|---------------------|
| [`quadlet/`](quadlet/) | `*.container` / `*.network` + env-mallar | `~/.config/containers/systemd/` (units), `/etc/kalle/` (env) |
| [`nginx/`](nginx/kalle.conf) | `kalle.conf` server-block | `/etc/nginx/conf.d/` (eller `sites-available/` + symlänk) |

Filerna här är källan (i git). Se [`quadlet/README.md`](quadlet/README.md) för
hur de installeras och aktiveras på servern.

## Ordning vid första deploy

1. Bygg imagerna (`backend/Containerfile`, `frontend/Containerfile`).
2. Sätt upp env-filer + Quadlet-units → starta containrarna (se `quadlet/README.md`).
3. Lägg `nginx/kalle.conf` på plats, `sudo nginx -t`, ladda om nginx.
4. Skapa adminkonto mot produktionsdatabasen (`npm run create-admin`).
