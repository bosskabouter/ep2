import React, { useEffect, useState } from 'react'
import { EP2Key, OfflineClient, type PushServerConfig, registerSW } from '@ep2/offline-client'

import TEST_VAPID_KEYS from '../../ExampleServer/vapidKeys.test.json'
import TEST_VALUES from '../../example-config.json'

registerSW()

const serverConfig: PushServerConfig = {
  host: 'http://localhost:'.concat(TEST_VALUES.testConfig.server.port.toString()),
  path: TEST_VALUES.testConfig.server.SEC_PUSH_CTX,
  publicKey: TEST_VALUES.testConfig.server.publicKey,
  vapidKey: TEST_VAPID_KEYS.publicKey
}
export default function WebPush (): JSX.Element {
  const [secureKey, setSecureKey] = useState<EP2Key>()
  const [offlineClient, setOfflineClient] = useState<OfflineClient | null>()
  const [pushResult, setPushResult] = useState<boolean>()

  const [counter, setCounter] = useState(0)
  useEffect(() => {
    (async () => {
      if (offlineClient !== undefined) return
      const secureKey = await EP2Key.create()
      setSecureKey(secureKey)
      setOfflineClient(await OfflineClient.register(secureKey, serverConfig))
    })().catch(console.error)
  }, [])

  return (
    <div>
      <div>Key: {secureKey?.peerId}</div>
      <div>OfflineClient: {offlineClient?.sharedSubscription?.toString()}</div>
      <div>Push result: {pushResult?.toString()}</div>
      <button onClick={ () => { postMessage().catch(console.error) }}>Push yourself</button>
    </div>
  )

  async function postMessage (): Promise<void> {
    setCounter(counter + 1)
    secureKey !== undefined && setPushResult(
      await pushSecureMessage('Hi again: ' + counter.toString(), secureKey.peerId))
  }

  async function pushSecureMessage (payload: string, peerId: string): Promise<boolean | undefined> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/return-await
    return await offlineClient?.pushText({ body: payload, vibrate: [2000, 100, 200, 1000] } as NotificationOptions, peerId, offlineClient.sharedSubscription)
  }
}
