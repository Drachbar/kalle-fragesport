# Quadlet – köra Kalle Frågesport som systemd-tjänster

Filerna här (`*.container`, `*.network`) är **källan**, versionshanterad i git. På
servern kopieras de in i systemds Quadlet-katalog, där podman+systemd gör dem till
riktiga tjänster med autostart vid boot och omstart vid krasch.

Instruktionerna gäller **rootless** podman (rekommenderat). För rootful: använd
`/etc/containers/systemd/` och `sudo systemctl` utan `--user`.

## 1. Bygg imagerna på servern

```sh
cd backend  && podman build -t kalle-backend  -f Containerfile .
cd ../frontend && podman build -t kalle-frontend -f Containerfile .
```

## 2. Lägg hemligheterna på servern (utanför git)

```sh
sudo mkdir -p /etc/kalle
sudo cp deploy/quadlet/backend.env.example  /etc/kalle/backend.env
sudo cp deploy/quadlet/frontend.env.example /etc/kalle/frontend.env
# Fyll i värdena, och lås ner backend.env (innehåller hemligheter):
sudo chown $USER /etc/kalle/backend.env /etc/kalle/frontend.env
chmod 600 /etc/kalle/backend.env
```

## 3. Installera Quadlet-filerna

```sh
mkdir -p ~/.config/containers/systemd
cp deploy/quadlet/kalle.network \
   deploy/quadlet/kalle-backend.container \
   deploy/quadlet/kalle-frontend.container \
   ~/.config/containers/systemd/

systemctl --user daemon-reload
```

## 4. Starta

```sh
systemctl --user start kalle-backend kalle-frontend
systemctl --user status kalle-backend
podman ps
```

Nätverket (`kalle-network.service`) startas automatiskt som beroende.

## 5. Autostart vid serverns boot

Rootless-tjänster behöver "linger" för att starta utan att du är inloggad:

```sh
loginctl enable-linger $USER
```

Tjänsterna har `WantedBy=default.target`, så efter `daemon-reload` + linger
startar de vid boot.

## Uppdatera efter ny version

Bygg om imagen och starta om tjänsten:

```sh
cd backend && podman build -t kalle-backend -f Containerfile .
systemctl --user restart kalle-backend
```

## Felsökning

- `systemctl --user status kalle-backend` – ser tjänsten ut att köra?
- `journalctl --user -u kalle-backend -f` – loggar (även appens stdout).
- `systemctl --user cat kalle-backend` – visar den genererade unit-filen.
- Ändrade du en `.container`-fil? Kopiera in den igen + `daemon-reload`.
