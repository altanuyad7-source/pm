$ErrorActionPreference = 'Stop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop is required.'
}
Push-Location (Join-Path $PSScriptRoot '..')
try {
    docker compose down
    if ($LASTEXITCODE -ne 0) { throw 'Container shutdown failed.' }
} finally { Pop-Location }
