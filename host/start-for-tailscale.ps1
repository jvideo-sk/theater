# Start the host API for the GitHub Pages frontend over private Tailscale HTTPS.
# Run this script from the host folder. It keeps the Node server bound to localhost;
# use `tailscale serve 3000` in a second terminal to make it available within your tailnet.

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Backstage Technician Desk - private host API setup' -ForegroundColor Cyan
Write-Host 'Use the GitHub Pages ORIGIN only, without the repository path.'
Write-Host 'Example: https://your-user.github.io'
Write-Host ''

$origin = (Read-Host 'GitHub Pages origin').Trim().TrimEnd('/')
try { $parsedOrigin = [Uri]$origin } catch { throw 'That origin is not a valid URL.' }
if ($parsedOrigin.Scheme -ne 'https' -or $parsedOrigin.AbsolutePath -ne '/' -or $parsedOrigin.Query -or $parsedOrigin.Fragment) {
    throw 'Enter only an HTTPS origin, e.g. https://your-user.github.io (no repository path).'
}

$securePassword = Read-Host 'Choose a shared theatre password (12+ characters)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
if ($password.Length -lt 12) { throw 'The password must be at least 12 characters.' }

$env:HOST = '127.0.0.1'
$env:PORT = '3000'
$env:THEATRE_PASSWORD = $password
$env:THEATRE_ALLOWED_ORIGINS = $origin

Write-Host ''
Write-Host "Allowed website origin: $origin" -ForegroundColor Green
Write-Host 'Host-only data directory: .\data' -ForegroundColor Green
Write-Host 'Keep this window running while the app is in use.' -ForegroundColor Yellow
Write-Host 'In a second PowerShell window, run: tailscale serve 3000' -ForegroundColor Yellow
Write-Host ''
node server.js
