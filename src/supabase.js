import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
