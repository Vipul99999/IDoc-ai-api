$ErrorActionPreference = "Stop"

$sample = @"
Resume

Experienced software engineer with skills in React, Next.js, OCR, search, document processing, and cloud APIs.
Education: B.Tech Computer Science.
Experience: Built document intelligence reports, searchable PDFs, and enterprise dashboards.
"@

New-Item -ItemType Directory -Force -Path ".\data\samples" | Out-Null
Set-Content -Path ".\data\samples\sample-resume.txt" -Value $sample
Write-Host "Created .\data\samples\sample-resume.txt"
