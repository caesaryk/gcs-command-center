$path = $PSScriptRoot
$port = 8080
$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
    Write-Host "Server running at http://localhost:$port/"
    Write-Host "Press Ctrl+C to stop"
} catch {
    Write-Host "Failed to start server on port $port"
    exit
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestUrl = $context.Request.Url.LocalPath
    if ($requestUrl -eq "/") { $requestUrl = "/login.html" }
    $localFilePath = Join-Path $path $requestUrl
    if (Test-Path $localFilePath -PathType Leaf) {
        $buffer = [System.IO.File]::ReadAllBytes($localFilePath)
        $context.Response.ContentLength64 = $buffer.Length
        if ($localFilePath -match "\.css$") { $context.Response.ContentType = "text/css" }
        elseif ($localFilePath -match "\.js$") { $context.Response.ContentType = "application/javascript" }
        else { $context.Response.ContentType = "text/html" }
        $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
    } else {
        $context.Response.StatusCode = 404
    }
    $context.Response.OutputStream.Close()
}
