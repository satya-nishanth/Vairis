# Staging-only: grant adi@thevairis.com admin + finance access.
# Does NOT touch rg-vairis-prod or kv-vairis-prod.
$ErrorActionPreference = 'Stop'
$env:Path = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin;" + $env:Path

$email = 'adi@thevairis.com'
$sub = '8e5d9bef-4f27-4b6f-96ed-e0619da29f13'
$rg = 'rg-vairis-staging'
$app = 'vairis-app-staging'
$vault = 'kv-vairis-staging'

az account set --subscription $sub

Write-Host "Reading current admin-emails from $vault ..."
$currentAdmin = az keyvault secret show --vault-name $vault --name admin-emails --query value -o tsv
Write-Host "Current ADMIN_EMAILS: $currentAdmin"

$adminList = ($currentAdmin -split ',' | ForEach-Object { $_.Trim().ToLowerCase() } | Where-Object { $_ })
if ($adminList -notcontains $email.ToLower()) {
  $adminList += $email.ToLower()
}
$newAdmin = ($adminList | Select-Object -Unique) -join ','
if ($newAdmin -ne $currentAdmin) {
  az keyvault secret set --vault-name $vault --name admin-emails --value $newAdmin | Out-Null
  Write-Host "Updated admin-emails -> $newAdmin"
} else {
  Write-Host "admin-emails already includes $email"
}

Write-Host "Reading container app env ..."
$envJson = az containerapp show -n $app -g $rg --query "properties.template.containers[0].env" -o json | ConvertFrom-Json
$financeVar = $envJson | Where-Object { $_.name -eq 'FINANCE_EMAILS' }
$currentFinance = if ($financeVar) { $financeVar.value } else { '' }
Write-Host "Current FINANCE_EMAILS: $(if ($currentFinance) { $currentFinance } else { '(not set)' })"

$financeList = @()
if ($currentFinance) {
  $financeList = ($currentFinance -split ',' | ForEach-Object { $_.Trim().ToLowerCase() } | Where-Object { $_ })
}
if ($financeList -notcontains $email.ToLower()) {
  $financeList += $email.ToLower()
}
$newFinance = ($financeList | Select-Object -Unique) -join ','

if (-not $financeVar) {
  az containerapp update -n $app -g $rg --set-env-vars "FINANCE_EMAILS=$newFinance" | Out-Null
  Write-Host "Added FINANCE_EMAILS -> $newFinance"
} elseif ($newFinance -ne $currentFinance) {
  az containerapp update -n $app -g $rg --replace-env-vars "FINANCE_EMAILS=$newFinance" | Out-Null
  Write-Host "Updated FINANCE_EMAILS -> $newFinance"
} else {
  Write-Host "FINANCE_EMAILS already includes $email"
}

Write-Host "Done. Staging app may take ~30s to pick up new revision/env."
