param([int]$Limit = 100, [string]$Verticals = "")
# Draft driver: pick image-ready idea rows (image-first write queue), draft each with Kimi, ingest into DB.
$ErrorActionPreference = 'Continue'
$kimi = "C:\Users\filip\AppData\Roaming\Python\Python313\Scripts\kimi.exe"
$root = "C:\DEV\sovetydoma"
Set-Location $root
$utf8 = New-Object System.Text.UTF8Encoding($false)
$template = Get-Content "$root\.matrix-ideas\draft-template.txt" -Raw -Encoding UTF8
New-Item -ItemType Directory -Force "$root\.matrix-ideas\drafts" | Out-Null
New-Item -ItemType Directory -Force "$root\.matrix-ideas\draftprompts" | Out-Null

$vArg = if ($Verticals) { "--verticals $Verticals" } else { "" }
$rowsJson = & node scripts/matrix/pick.mjs --queue write --limit $Limit $vArg.Split(' ')
$rows = $rowsJson | ConvertFrom-Json
Write-Host "Picked $($rows.Count) image-ready rows to draft."
$done = 0
foreach ($row in $rows) {
  $wc = if ($row.frontmatter.target_wc) { $row.frontmatter.target_wc } else { 800 }
  $prompt = $template.Replace('__TITLE__', "$($row.title)").Replace('__DESCRIPTION__', "$($row.description)").Replace('__CATEGORY__', "$($row.category)").Replace('__WC__', "$wc")
  $pf = ".matrix-ideas/draftprompts/$($row.slug).txt"
  [System.IO.File]::WriteAllText("$root\$($pf -replace '/','\')", $prompt, $utf8)
  $df = ".matrix-ideas/drafts/$($row.slug).md"
  $instr = "Read the file $pf in this workspace and follow its instructions exactly to write a full Russian article. Write ONLY the resulting Markdown article body (no frontmatter, no commentary) to the file $df using your file-write tool. Do not run git or explore the repo. When finished print exactly: DONE"
  Write-Host "[draft] $($row.slug)"
  try { $instr | & $kimi --quiet --input-format text --no-thinking | Out-Null } catch { Write-Host "  kimi error: $_" }
  if (Test-Path "$root\$($df -replace '/','\')") {
    & node scripts/matrix/ingest-draft.mjs --id $row.id --file $df 2>&1 | Select-Object -Last 1 | ForEach-Object { Write-Host "  $_" }
    $done++
  } else { Write-Host "  no draft file produced" }
}
Write-Host "Drafts done: $done / $($rows.Count)"
