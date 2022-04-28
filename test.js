import { Client } from './index.js'
import * as util from 'node:util'
import * as fs from 'node:fs'
import * as os from 'node:os'

const logPath = new URL('./lol.log', import.meta.url)

function log (...args) {
  const str = util.format(...args) + os.EOL
  fs.appendFileSync(logPath, str, 'utf8')
  console.log(...args)
}

class LeagueClient extends Client {
  constructor (options) {
    super(options)

    // this.currentSummoner = undefined
    this.champions = new Map()

    this.on('connect', this.onConnect.bind(this))
    this.on('disconnect', this.onDisconnect.bind(this))
  }

  async onConnect () {
    try {
      await this.tryConnectWebSocket()
    } catch (_) {
      return this.onConnect()
    }
    log('connect')
    log(this.args)
    this.ws.on('/lol-gameflow/v1/gameflow-phase', this.onGameFlowPhase.bind(this))
    this.ws.on('/lol-champ-select/v1/session', this.onChampSelect.bind(this))
    // this.currentSummoner = await this.getCurrentSummoner()
  }

  onDisconnect () {
    // this.currentSummoner = undefined
    this.champions.clear()
    log('disconnect')
  }

  onGameFlowPhase (msg) {
    log(`gameflow-phase: ${msg.eventType} ${msg.data}`)
    if (msg.data === 'ReadyCheck') {
      this.acceptMatch()
    }
  }

  async onChampSelect (msg) {
    if (msg.eventType !== 'Update') return
    if (this.champions.size === 0) {
      const ownedChampions = await this.getAllGridChampions()
      console.log(ownedChampions.length)
      for (const champ of ownedChampions) {
        this.champions.set(champ.name, champ)
      }
    }
    for (const actions of msg.data.actions) {
      for (const action of actions) {
        if (action.actorCellId === msg.data.localPlayerCellId && action.isInProgress) {
          const katalina = this.champions.get('不祥之刃')
          const xiaochou = this.champions.get('恶魔小丑')
          log(action)
          if (action.type === 'pick') {
            // 卡特
            if (action.championId !== katalina.id) {
              this.pickChampion(action.id, katalina.id).catch(err => {
                console.error(err.response.body)
              })
            }
            return
          }
          if (action.type === 'vote') {
            // 卡特
            if (action.championId !== katalina.id) {
              this.voteChampion(action.id, katalina.id).catch(err => {
                console.error(err.response.body)
              })
            }
            return
          }
          if (action.type === 'ban') {
            // 小丑
            this.banChampion(action.id, xiaochou.id).catch(err => {
              console.error(err.response.body)
            })
            return
          }
        }
      }
    }
  }

  getCurrentSummoner () {
    return this.app.get('lol-summoner/v1/current-summoner').json()
  }

  getOwnedChampionsMinimal () {
    return this.app.get('lol-champions/v1/owned-champions-minimal').json()
  }

  getAllGridChampions () {
    return this.app.get('lol-champ-select/v1/all-grid-champions').json()
  }

  acceptMatch () {
    return this.app.post('lol-matchmaking/v1/ready-check/accept', {
      http2: true
    })
  }
  
  pickChampion (actionId, championId) {
    return this.app.patch(`lol-champ-select/v1/session/actions/${actionId}`, {
      json: {
        completed: true,
        type: 'pick',
        championId: championId
      }
    })
  }
  
  voteChampion (actionId, championId) {
    return this.app.patch(`lol-champ-select/v1/session/actions/${actionId}`, {
      json: {
        completed: true,
        type: 'vote',
        championId: championId
      }
    })
  }
  
  banChampion (actionId, championId) {
    return this.app.patch(`lol-champ-select/v1/session/actions/${actionId}`, {
      json: {
        completed: true,
        type: 'ban',
        championId: championId
      }
    })
  }
}

new LeagueClient({
  ca: fs.readFileSync(new URL('./riotgames.pem', import.meta.url), 'utf8')
})
