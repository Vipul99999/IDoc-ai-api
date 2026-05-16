# Google OAuth2 and Cost-Aware Processing

## Google OAuth2

The web app supports Google OAuth2 login with PKCE and server-side state validation.

Required environment variables:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
APP_BASE_URL=http://localhost:3000
```

Optional hardening:

```env
GOOGLE_ALLOWED_DOMAINS=example.edu,company.com
GOOGLE_DEFAULT_ROLE=analyst
```

Flow:

1. User clicks **Continue with Google**.
2. `/api/auth/google/start` creates a state cookie, PKCE verifier, and redirects to Google.
3. `/api/auth/google/callback` validates state, exchanges the code, loads the verified Google profile, upserts the user, signs a JWT session, and redirects back to the app.
4. The frontend stores the returned token and uses normal RBAC-protected API calls.

## Cost-Aware Processing

The backend now records a processing policy for each analysis run:

- `low-cost`: strong native extraction or budget-constrained jobs avoid visual OCR and paid AI fallback.
- `balanced`: runs visual OCR where it improves quality.
- `accuracy-first`: favors OCR and fallback services for urgent or explicitly configured high-accuracy processing.

Exact duplicate documents reuse a trusted completed analysis by checksum. This skips repeated OCR, classification, embedding, extraction, and validation work while preserving audit evidence in the new document.

Useful environment flags:

```env
PROCESSING_COST_PROFILE=low-cost
DISABLE_ANALYSIS_CACHE=false
```
