$ErrorActionPreference = 'Stop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Install Docker Desktop and start its engine first.'
}
Push-Location (Join-Path $PSScriptRoot '..')
try {
    docker compose up --build --detach --wait
    if ($LASTEXITCODE -ne 0) { throw 'Container startup failed. Run docker compose logs for details.' }
    Write-Host 'Kanban Studio: http://localhost:8000'
} finally { Pop-Location }
