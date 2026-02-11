import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wgzwcsspdxrlvmicodru.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnendjc3NwZHhybHZtaWNvZHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDE0OTAsImV4cCI6MjA4NjI3NzQ5MH0.aljB3baCatSW2w-WAwf-cTdD_Na5eqI4zdygXMx1VmE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

