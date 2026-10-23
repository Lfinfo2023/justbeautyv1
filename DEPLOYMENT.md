# Just Beauty Deployment

## URLs

- Public site: `https://just-beauty.be`
- Public API base: `https://just-beauty.be/api`
- Mollie webhook: `https://just-beauty.be/api/payments/mollie/webhook`
- Backend process port: `3105`

## Backend env

Set or verify these values in `backend/.env`:

- `PORT=3105`
- `HOST=0.0.0.0`
- `PUBLIC_BASE_URL=https://just-beauty.be`
- `API_PUBLIC_BASE_URL=https://just-beauty.be`
- `CORS_ORIGIN=https://just-beauty.be,https://www.just-beauty.be`
- `SMTP_*` configured with the production mailbox
- `CALDAV_*` configured with the production calendar
- `GOOGLE_CALENDAR_*` configured when Google Calendar must close days automatically

## Google Calendar: fermer automatiquement les journées occupées

Cette intégration lit uniquement les disponibilités du calendrier : les visiteurs ne reçoivent jamais l'accès à Google ni le détail des événements. Dès qu'un événement est présent, même court, la journée entière est retirée des réservations. Le contrôle est refait lors de l'envoi de la réservation.

1. Dans Google Cloud Console, créez un projet puis un **compte de service** et générez une clé JSON.
2. Activez l'API **Google Calendar API** pour ce projet.
3. Dans Google Calendar, partagez le calendrier de l'admin avec l'adresse e-mail du compte de service, avec le droit **Afficher tous les détails des événements** (le droit "Voir uniquement libre/occupé" peut aussi suffire selon la configuration Google).
4. Relevez l'ID du calendrier dans ses paramètres (souvent l'adresse Gmail pour le calendrier principal), puis ajoutez ces valeurs à `backend/.env` :

```env
GOOGLE_CALENDAR_ID=adresse-ou-id-du-calendrier@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=nom-du-compte@votre-projet.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_TIMEZONE=Europe/Brussels
GOOGLE_CALENDAR_FAIL_CLOSED=true
GOOGLE_OAUTH_CLIENT_ID=votre-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=votre-client-secret
# Doit être identique à l'URI de redirection déclarée dans Google Cloud.
GOOGLE_OAUTH_REDIRECT_URI=https://just-beauty.be/api/admin/google-calendar/oauth/callback
```

`GOOGLE_CALENDAR_FAIL_CLOSED=true` est recommandé : si Google est indisponible, la journée ne peut pas être réservée par erreur. Pour la connexion directe, créez aussi dans Google Cloud des identifiants OAuth de type **Application Web**, activez Google Calendar API et ajoutez exactement l'URL `GOOGLE_OAUTH_REDIRECT_URI` dans les URI de redirection autorisées. Après redémarrage, l'admin clique sur « Connecter Google Calendar » dans Administration → Calendrier. Les jetons de reconnexion sont chiffrés côté serveur ; les événements réels ne sont affichés qu'après cette connexion.

## Paiements Mollie

Les paiements Mollie et les acomptes en ligne sont désactivés dans l'application. Les nouvelles réservations sont créées sans redirection de paiement. Retirez également les clés `MOLLIE_API_KEY` du fichier `backend/.env` si elles y figurent encore.

## Reverse Proxy

The frontend build is served as static files. The backend stays private on port `3105` and receives `/api` and `/uploads` through the public domain.

Example Nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name just-beauty.be www.just-beauty.be;

    root /var/www/justbeauty/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3105/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3105/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## PM2

From `backend/`:

```bash
npm install
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Frontend Build

From `frontend/`:

```bash
npm install
npm run build
```

Deploy the generated files from `frontend/dist` to the web root used by the reverse proxy.

## Mollie

Required on the Mollie side:

1. Complete the Mollie profile for `just-beauty.be`.
2. Activate at least one payment method on that profile.
3. Use a valid test or live API key in admin or in `backend/.env`.
4. Make sure `https://just-beauty.be/api/payments/mollie/webhook` is reachable from the public Internet over `https`.

This project already creates payments with a webhook and then re-reads the payment status server-side.

## Production Checks

Run these checks after deployment:

1. Open `https://just-beauty.be`.
2. Verify `https://just-beauty.be/api/health` responds.
3. Verify a client can browse the site and open the booking flow.
4. Upload one gallery image from admin and confirm it loads from `/uploads/...`.
5. Run the Mollie connection test from admin.
6. Create one test booking with deposit and confirm the Mollie redirect opens.
7. Confirm booking emails are sent.
8. Confirm a confirmed booking appears in the CalDAV calendar.

## Recommended Hardening

- Change the default admin password if it is still present.
- Keep `backend/.env` outside any public web root.
- Restrict server firewall access so only the reverse proxy exposes the site, not the raw backend port.
