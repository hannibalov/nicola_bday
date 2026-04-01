import { createClient } from "@supabase/supabase-js";

/** Use service role key to bypass RLS for session state writes (server-side only). */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

export const supabase = createClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_SECRET_KEY || "dummy");
