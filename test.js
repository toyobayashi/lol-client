const { Client } = require('./index.js')
const http2wrapper = require('http2-wrapper')
const util = require('util')
const path = require('path')
const fs = require('fs')
const os = require('os')

const http2options = {
  http2: true,
  // request: http2wrapper.auto
}

const logPath = path.join(__dirname, 'lol.log')

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
  return client.app.post('lol-matchmaking/v1/ready-check/accept', http2options)
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

const client = new Client()
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
            if (action.type === 'pick') {
              log('pick')
              pickChampion(client, action.id, 55) // 卡特
              return
            }
            if (action.type === 'vote') {
              log('vote')
              voteChampion(client, action.id, 55) // 卡特
              return
            }
            if (action.type === 'ban') {
              log('ban')
              banChampion(client, action.id, 35) // 小丑
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
