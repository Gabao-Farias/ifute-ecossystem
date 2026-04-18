# Expoe as portas do WSL para a rede local (rodar como Administrador)
# Uso: clique direito > "Executar com PowerShell como administrador"
#   ou: powershell -ExecutionPolicy Bypass -File wsl-expose-ports.ps1

$ports = @(7100, 7101, 7102, 7103)
$wslIp = (wsl hostname -I).Trim().Split(" ")[0]

if (-not $wslIp) {
    Write-Host "Erro: nao foi possivel obter o IP do WSL. Verifique se o WSL esta rodando." -ForegroundColor Red
    exit 1
}

Write-Host "IP do WSL: $wslIp" -ForegroundColor Cyan

# Remove regras antigas e adiciona novas
foreach ($port in $ports) {
    netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null
    netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp
    Write-Host "Porta $port -> ${wslIp}:$port" -ForegroundColor Green
}

# Firewall - remove regra antiga e cria nova
$ruleName = "iFute WSL Ports"
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort ($ports -join ",") | Out-Null
Write-Host "Regra de firewall '$ruleName' criada para portas: $($ports -join ', ')" -ForegroundColor Green

Write-Host ""
Write-Host "Pronto! Portas expostas para a rede local." -ForegroundColor Cyan
Write-Host "Para verificar: netsh interface portproxy show v4tov4" -ForegroundColor Gray

# Mostra resultado
netsh interface portproxy show v4tov4
