# Google Sign-In setup for Campus Angadi

The API and web app must use the same Google OAuth 2.0 **Web application** client ID.

## Local environment

Add these values to the root `.env` file:

```env
ALLOWED_EMAIL_DOMAINS=gmail.com,nitc.ac.in
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_HOSTED_DOMAINS=
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

For local Google OAuth configuration, add this authorized JavaScript origin:

```text
http://localhost:5173
```

No redirect URI is required for the popup/callback button flow used by this project.

## Production environment

Add the deployed frontend origin to the Google OAuth Web Client, for example:

```text
https://your-campus-angadi.vercel.app
```

Set this on Render/API:

```env
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
ALLOWED_EMAIL_DOMAINS=gmail.com,nitc.ac.in
GOOGLE_HOSTED_DOMAINS=
```

Set this on Vercel/web:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
VITE_API_URL=https://campus-angadi-api.onrender.com/api/v1
```

For separate Vercel and Render sites, keep refresh cookies configured as:

```env
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

The login endpoint receives the Google ID token, verifies it on the API, provisions or retrieves the existing Campus Angadi user, and then creates the normal Campus Angadi JWT/refresh-cookie session.
