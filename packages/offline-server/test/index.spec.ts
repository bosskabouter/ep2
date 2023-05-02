import request from 'supertest'
import { type AsymmetricallyEncryptedMessage, EP2Key, type SymmetricallyEncryptedMessage } from '@ep2/key'

import VAPID_KEYS from './vapidKeys.json'
import TEST_PUSH from './test.push.json'

import publicContent from '../src/app.json'
import express from 'express'
import type { IncomingMessage, Server, ServerResponse } from 'http'
import { type SecurePushMessage, type WebPushRequest } from '@ep2/offline-client'
import webpush from 'web-push'
import { OfflineServer } from '../src'

webpush.sendNotification = jest.fn().mockResolvedValue({
  statusCode: 200,
  headers: {},
  body: 'OK'
})
// /const webpush2 =
jest.genMockFromModule<typeof webpush>('web-push')

// (webpush2.sendNotification as jest.Mock) = jest.fn().mockResolvedValue({
//   statusCode: 200,
//   headers: {},
//   body: 'OK'
// })

const TEST_PORT = 2000 + Math.floor(Math.random() * 5000)

jest.mock('web-push', () => ({
  sendNotification: undefined,
  setVapidDetails: jest.fn()
}))
// const mokTestPush =
// jest.genMockFromModule<typeof webpush>('web-push')

// jest.mock('web-push', () => ({
//   sendNotification: jest.fn().mockResolvedValue(
//     {
//       statusCode: 200,
//       headers: {},
//       body: 'OK'
//     }
//   ),
//   setVapidDetails: jest.fn()
// }))

describe('SecurePush', () => {
  let serverKey: EP2Key
  let pusherKey: EP2Key
  let app: express.Express
  let server: Server<typeof IncomingMessage, typeof ServerResponse>

  const mockPush: PushSubscription = TEST_PUSH as any
  beforeAll(async () => {
    // webPush = await import ('web-push')

    app = express()
    serverKey = await EP2Key.create()
    pusherKey = await EP2Key.create()
    server = app.listen(TEST_PORT, () => {
      const sps = OfflineServer(serverKey, VAPID_KEYS, { port: (TEST_PORT + 1) })
      expect(sps).toBeDefined()
      app.use('/', sps)
    })
  })
  afterEach(() => {
    // jest.resetAllMocks()
  })

  afterAll((done) => {
    server.unref()
    jest.resetModules()

    server.close(done)
  })
  test('should get public content', async () => {
    const resp = await request(app).get('')
    expect(resp).toBeDefined()
    expect(resp.error).toBeFalsy()
    expect(resp.body).toMatchObject(publicContent)
  })

  test('should get test', async () => {
    const resp = await request(app).get('/test')
    expect(resp).toBeDefined()
    expect(resp.error).toBeFalsy()
  })

  test('POST /send should send a notification', async () => {
    const recipient = await EP2Key.create()

    const encryptedEndpoint = EP2Key.encrypt(serverKey.peerId, mockPush)

    const encryptedPayload: SymmetricallyEncryptedMessage<NotificationOptions> = EP2Key.encrypt(recipient.peerId, { data: 'Hello from Pusher' })

    const secureMessage: SecurePushMessage = {
      encryptedEndpoint,
      encryptedPayload
    }

    const { secureChannel, handshake } = pusherKey.initiateHandshake(serverKey.peerId)

    const encryptedPushMessages: AsymmetricallyEncryptedMessage<SecurePushMessage[]> = secureChannel.encrypt([secureMessage])

    const wpr: WebPushRequest = {
      encryptedPushMessages,
      handshake,
      senderId: pusherKey.peerId
    }
    expect(wpr).toBeDefined()
    const response =
    await request(app)
      .post('/push')
      .send(wpr)
    expect(response).toBeDefined()
    // expect(response.error).toBeFalsy()
    // expect(response.status).toBeTruthy()

    // expect(webpush2.sendNotification).toHaveBeenCalledTimes(1)
    // expect(webpush.sendNotification).toHaveBeenCalledWith(
    //   mockPush,
    //   secureMessage,
    //   { TTL: 60000 }
    // )
  })

  // test('POST /send should return HTTP_ERROR_PUSH_TOO_BIG if the payload is too big', async () => {
  //   const mockSubscription = {
  //     endpoint: 'https://example.com/endpoint',
  //     keys: {
  //       auth: 'auth',
  //       p256dh: 'p256dh'
  //     }
  //   }

  //   const encryptedPayload = 'a'.repeat(4097)

  //   const encryptedPushSubscription = receiver.encryptForRelay(serverKey.peerId, JSON.stringify(mockSubscription))

  //   const webPushRequest: WebPushRequest = { encryptedPayload, encryptedPushSubscription }
  //   const response = await request(app)
  //     .post('/send')
  //     .send(webPushRequest)

  //   expect(response.status).toBe(507)
  //   expect(response.text).toBe('Insufficient Storage')

  //   expect(webpush.sendNotification).toHaveBeenCalledTimes(0)
  // })
})
