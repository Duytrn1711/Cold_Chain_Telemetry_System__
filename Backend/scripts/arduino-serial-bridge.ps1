param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^COM\d+$')]
    [string]$PortName,

    [ValidateRange(300, 2000000)]
    [int]$BaudRate = 9600,

    [double]$TemperatureOffset = -20,

    [string]$ApiUrl = 'https://cold-chain-telemetry-system-1.onrender.com/api/integrations/arduino/telemetry',

    [string]$DeviceToken = $env:ARDUINO_DEVICE_TOKEN
)

$ErrorActionPreference = 'Stop'
$apiToken = $env:ARDUINO_INGEST_TOKEN
if ([string]::IsNullOrWhiteSpace($apiToken)) {
    $secureToken = Read-Host 'Enter ARDUINO_INGEST_TOKEN' -AsSecureString
    $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    try {
        $apiToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    }
    if ([string]::IsNullOrWhiteSpace($apiToken)) { throw 'Arduino API token cannot be empty.' }
}

$serial = [System.IO.Ports.SerialPort]::new($PortName, $BaudRate, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$serial.NewLine = "`n"
$serial.ReadTimeout = 1000
$serial.DtrEnable = $false
$serial.RtsEnable = $false

try {
    $serial.Open()
    Write-Host "Arduino USB bridge connected to $PortName at $BaudRate baud. Press Ctrl+C to stop."

    while ($true) {
        try {
            $line = $serial.ReadLine().Trim()
        } catch [System.TimeoutException] {
            continue
        }
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        try {
            $packet = $line | ConvertFrom-Json
            if ($packet -isnot [pscustomobject]) { throw 'Expected a JSON object.' }
            $temperatureProperty = $packet.PSObject.Properties['temperature']
            if (-not $temperatureProperty) { $temperatureProperty = $packet.PSObject.Properties['temp'] }
            if (-not $temperatureProperty) { throw 'Missing temperature.' }

            $rawTemperature = [double]$temperatureProperty.Value
            $temperature = [Math]::Round($rawTemperature + $TemperatureOffset, 2)
            if ($temperature -lt -100 -or $temperature -gt 100) { throw 'Corrected temperature is outside the accepted -100..100°C range.' }
            $humidityProperty = $packet.PSObject.Properties['humidity']
            $humidity = if ($humidityProperty -and $null -ne $humidityProperty.Value) { [double]$humidityProperty.Value } else { 0 }
            $body = @{ temperature = $temperature; humidity = $humidity }
            if (-not [string]::IsNullOrWhiteSpace($DeviceToken)) { $body.device_token = $DeviceToken }

            $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers @{ 'x-arduino-token' = $apiToken } `
                -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 10
            if (-not $response.success) { throw 'Cold Chain did not accept the telemetry packet.' }
            Write-Host ("Stored telemetry: {0} °C (raw {1} °C, offset {2} °C), {3}% RH" -f $temperature, $rawTemperature, $TemperatureOffset, $humidity)
        } catch {
            Write-Warning 'Skipped one serial line or failed to submit one packet. Check the Arduino JSON output and Cold Chain API settings.'
        }
    }
} finally {
    if ($serial.IsOpen) { $serial.Close() }
    $serial.Dispose()
}
