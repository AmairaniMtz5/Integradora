import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://wzfhosbyokruukbaboct.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nX0cP_UAdreoVmHCGScZQw_QtuP1UjQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
