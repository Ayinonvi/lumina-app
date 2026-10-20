import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables Supabase manquantes. Vérifiez votre fichier .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type User = {
  id: string;
  email: string;
};
