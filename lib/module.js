const http = require('http')
const Prometheus = require('prom-client')
const defaults = require('./defaults')

console.log("GSS: module start")

function requestDuration () {
  return new Prometheus.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500]
  })
}

function defaultMetrics (collectDefault) {
  const metricsInterval = Prometheus.collectDefaultMetrics(
    typeof collectDefault === 'object' ? collectDefault : {}
  )
  process.on('SIGTERM', () => {
    clearInterval(metricsInterval)
  })
}

module.exports = function PrometheusModule (moduleOptions) {
  console.log("GSS: module.exports")
  const options = {
    ...defaults,
    ...this.options['nuxt-prometheus-module'],
    ...moduleOptions
  }
  const { metrics, path, host, port } = options
  if (metrics && metrics.collectDefault) {
    console.log("GSS: metrics && metrics.collectDefault")
    defaultMetrics(metrics.collectDefault)
  }

  if (metrics && metrics.requestDuration) {
    console.log("GSS: metrics && metrics.requestDuration")
    const httpRequestDurationMicroseconds = requestDuration()
    this.addServerMiddleware((req, res, next) => {
      const startEpoch = Date.now()
      res.once('finish', () => {
        const responseTimeInMs = Date.now() - startEpoch
        httpRequestDurationMicroseconds
          .labels(req.method, req.originalUrl, res.statusCode)
          .observe(responseTimeInMs)
      })
      next()
    })
  }
  console.log("GSS: Register hook.")
  this.nuxt.hook('listen', () => {
    http
      .createServer((req, res) => {
        console.log("GSS: Create server")
        if (req.url === path) {
         console.log("GSS: req.url === path")
          res.writeHead(200, {
            'Content-Type': Prometheus.register.contentType
          })
          res.end(await Prometheus.register.metrics())
        } else {
         console.log("GSS: else of req.url === path")
          res.writeHead(404, {
            'Content-Type': 'text/html'
          })
          res.end('Metrics available in <code>/metrics</code>')
        }
      })
      .listen(port, host)
  })
}
