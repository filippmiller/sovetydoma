param([int]$Target = 100, [int]$Batch = 15, [int]$MaxPasses = 60)
# Image loop: keep generating images (Grok) for idea rows until $Target newly-generated images exist.
$ErrorActionPreference = 'Continue'
$root = "C:\DEV\sovetydoma"
Set-Location $root
function Gen-Count {
  try {
    $n = & node -e "import('./scripts/matrix/lib.mjs').then(async m=>{const sb=m.default.getServiceClient();const{count}=await sb.from('content_matrix').select('*',{count:'exact',head:true}).eq('domain','1001sovet.ru').eq('image_status','generated').neq('image_source','legacy-seed');process.stdout.write(String(count))})"
    return [int]$n
  } catch { return -1 }
}
$pass = 0
while ($pass -lt $MaxPasses) {
  $pass++
  $before = Gen-Count
  if ($before -ge $Target) { Write-Host "TARGET $Target generated images reached ($before)"; break }
  Write-Host "[img pass $pass] generated so far: $before ; running batch of $Batch"
  & node scripts/matrix/gen-images.mjs --limit $Batch 2>&1 | Select-String -Pattern "Picked|OK|FAILED|Done" | ForEach-Object { Write-Host "  $_" }
  $after = Gen-Count
  if ($after -le $before) {
    Write-Host "  no progress this pass (no idea rows ready yet); waiting 90s for idea-gen..."
    Start-Sleep -Seconds 90
  }
}
Write-Host "Image loop done. Generated images: $(Gen-Count)"
