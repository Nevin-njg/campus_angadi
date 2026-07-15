import type { NextFunction, Request, RequestHandler, Response } from 'express'

const latencyBuckets = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5] as const

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')
}

function normalizePath(request: Request): string {
  const route: unknown = request.route
  const routePath =
    typeof route === 'object' && route !== null
      ? (route as Record<string, unknown>)['path']
      : undefined
  if (typeof routePath === 'string') return `${request.baseUrl}${routePath}` || '/'
  if (Array.isArray(routePath)) return `${request.baseUrl}${routePath.join('|')}` || '/'
  return request.path.startsWith('/api/v1') ? '/api/v1/unmatched' : '/unmatched'
}

interface RouteMetric {
  count: number
  errorCount: number
  latencySumSeconds: number
  buckets: number[]
}

export interface CleanupMetricResult {
  staleUploads: number
  readNotifications: number
  revokedSessions: number
  auditLogs: number
  expiredListings: number
  durationMs: number
  success: boolean
}

export class MetricsRegistry {
  private readonly startedAt = Date.now()
  private readonly routes = new Map<string, RouteMetric>()
  private cleanupRuns = 0
  private cleanupFailures = 0
  private cleanupLastRunTimestamp = 0
  private cleanupLastDurationSeconds = 0
  private cleanupLastDeleted = 0

  middleware(): RequestHandler {
    return (request: Request, response: Response, next: NextFunction) => {
      const started = process.hrtime.bigint()
      response.once('finish', () => {
        const durationSeconds = Number(process.hrtime.bigint() - started) / 1_000_000_000
        this.observeRequest(
          request.method,
          normalizePath(request),
          response.statusCode,
          durationSeconds,
        )
      })
      next()
    }
  }

  observeCleanup(result: CleanupMetricResult): void {
    this.cleanupRuns += 1
    if (!result.success) this.cleanupFailures += 1
    this.cleanupLastRunTimestamp = Date.now() / 1000
    this.cleanupLastDurationSeconds = result.durationMs / 1000
    this.cleanupLastDeleted =
      result.staleUploads +
      result.readNotifications +
      result.revokedSessions +
      result.auditLogs +
      result.expiredListings
  }

  render(): string {
    const lines: string[] = [
      '# HELP campusbaza_process_uptime_seconds Process uptime in seconds.',
      '# TYPE campusbaza_process_uptime_seconds gauge',
      `campusbaza_process_uptime_seconds ${(Date.now() - this.startedAt) / 1000}`,
      '# HELP campusbaza_process_resident_memory_bytes Resident memory size.',
      '# TYPE campusbaza_process_resident_memory_bytes gauge',
      `campusbaza_process_resident_memory_bytes ${process.memoryUsage().rss}`,
      '# HELP campusbaza_http_requests_total Total HTTP responses.',
      '# TYPE campusbaza_http_requests_total counter',
      '# HELP campusbaza_http_request_errors_total HTTP responses with status 500 or greater.',
      '# TYPE campusbaza_http_request_errors_total counter',
      '# HELP campusbaza_http_request_duration_seconds Request duration histogram.',
      '# TYPE campusbaza_http_request_duration_seconds histogram',
    ]

    for (const [key, metric] of [...this.routes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const [method, path, status] = key.split('|') as [string, string, string]
      const labels = `method="${escapeLabel(method)}",path="${escapeLabel(path)}",status="${escapeLabel(status)}"`
      lines.push(`campusbaza_http_requests_total{${labels}} ${metric.count}`)
      lines.push(`campusbaza_http_request_errors_total{${labels}} ${metric.errorCount}`)
      latencyBuckets.forEach((bucket, index) => {
        lines.push(
          `campusbaza_http_request_duration_seconds_bucket{${labels},le="${bucket}"} ${metric.buckets[index]}`,
        )
      })
      lines.push(
        `campusbaza_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${metric.count}`,
      )
      lines.push(
        `campusbaza_http_request_duration_seconds_sum{${labels}} ${metric.latencySumSeconds}`,
      )
      lines.push(`campusbaza_http_request_duration_seconds_count{${labels}} ${metric.count}`)
    }

    lines.push(
      '# HELP campusbaza_cleanup_runs_total Cleanup job executions.',
      '# TYPE campusbaza_cleanup_runs_total counter',
      `campusbaza_cleanup_runs_total ${this.cleanupRuns}`,
      '# HELP campusbaza_cleanup_failures_total Failed cleanup job executions.',
      '# TYPE campusbaza_cleanup_failures_total counter',
      `campusbaza_cleanup_failures_total ${this.cleanupFailures}`,
      '# HELP campusbaza_cleanup_last_run_timestamp_seconds Last cleanup execution timestamp.',
      '# TYPE campusbaza_cleanup_last_run_timestamp_seconds gauge',
      `campusbaza_cleanup_last_run_timestamp_seconds ${this.cleanupLastRunTimestamp}`,
      '# HELP campusbaza_cleanup_last_duration_seconds Last cleanup duration.',
      '# TYPE campusbaza_cleanup_last_duration_seconds gauge',
      `campusbaza_cleanup_last_duration_seconds ${this.cleanupLastDurationSeconds}`,
      '# HELP campusbaza_cleanup_last_affected_records Last cleanup affected record count.',
      '# TYPE campusbaza_cleanup_last_affected_records gauge',
      `campusbaza_cleanup_last_affected_records ${this.cleanupLastDeleted}`,
    )
    return `${lines.join('\n')}\n`
  }

  private observeRequest(
    method: string,
    path: string,
    status: number,
    durationSeconds: number,
  ): void {
    const key = `${method}|${path}|${status}`
    const metric = this.routes.get(key) ?? {
      count: 0,
      errorCount: 0,
      latencySumSeconds: 0,
      buckets: latencyBuckets.map(() => 0),
    }
    metric.count += 1
    if (status >= 500) metric.errorCount += 1
    metric.latencySumSeconds += durationSeconds
    latencyBuckets.forEach((bucket, index) => {
      if (durationSeconds <= bucket) metric.buckets[index] = (metric.buckets[index] ?? 0) + 1
    })
    this.routes.set(key, metric)
  }
}
