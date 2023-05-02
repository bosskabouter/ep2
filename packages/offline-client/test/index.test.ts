import axios from 'axios'
import { EP2Key, type SecurePushMessage, type PushServerConfig, OfflineClient } from '../src'

jest.mock('axios')


describe('OfflineClient API', () => {
  test('Push yourself', async () => {
    const key = await EP2Key.create()
    const offlineClient = await OfflineClient.register(key,
      {
        path: "/push",
        publicKey: "",
        vapidKey: "YOUR VAPID PUB KEY",
        host: "ep2.push.host"
      })
    offlineClient?.pushText({ body: "Knock knock. Who is there?", vibrate: [2000, 1000, 2000, 1000, 3000] }, key.peerId, offlineClient.sharedSubscription)

    

  })


})



describe('OfflineClient', () => {
  const mockPush: PushSubscription = JSON.parse(JSON.stringify({
    endpoint: 'https://example.com/push/1234',
    expirationTime: null,
    keys: {
      p256dh: 'P256DH_PUBLIC_KEY',
      auth: 'AUTH_SECRET_KEY'
    }
  }))
  let serverKey: EP2Key
  let pusherKey: EP2Key
  let pushedKey: EP2Key
  let message: SecurePushMessage

  const notificationOptions: NotificationOptions = {}

  let serverConfig: PushServerConfig

  beforeAll(async () => {
    serverKey = await EP2Key.create()
    serverConfig = { publicKey: serverKey.peerId, host: 'testHost', path: 'testPath', vapidKey: 'testVapidKey' }
    pusherKey = await EP2Key.create()
    pushedKey = await EP2Key.create()
    message = {
      encryptedEndpoint: EP2Key.encrypt(serverConfig.publicKey, mockPush),
      encryptedPayload: EP2Key.encrypt(pushedKey.peerId, notificationOptions)
    }
  })
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('pushMessage', () => {
    test('should return true when axios post succeeds', async () => {
      (axios.post as jest.Mock).mockImplementationOnce(async () => await Promise.resolve({ status: 200 }))

      const offlineClient = new OfflineClient(mockPush, pusherKey, serverConfig)
      const result = await offlineClient.pushMessages([message])
      expect(result).toBe(true)
    })

    test('should throw an error when axios post fails', async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce(new Error('testError'))
      const offlineClient = new OfflineClient(mockPush, pusherKey, serverConfig)
      await expect(offlineClient.pushMessages([])).rejects.toThrow('testError')
      expect(axios.post).toHaveBeenCalled()
      expect(axios.post).toHaveReturned()
    })
  })

  describe('getSharedSubscription', () => {
    test('should return the encrypted pushSubscription', () => {
      const offlineClient = new OfflineClient(mockPush, pusherKey, serverConfig)
      expect(offlineClient.sharedSubscription).toBeDefined()
    })
  })
})
