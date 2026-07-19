/* ── Emondt Materiaalapp — supabase.js ──
 * Verbinding met Supabase (database + inloggen).
 * De 'anon key' hoort openbaar te zijn; beveiliging loopt via de
 * toegangsregels (Row Level Security) in de database zelf.
 */

const SUPABASE_URL      = 'https://tjypxqquiseejzcwfgwm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqeXB4cXF1aXNlZWp6Y3dmZ3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MjkxOTksImV4cCI6MjEwMDAwNTE5OX0.Hfae7Ax6-FlhtYLJspLR2_RsFetWqwu_UDU8Jj0cDI0';

// window.supabase komt van de CDN-bibliotheek (zie index.html)
window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // ingelogd blijven na sluiten
    autoRefreshToken: true,    // sessie automatisch verversen
    storageKey: 'emondt_supabase_auth',
  },
});
