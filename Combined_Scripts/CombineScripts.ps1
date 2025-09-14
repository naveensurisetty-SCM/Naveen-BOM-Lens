# --- CONFIGURATION ---
$csvPath         = ".\FileNames.csv"
$destinationFile = ".\CombinedScripts_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').txt" # <-- THIS LINE IS MODIFIED
$columnName      = "RelativePath"

# --- SCRIPT LOGIC ---
$basePath = $PSScriptRoot

Write-Host "Script is running from: $basePath"
Write-Host "Combining files listed in '$csvPath' into '$destinationFile'..."

# Start with a clean slate by clearing the output file
# This is no longer strictly necessary with unique filenames, but it's good practice.
Clear-Content -Path $destinationFile -ErrorAction SilentlyContinue

# Read the list of files from the CSV
$fileList = Import-Csv -Path $csvPath

# Loop through each file in the list
foreach ($row in $fileList) {
    $relativePath = $row.$columnName
    $sourceFile = Join-Path -Path $basePath -ChildPath $relativePath

    if (Test-Path $sourceFile) {
        $fileNameHeader = "--- START OF FILE: $relativePath ---"
        Add-Content -Path $destinationFile -Value $fileNameHeader
        Get-Content $sourceFile | Add-Content -Path $destinationFile
        Add-Content -Path $destinationFile -Value "`n--- END OF FILE: $relativePath ---`n`n"
        Write-Host "  [SUCCESS] Copied: $relativePath"
    }
    else {
        Write-Host "  [WARNING] File not found, skipping: $sourceFile"
    }
}

Write-Host "`n✅ All done! Your combined file is ready at: $destinationFile"