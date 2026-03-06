# PowerShell script to set DATABASE_URL in Vercel
# Run: .\set-db-env.ps1

$password = Read-Host "Enter your Supabase database password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

# Construct connection string with proper escaping
$connectionString = "postgresql://postgres:${plainPassword}@db.ornismpzpohhpgnfgymt.supabase.co:5432/postgres?sslmode=require"

Write-Host "Setting DATABASE_URL in Vercel..."
npx vercel env add DATABASE_URL production "$connectionString"

# Clean up
$plainPassword = $null
