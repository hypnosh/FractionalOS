// External Supabase project (user-provided). Anon key is publishable.
import { createClient } from "@supabase/supabase-js";
import type { Db } from "./db-types";

const SUPABASE_URL = "https://mqqsltwseyklrjkzhlsa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcXNsdHdzZXlrbHJqa3pobHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTIxNDEsImV4cCI6MjA5Nzg2ODE0MX0.uA-GLPwnvLwjRKKLJ7BrCHVQTz0LyohvTTdgWfxEx9w";

export const supabase = createClient<Db>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "sb-mqqsltwseyklrjkzhlsa-auth-token",
  },
});
