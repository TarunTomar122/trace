import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rpjjcrmojstvsnafhdbs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pZNzq3m7Sa5IJ3VgR7RziA_zIMYW0u9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

