import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://tmfwkaqtssicezuwgzch.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_5e_J1_E9rrZP-RdsY5HATw_4bTPsem2";

let client = null;
if (url && anonKey) {
  try {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" },
    });
  } catch (error) {
    console.error("Supabase configuration is invalid:", error.message);
  }
}

export const supabase = client;

export async function oauthProviderEnabled(provider) {
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings.external?.[provider] === true;
  } catch {
    return false;
  }
}
