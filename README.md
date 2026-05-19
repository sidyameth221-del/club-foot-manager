# Soissons IFC Manager (PWA)

Application web de gestion de club de foot avec une direction artistique inspiree des interfaces FIFA/EA Sports:

- Dark mode profond
- Accents neon cyan/vert
- Effets glassmorphism
- Animations fluides
- Navigation mobile en bottom bar

## Stack

- React 19 + TypeScript
- Vite 8
- React Router
- Supabase JS (Realtime)
- PWA native (manifest + service worker)

## Pages implementees

- Login: selection role Joueur/Coach/Admin, email/password, bouton oeil show/hide
- Dashboard Coach: widgets effectif, assiduite circulaire, prochain rendez-vous
- Equipe & Terrain: vue tactique et cartes effectif style FIFA
- Evenements: liste des rendez-vous a venir
- Tests & Chat: saisie des scores physiques + chat temps reel Supabase
- Parametres: administration rapide

## Lancer le projet

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
```

## Supabase

1. Copier `.env.example` en `.env`
2. Renseigner les variables Supabase
3. Executer le schema SQL present dans `supabase/schema.sql`

Variables attendues:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Le chat fonctionne en local sans Supabase, puis bascule automatiquement en Realtime quand les variables d'environnement sont configurees.

## PWA

- Manifest: `public/manifest.webmanifest`
- Service worker: `public/sw.js`

Le service worker est enregistre uniquement en build production.
