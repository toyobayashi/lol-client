const { Client } = require('./index.js')

const client = new Client()
client.on('connect', async () => {
  console.log('connect')
  console.log(client.args)
  const currentSummoner = await client.app.get('lol-summoner/v1/current-summoner').json()
  console.log(currentSummoner)
})

client.on('disconnect', () => {
  console.log('disconnect')
})
