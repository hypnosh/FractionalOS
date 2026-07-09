import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://mqqsltwseyklrjkzhlsa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcXNsdHdzZXlrbHJqa3pobHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTIxNDEsImV4cCI6MjA5Nzg2ODE0MX0.uA-GLPwnvLwjRKKLJ7BrCHVQTz0LyohvTTdgWfxEx9w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
