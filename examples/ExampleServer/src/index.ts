import {
  EP2Key, ExpressOnlineServer
} from '@ep2/online-server'
import { ExpressOfflineServer } from '@ep2/offline-server'

import express from 'express'

import http from 'http'
import cors from 'cors'

import TEST_VALUES from '../../example-config.json'

import TEST_VAPID_KEYS from '../vapidKeys.test.json'

const PORT = TEST_VALUES.testConfig.server.port

const app = express()

app.get('/', (_req: Request, res: any) => res.send(`
Encrypted Peers² <br>  
  <a href='.${TEST_VALUES.testConfig.server.SEC_PEER_CTX}'/>online-service</a> 
  <a href='.${TEST_VALUES.testConfig.server.SEC_PUSH_CTX}'/>offline-service</a> 
`))

const server = http.createServer(app)

// we use both secure - push and peerserver with the same key, but they can use their own.
EP2Key.create(TEST_VALUES.testConfig.server.seed).then((key) => {

  app.use(cors())
  const offlineServer = ExpressOfflineServer(key, { keys: TEST_VAPID_KEYS, subject: TEST_VALUES.testConfig.vapid.subject }, server, { path: TEST_VALUES.testConfig.server.SEC_PUSH_CTX })

  app.use(offlineServer)

  const onlineServer = ExpressOnlineServer(
    key,
    server,
    {
      key: 'securepeerjs',
      path: TEST_VALUES.testConfig.server.SEC_PEER_CTX,
      allow_discovery: true,
      proxied: false
    })

  app.use(onlineServer)

  onlineServer.on('error', (e) => { console.error(e) })
  server.listen(PORT, () => {
    console.info('🛡️ ep2 example server started with public key:', key.peerId, `at: http://localhost:${PORT.toString()}`)
  })
}).catch(console.error)

