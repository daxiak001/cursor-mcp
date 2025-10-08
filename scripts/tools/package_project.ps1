# package_project.ps1
$ts = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$zip = "deliverable_$ts.zip"
Compress-Archive -Path * -DestinationPath $zip -Force
Write-Host "打包完成: $zip"
