# Abre o .docx no Word, atualiza sumario e listas (campos TOC), salva e exporta PDF.
# Uso (Windows/WSL): powershell.exe -ExecutionPolicy Bypass -File atualizar_campos.ps1 <docx> [pdf]
param([string]$Docx, [string]$Pdf)
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open((Resolve-Path $Docx).Path)
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  $doc.Save()
  if ($Pdf) { $doc.ExportAsFixedFormat((Join-Path (Get-Location) $Pdf), 17) }
  Write-Output ("paginas: " + $doc.ComputeStatistics(2))
  $doc.Close()
} finally { $word.Quit() }
