param(
[string]$kill
)

#(Get-Process RetailClient).count

$Password = convertto-securestring -asplaintext -force -string "n?aojnC3E9D"
$Credential = new-object -typename system.management.automation.pscredential -argumentlist "Administrator", $Password
$ClientIps = "10.0.0.82", "10.0.0.87", "10.0.0.88", "10.0.0.89", "10.0.0.90"
$ServerIps = "10.0.0.11", "10.0.0.12", "10.0.0.13", "10.0.0.14", "10.0.0.15"
$Sessions = @()

# Killing all existing processes.
Foreach ($ClientIp in $ClientIps) {

	Write-Host "Closing previous sessions on ${ClientIp}..."
    $Session = Get-PSSession -ComputerName $ClientIp | Remove-PSSession
	
	Write-Host "Killing RetailDemo on ${ClientIp}..."
	$Session = new-pssession -computername $ClientIp -credential $Credential
	invoke-command -session $Session -scriptblock { $Output = Invoke-Expression "taskkill /IM RetailClient.exe 2>&1" }
	remove-pssession -session $Session

	# Copying the retail demo to each client.
	Copy-Item "c:\Users\Administrator\Downloads\RetailDemo\RetailClient.exe" "\\${ClientIp}\RetailDemo\RetailClient.exe"
}

if ($kill) { Exit }

# Processing each server.
Foreach ($ServerIp in $ServerIps) {

	# Processing each client.
	Foreach($ClientIp in $ClientIps) {

		# Creating new session for each client.
		$Session = new-pssession -computername $ClientIp -credential $Credential
		$Sessions += $Session
		
		Write-Host "Starting jobs on client " $ClientIp "..."

		invoke-command -session $Session -scriptblock {
		
			$ServerIp = $Args[0]
			
			#Start-Job -ScriptBlock {
			
				$ServerIp = $Args[0]
				$ServerPorts = "3000", "3001", "3002", "3003", "3004", "3005", "3006", "3007"
				#$ServerIps = "10.0.0.55"
				#$ServerPorts = "8080"
				
				# Starting retail demo on each port.
				Foreach ($ServerPort in $ServerPorts) {
			
					Write-Host "Client <=> server ${ServerIp}:${ServerPort}..."
					
					Start-Process "c:\Users\Administrator\Downloads\RetailDemo\RetailClient.exe" "-NumWorkers=1 -ServerIp=${ServerIp} -ServerPort=${ServerPort}"
				}
				
			#} -Args $ServerIp
			
		} -Args $ServerIp
		
		Start-Sleep -m 100
	}
}

Start-Sleep -s 1000

# Waiting for all jobs.
Get-Job | Wait-Job
	
# Killing the sessions.
Foreach ($Session in $Sessions) {
	remove-pssession -session $Session
}