const { Client } = require('./index.js')
const http2wrapper = require('http2-wrapper')

const http2options = {
  http2: true,
  request: http2wrapper.auto
}

const client = new Client()
client.on('connect', async () => {
  console.log('connect')
  console.log(client.args)
  const currentSummoner = await client.app.get('lol-summoner/v1/current-summoner').json()
  console.log(currentSummoner)

  client.tryConnectWebSocket().then(() => {
    console.log('ws connected')
    client.ws.on('/lol-gameflow/v1/gameflow-phase', (msg) => {
      if (msg.data === 'ReadyCheck') {
        console.log('ReadyCheck')
        client.app.post('lol-matchmaking/v1/ready-check/accept', http2options).json().then((res) => {
          console.log(res)
        })
      }
    })
  })
})

client.on('disconnect', () => {
  console.log('disconnect')
})
