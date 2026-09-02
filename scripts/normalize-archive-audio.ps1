[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$FfmpegPath,
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [double]$IntegratedLufs = -18.0,
  [double]$TruePeakDbtp = -1.5,
  [double]$LoudnessRangeLu = 7.0
)

$ErrorActionPreference = "Stop"
$culture = [System.Globalization.CultureInfo]::InvariantCulture
$sourceDirectory = Join-Path $ProjectRoot "public/assets/memories/audio"
$outputDirectory = Join-Path $ProjectRoot "public/assets/memories/audio-normalized"
$reportPath = Join-Path $outputDirectory "loudness-report.json"

if (-not (Test-Path -LiteralPath $FfmpegPath -PathType Leaf)) {
  throw "FFmpeg was not found at: $FfmpegPath"
}

$sourceFiles = Get-ChildItem -LiteralPath $sourceDirectory -Filter "archive-voice-*.mp3" -File |
  Sort-Object Name
if ($sourceFiles.Count -eq 0) {
  throw "No archive voice files were found in: $sourceDirectory"
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

function Format-Decimal([double]$Value) {
  return $Value.ToString("0.###", $culture)
}

function Invoke-LoudnessMeasure([string]$Path) {
  $filter = "loudnorm=I=$(Format-Decimal $IntegratedLufs):TP=$(Format-Decimal $TruePeakDbtp):LRA=$(Format-Decimal $LoudnessRangeLu):print_format=json"
  $output = & $FfmpegPath @(
    "-hide_banner",
    "-nostdin",
    "-i", $Path,
    "-af", $filter,
    "-f", "null",
    "NUL"
  ) 2>&1 | Out-String

  if ($LASTEXITCODE -ne 0) {
    throw "FFmpeg loudness measurement failed for $Path`n$output"
  }

  $matches = [regex]::Matches(
    $output,
    '(?s)\{\s*"input_i"\s*:.*?\}'
  )
  if ($matches.Count -eq 0) {
    throw "FFmpeg did not return loudnorm JSON for: $Path"
  }
  return $matches[$matches.Count - 1].Value | ConvertFrom-Json
}

function Convert-Measurement([object]$Measurement) {
  return [ordered]@{
    integratedLufs = [double]$Measurement.input_i
    truePeakDbtp = [double]$Measurement.input_tp
    loudnessRangeLu = [double]$Measurement.input_lra
    thresholdLufs = [double]$Measurement.input_thresh
    normalizationType = $Measurement.normalization_type
    targetOffsetLu = [double]$Measurement.target_offset
  }
}

$ffmpegVersion = (& $FfmpegPath -version | Select-Object -First 1)
$reportEntries = foreach ($sourceFile in $sourceFiles) {
  $before = Invoke-LoudnessMeasure $sourceFile.FullName
  $outputPath = Join-Path $outputDirectory $sourceFile.Name
  $secondPassFilter = @(
    "loudnorm=I=$(Format-Decimal $IntegratedLufs)"
    "TP=$(Format-Decimal $TruePeakDbtp)"
    "LRA=$(Format-Decimal $LoudnessRangeLu)"
    "measured_I=$($before.input_i)"
    "measured_LRA=$($before.input_lra)"
    "measured_TP=$($before.input_tp)"
    "measured_thresh=$($before.input_thresh)"
    "offset=$($before.target_offset)"
    "linear=true"
    "print_format=json"
  ) -join ":"

  $normalizationOutput = & $FfmpegPath @(
    "-y",
    "-hide_banner",
    "-nostdin",
    "-i", $sourceFile.FullName,
    "-af", $secondPassFilter,
    "-map_metadata", "-1",
    "-vn",
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    "-ar", "48000",
    $outputPath
  ) 2>&1 | Out-String

  if ($LASTEXITCODE -ne 0) {
    throw "FFmpeg normalization failed for $($sourceFile.Name)`n$normalizationOutput"
  }

  $after = Invoke-LoudnessMeasure $outputPath
  [ordered]@{
    source = "audio/$($sourceFile.Name)"
    output = "audio-normalized/$($sourceFile.Name)"
    sourceSha256 = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    outputSha256 = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash.ToLowerInvariant()
    before = Convert-Measurement $before
    after = Convert-Measurement $after
  }
}

$report = [ordered]@{
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  processor = $ffmpegVersion
  target = [ordered]@{
    integratedLufs = $IntegratedLufs
    truePeakDbtp = $TruePeakDbtp
    loudnessRangeLu = $LoudnessRangeLu
  }
  files = @($reportEntries)
}

$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding utf8
$report
