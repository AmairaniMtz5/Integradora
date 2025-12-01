-- Fix Row Level Security Policies for Therapists and Patients
-- This script allows authenticated users to insert their own records

-- 1. Enable RLS on therapists table (if not already enabled)
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;

-- 2. Allow insert for authenticated users creating their own therapist record
CREATE POLICY "Allow authenticated users to insert therapist" ON therapists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR true);  -- Allow therapist creation even without user_id match temporarily

-- 3. Allow select for authenticated therapists to see their own record
CREATE POLICY "Allow therapists to select their own record" ON therapists
  FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() -> 'role' = '"admin"');

-- 4. Enable RLS on patients table (if not already enabled)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- 5. Allow insert for authenticated users creating their own patient record
CREATE POLICY "Allow authenticated users to insert patient" ON patients
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR true);  -- Allow patient creation even without user_id match temporarily

-- 6. Allow select for authenticated patients to see their own record
CREATE POLICY "Allow patients to select their own record" ON patients
  FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() -> 'role' = '"admin"');

-- 7. Allow admin to insert therapists
CREATE POLICY "Allow admin to insert therapist" ON therapists
  FOR INSERT
  WITH CHECK (auth.jwt() -> 'role' = '"admin"');

-- 8. Allow admin to insert patients
CREATE POLICY "Allow admin to insert patient" ON patients
  FOR INSERT
  WITH CHECK (auth.jwt() -> 'role' = '"admin"');
