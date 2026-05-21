import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env vars. Check .env.local (dev) or Netlify env vars (prod).");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Keep the session saved in localStorage so it survives reloads and
    // restarts. (This is the default, but we set it explicitly.)
    persistSession: true,
    // Automatically refresh the access token in the background so the
    // session stays valid for a long time without re-logging-in.
    autoRefreshToken: true,
    // When the magic-link redirect lands back on the site, the auth tokens
    // arrive in the URL. This tells the client to detect those tokens,
    // establish the session, and clean the URL. Essential for magic links.
    detectSessionInUrl: true,
    // Magic links use the implicit flow (tokens in the URL fragment),
    // which is the correct flow for this kind of client-only app.
    flowType: "implicit",
  },
});
