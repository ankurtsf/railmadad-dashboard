import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://dtqouxywfcrvyxhdrixs.supabase.co'
const supabaseAnonKey = 'sb_publishable_QeARs1L2Tj8Tw63EOzJ0zw_nuOVqDio'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
