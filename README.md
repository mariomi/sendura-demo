# SENDURA — Demo Admin/Cliente (Vite + React)

## Deploy su Vercel
1. Metti questi file in un repo GitHub (es. `sendura-demo`).
2. In Vercel → New Project → importa il repo.
3. Imposta Framework **Vite**. Build `npm run build`. Output `dist`.
4. Environment variable: `VITE_ADMIN_KEY = MettiUnPasscodeForte` (Project Settings → Environment Variables).
5. Deploy.

## Link utili
- Vista cliente: `https://TUO-DOMINIO/?view=client&rate=45&buffer=20`
- Vista admin: `https://TUO-DOMINIO/?view=admin` → clicca “Login admin” e inserisci `VITE_ADMIN_KEY`.

## Avvio locale
```bash
npm install
npm run dev
```

## Pubblicare modifiche ore/prezzi
In Admin (dopo login):
- Modifica valori nelle tabelle.
- “Salva bozza (locale)” salva in `localStorage`.
- “Scarica data.json” scarica i dati aggiornati → sostituisci `public/data.json` nel repo → push.
