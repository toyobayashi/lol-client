const got = require('got').default
const Agent = require('https').Agent
// const { execFileSync } = require('child_process')
const { EventEmitter } = require('events')
const WebSocket = require('ws')
const {
  getProcessCommandLine,
  isProcessRunning
} = require('./dist/process.node')

const defaultUxName = 'LeagueClientUx.exe'

/* class ClientNotFoundError extends Error {
  constructor (message) {
    super(message)
  }
}
Object.defineProperty(ClientNotFoundError.prototype, 'name', {
  configurable: true,
  value: 'ClientNotFoundError'
}) */

function getLeagueClientArgs (name = defaultUxName) {
  // const stdoutString = execFileSync('WMIC.exe', ['PROCESS', 'WHERE', `name='${name}'`, 'GET', 'CommandLine'], {
  //   stdio: ['pipe', 'pipe', 'ignore']
  // }).toString()
  // if (!stdoutString.includes('CommandLine')) {
  //   throw new ClientNotFoundError(`process named '${name}' is not found`)
  // }
  const stdoutString = getProcessCommandLine(name)
  return {
    appName: stdoutString.match(/--app-name=([\w\d_-]+)/)[1],
    appPort: Number(stdoutString.match(/--app-port=([0-9]+)/)[1]),
    appPid: Number(stdoutString.match(/--app-pid=([0-9]+)/)[1]),
    remotingAuthToken: stdoutString.match(/--remoting-auth-token=([\w-_]+)/)[1],
    riotClientAppPort: Number(stdoutString.match(/--riotclient-app-port=([0-9]+)/)[1]),
    riotClientAuthToken: stdoutString.match(/--riotclient-auth-token=([\w-_]+)/)[1],
    uxHelperName: stdoutString.match(/--ux-helper-name=([\w\d_-]+)/)[1],
    uxName: stdoutString.match(/--ux-name=([\w\d_-]+)/)[1]
  }
}

function pollLeagueClientUx (name, interval) {
  let args
  return new Promise(function executor (resolve, reject) {
    try {
      args = getLeagueClientArgs(name)
    } catch (_) {
      setTimeout(executor, interval, resolve, reject)
      return
    }
    resolve(args)
  })
}

function isRunning (pid) {
  // try {
  //   return process.kill(pid, 0)
  // } catch (err) {
  //   return err.code === 'EPERM'
  // }
  return isProcessRunning(pid)
}

class LeagueWebSocket extends WebSocket {
  constructor (address, options) {
    super(address, options)

    this.once('open', () => {
      this.send(JSON.stringify([5, 'OnJsonApiEvent']))
    })

    this.on('message', (content) => {
      try {
        const json = JSON.parse(content)
        const res = json[2]
        console.log(res)

        this.emit(res.uri, res)
      } catch (_) {}
    })
  }
}

class Client extends EventEmitter {
  constructor (options) {
    super()
    this.args = undefined
    this.riot = undefined
    this.app = undefined
    this._ws = undefined
    this.name = (options && options.name) || defaultUxName
    this.interval = (options && options.interval) || 1000
    this.ca = (options && options.ca) || undefined

    this._waitLaunch()
  }

  get ok () {
    return this.args !== undefined
  }

  get ws () {
    return this._ws
  }

  tryConnectWebSocket () {
    return new Promise((resolve, reject) => {
      if (this._ws) {
        return resolve(this._ws)
      }
      if (this.args === undefined) {
        return reject(new Error('Client is not connected'))
      }
      const ws = new LeagueWebSocket(`wss://riot:${this.args.remotingAuthToken}@127.0.0.1:${this.args.appPort}`, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`riot:${this.args.remotingAuthToken}`).toString('base64')
        },
        agent: this._getAgent()
      })
      ws.once('open', () => {
        if (this._ws) {
          try {
            this._ws.close()
          } catch (_) {}
        }
        this._ws = ws
        resolve(ws)
      })

      ws.once('error', reject)
    })
  }

  _getAgent () {
    return this.ca
      ? new Agent({
          ca: this.ca
        })
      : new Agent({
          rejectUnauthorized: false
        })
  }

  async _waitLaunch () {
    this.args = await pollLeagueClientUx(this.name, this.interval)
    this.riot = got.extend({
      prefixUrl: `https://127.0.0.1:${this.args.riotClientAppPort}`,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`riot:${this.args.riotClientAuthToken}`).toString('base64')
      },
      agent: { https: this._getAgent() }
    })
    this.app = got.extend({
      prefixUrl: `https://127.0.0.1:${this.args.appPort}`,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`riot:${this.args.remotingAuthToken}`).toString('base64')
      },
      agent: { https: this._getAgent() }
    })

    this.emit('connect')
    setTimeout(() => {
      this._tick()
    }, this.interval)
  }

  _tick () {
    if (this.args !== undefined) {
      if (isRunning(this.args.appPid)) {
        setTimeout(() => {
          this._tick()
        }, this.interval)
      } else {
        this.args = undefined
        this.riot = undefined
        this.app = undefined
        try {
          this._ws.close()
        } catch (_) {}
        this._ws = undefined
        this.emit('disconnect')
        this._tick()
      }
    } else {
      this._waitLaunch()
    }
  }
}

exports.Client = Client
