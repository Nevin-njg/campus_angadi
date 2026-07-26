const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '')
const metricsToken = process.env.METRICS_TOKEN ?? ''

async function check(path, expectedStatus = 200, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, { headers })
  const body = await response.text()
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}: ${body.slice(0, 300)}`)
  }
  console.log(`OK ${response.status} ${path}`)
  return body
}

await check('/health')
await check('/ready')
if (metricsToken) {
  const metrics = await check('/metrics', 200, { Authorization: `Bearer ${metricsToken}` })
  if (!metrics.includes('campusbaza_process_uptime_seconds')) {
    throw new Error('Metrics response did not contain Campus Angadi process metrics')
  }
}
console.log('Campus Angadi API smoke checks passed.')
