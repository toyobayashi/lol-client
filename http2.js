const http2 = require('http2-wrapper')

class Http2Client {
  constructor (options) {
    this.options = options
  }

  _request (method, url, data) {
    return new Promise(async (resolve, reject) => {
      const contentLength = data ? (() => {
        if (Buffer.isBuffer(data)) {
          return data.length
        }
        if (typeof data === 'string') {
          return Buffer.from(data).length
        }
        if (typeof data === 'object') {
          try {
            return Buffer.from(JSON.stringify(data)).length
          } catch (_) {
            return 0
          }
        }
        return 0
      })() : 0

      const headers = {
        'user-agent': 'Node.js http2-wrapper',
        'content-length': contentLength
      }
      if (typeof data === 'object' && data !== null) {
        headers['content-type'] = 'application/json'
      }

      const u = this.options.prefixUrl ? (this.options.prefixUrl + '/' + url) : url

      const req = await http2.auto(u, {
        ca: this.options.ca, /* fs.readFileSync('localhost-cert.pem') */
        rejectUnauthorized: this.options.ca ? true : false,
        method,
        headers: {
          ...headers,
          ...(this.options.headers || {})
        }
      }, (response) => {
        const body = []
        response.on('data', chunk => {
          body.push(chunk)
        })
        response.on('end', () => {
          const rawBody = Buffer.concat(body)
          const bod = rawBody.toString()
          const jsonBody = (() => {
            try {
              return JSON.parse(bod)
            } catch (_) {
              return bod
            }
          })()
          const res = {
            headers: response.headers,
            statusCode: response.statusCode,
            rawBody,
            body: jsonBody
          }
          if (response.statusCode >= 400) {
            reject(res)
          } else {
            resolve(res)
          }
        })
      })

      req.on('error', reject)
      if (data) {
        if (typeof data === 'string' || Buffer.isBuffer(data)) {
          req.write(data)
        } else if (typeof data === 'object') {
          req.write(JSON.stringify(data))
        }
      }
      req.end()
    })
  }

  post (url, data) {
    return this._request('POST', url, data)
  }
}

exports.Http2Client = Http2Client
