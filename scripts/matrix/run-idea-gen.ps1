param([int]$Target = 5000, [int]$Passes = 5, [int]$Count = 60)
# Idea-gen driver: loop taxonomy subtopics, generate ideas with Kimi, load with dedup, until $Target idea rows.
# Kimi gets a pure-ASCII stdin instruction to READ a UTF-8 prompt file and WRITE a JSON file (avoids stdin Cyrillic corruption).
$ErrorActionPreference = 'Continue'
$kimi = "C:\Users\filip\AppData\Roaming\Python\Python313\Scripts\kimi.exe"
$root = "C:\DEV\sovetydoma"
Set-Location $root
$utf8 = New-Object System.Text.UTF8Encoding($false)
$template = Get-Content "$root\.matrix-ideas\prompt-template.txt" -Raw -Encoding UTF8
$lines = Get-Content "$root\.matrix-ideas\taxonomy.txt" -Encoding UTF8 | Where-Object { $_ -match '\S' }

function Get-IdeaCount {
  try { return [int](& node scripts/matrix/count-ideas.mjs) } catch { return -1 }
}

$start = Get-IdeaCount
Write-Host "START idea rows: $start ; target $Target"
for ($pass = 1; $pass -le $Passes; $pass++) {
  $i = 0
  foreach ($line in $lines) {
    $i++
    $parts = $line.Split('|')
    if ($parts.Count -lt 3) { continue }
    $vertical = $parts[0].Trim(); $category = $parts[1].Trim(); $subtopic = $parts[2].Trim()
    $prompt = $template.Replace('__SUBTOPIC__', $subtopic).Replace('__CATEGORY__', $category).Replace('__VERTICAL__', $vertical).Replace('__COUNT__', "$Count")
    $rel = ".matrix-ideas/prompts/$vertical-p$pass-$i.txt"
    $of  = ".matrix-ideas/out/$vertical-p$pass-$i.json"
    [System.IO.File]::WriteAllText("$root\$($rel -replace '/','\')", $prompt, $utf8)
    $instr = "Read the file $rel in this workspace and follow its instructions exactly. Write ONLY the resulting JSON array (valid JSON, no markdown, no commentary) to the file $of using your file-write tool. Do not run git, do not explore the repo, do not run other commands. When finished print exactly: DONE"
    Write-Host "[pass $pass / item $i] $vertical :: $subtopic"
    try { $instr | & $kimi --quiet --input-format text --no-thinking | Out-Null } catch { Write-Host "  kimi error: $_" }
    if (Test-Path "$root\$($of -replace '/','\')") {
      & node scripts/matrix/insert-ideas.mjs $of 2>&1 | Select-Object -Last 1 | ForEach-Object { Write-Host "  $_" }
    } else { Write-Host "  no output file produced" }
    $cnt = Get-IdeaCount
    Write-Host "  >> idea rows now: $cnt"
    if ($cnt -ge $Target) { Write-Host "TARGET $Target REACHED"; exit 0 }
  }
}
Write-Host "All passes done. Final idea rows: $(Get-IdeaCount)"
