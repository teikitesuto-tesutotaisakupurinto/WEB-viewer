import { createClient }
from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL =
  "https://wcddlfjtkrbpperhrxkk.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_GZA4t1Q-c51iM-9HndtZhA_xvnB-Icu";

export const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
