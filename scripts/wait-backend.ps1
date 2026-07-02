param(
    [Parameter(Mandatory = $true)]
    [int]$Port
)

$ErrorActionPreference = "Stop"
$url = "http://127.0.0.1:$Port/api/health"
$response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
if ($response.StatusCode -ne 200) { exit 1 }
$body = $response.Content | ConvertFrom-Json
if ($body.status -ne "ok") { exit 1 }
if ($body.features -notcontains "day-items") { exit 1 }
if ($body.features -notcontains "deleted-records") { exit 1 }
exit 0
