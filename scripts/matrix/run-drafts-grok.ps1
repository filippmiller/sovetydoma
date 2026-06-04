param([int]$Target = 100, [int]$Batch = 10, [int]$MaxPasses = 80)
# Draft loop (Grok): keep drafting image-ready rows until $Target total drafts exist.
$ErrorActionPreference = 'Continue'
$root = "C:\DEV\sovetydoma"
Set-Location $root
function Draft-Count {
  try { return [int](& node -e "import('./scripts/matrix/lib.mjs').then(async m=>{const sb=m.default.getServiceClient();const{count}=await sb.from('content_matrix').select('*',{count:'exact',head:true}).eq('domain','1001sovet.ru').eq('text_status','draft');process.stdout.write(String(count))})") } catch { return -1 }
}
$pass = 0
while ($pass -lt $MaxPasses) {
  $pass++
  $before = Draft-Count
  if ($before -ge $Target) { Write-Host "TARGET $Target drafts reached ($before)"; break }
  Write-Host "[draft pass $pass] drafts so far: $before ; batch $Batch"
  & node scripts/matrix/gen-drafts-grok.mjs --limit $Batch 2>&1 | Select-String -Pattern "Picked|OK|FAILED|too short|Done" | ForEach-Object { Write-Host "  $_" }
  $after = Draft-Count
  if ($after -le $before) {
    Write-Host "  no progress (no image-ready idea rows yet); waiting 120s..."
    Start-Sleep -Seconds 120
  }
}
Write-Host "Draft loop done. Drafts: $(Draft-Count)"
