# ICMPSR Knowledge Library

Independent scientific knowledge library for ICMPSR platforms.

## Application
- `knowledge-library.html` — browser-based knowledge library interface.
- `supabase/functions/drive-public-import/` — authenticated import of public Google Drive files.
- `supabase/functions/knowledge-ask/` — grounded Q&A over indexed knowledge passages.

## Deployment
Configure GitHub Pages from **Settings → Pages → Deploy from a branch → main → /(root)** after the application files are committed.

## Security
Never commit Supabase service-role keys, Gemini API keys, Google OAuth client secrets, or other private credentials. Configure private values as Supabase Edge Function secrets.

## Notes
The Supabase database schema and deployed Edge Functions are managed separately from GitHub Pages. Google Drive folder import and Gemini Q&A require their respective OAuth and server-side secret configuration.
