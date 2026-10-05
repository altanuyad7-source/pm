# Server scripts

start.ps1/stop.ps1 support Windows PowerShell; start.sh/stop.sh support macOS/Linux through sh. Scripts resolve the project directory from their own location and use Docker Compose. Start rebuilds and waits for health; stop preserves volumes. Require Docker with Compose and a running engine. Never add volume deletion to normal shutdown.
