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

function getCurrentSummoner (client) {
  return client.app.get('lol-summoner/v1/current-summoner').json()
}

function getOwnedChampionsMinimal (client) {
  return client.app.get('lol-champions/v1/owned-champions-minimal').json()
}

function acceptMatch (client) {
  return client.app.post('lol-matchmaking/v1/ready-check/accept', {
    http2: true
  })
}

function pickChampion (client, actionId, championId) {
  return client.app.patch(`lol-champ-select/v1/session/actions/${actionId}`, {
    json: {
      completed: true,
      type: 'pick',
      championId: championId
    }
  })
}

function voteChampion (client, actionId, championId) {
  return client.app.patch(`lol-champ-select/v1/session/actions/${actionId}`, {
    json: {
      completed: true,
      type: 'vote',
      championId: championId
    }
  })
}

function banChampion (client, actionId, championId) {
  return client.app.patch(`lol-champ-select/v1/session/actions/${actionId}`, {
    json: {
      completed: true,
      type: 'ban',
      championId: championId
    }
  })
}

const client = new Client({
  ca: fs.readFileSync(new URL('./riotgames.pem', import.meta.url), 'utf8')
})
client.on('connect', async () => {
  log('connect')
  log(client.args)
  const currentSummoner = await getCurrentSummoner(client)
  log(currentSummoner)
  // const ownedChampions = await getOwnedChampionsMinimal(client)
  // log(ownedChampions)

  client.tryConnectWebSocket().then(() => {
    log('ws connected')
    client.ws.on('/lol-gameflow/v1/gameflow-phase', (msg) => {
      log(`gameflow-phase: ${msg.eventType} ${msg.data}`)
      if (msg.data === 'ReadyCheck') {
        acceptMatch(client)
      }
    })
    client.ws.on('/lol-champ-select/v1/session', (msg) => {
      for (const actions of msg.data.actions) {
        for (const action of actions) {
          if (action.actorCellId === msg.data.localPlayerCellId && action.isInProgress) {
            log(action.type)
            if (action.type === 'pick') {
              // 卡特
              pickChampion(client, action.id, 55).catch(err => {
                console.error(err)
              })
              return
            }
            if (action.type === 'vote') {
              // 卡特
              voteChampion(client, action.id, 55).catch(err => {
                console.error(err)
              })
              return
            }
            if (action.type === 'ban') {
              // 小丑
              banChampion(client, action.id, 35).catch(err => {
                console.error(err)
              })
              return
            }
          }
        }
      }
    })
  })
})

client.on('disconnect', () => {
  log('disconnect')
})
