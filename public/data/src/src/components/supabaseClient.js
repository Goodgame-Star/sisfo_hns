import { createClient } from '@supabase/supabase-js';

// Ambil dari Dashboard Supabase lu
const supabaseUrl = 'https://hptfudqtrnyeqcqhhaeh.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdGZ1ZHF0cm55ZXFjcWhoYWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMDEwODAsImV4cCI6MjA4Mzc3NzA4MH0.z6_4osc9GZfpZcUUyj51t4dGP3MUjq8No-hH8p9mB9U'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);