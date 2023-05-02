import axios from 'axios'
import EventEmitter from 'eventemitter3'

import { EP2Key, type AsymmetricallyEncryptedMessage, type EncryptedHandshake, type SymmetricallyEncryptedMessage } from '@ep2/key'

export * from '@ep2/key'

/**
 *A
 */
export interface WebPushRequest {
  encryptedPushMessages: AsymmetricallyEncryptedMessage<SecurePushMessage[]>
  handshake: EncryptedHandshake
  senderId: string
}

export interface SecurePushMessage {
  encryptedEndpoint: SymmetricallyEncryptedMessage<PushSubscription>
  encryptedPayload: SymmetricallyEncryptedMessage<NotificationOptions>
}

export interface PushServerConfig {
  host: string
  path: string
  publicKey: string
  vapidKey: string
}

export interface OfflineClientEvents {
  receivedMessage: (payload: any, senderId: string) => void
}
/**
 * Client cLass with initialization for the given server config and client key. Enables pushing (and receiving) of encrypted messages through the push server.
 */
export class OfflineClient extends EventEmitter<OfflineClientEvents> {
  /**
   * Encode the pushSubscription symmetrically with the server public key so it is safe to share with other contacts. Only the server can get your subscription data.
   */
  readonly sharedSubscription: SymmetricallyEncryptedMessage<PushSubscription>
  /**
   * URL to SecurePush relay server
   */
  private readonly postURI

  /**
   * Use register to obtain a SecurePusher instance.
   * @param pushSubscription
   * @param key
   * @param serverConfig
   * @see OfflineClient.register
   */
  constructor (private readonly pushSubscription: PushSubscription, private readonly key: EP2Key, private readonly serverConfig: PushServerConfig) {
    super()
    this.postURI = `${serverConfig.host}${serverConfig.path}/push`
    this.sharedSubscription = EP2Key.encrypt(this.serverConfig.publicKey, this.pushSubscription)
  }

  /**
   * Gets the service worker and asks for a push subscription.
   * @param secureKey
   * @param serverConfig
   * @returns
   */
  static async register (secureKey: EP2Key, serverConfig: PushServerConfig): Promise<OfflineClient | undefined> {
    const serviceWorkerRegistration: ServiceWorkerRegistration | undefined = await navigator.serviceWorker?.getRegistration()

    if (serviceWorkerRegistration !== undefined) {
      const subs = await serviceWorkerRegistration.pushManager.subscribe({ applicationServerKey: serverConfig.vapidKey, userVisibleOnly: true })
      if (subs !== undefined) {
        await postCommunicationKey(secureKey)
        return new this(subs, secureKey, serverConfig)
      }
    }
    return undefined
  }

  async pushText (msg: NotificationOptions, peerId: string, shareSubscription: SymmetricallyEncryptedMessage<PushSubscription>): Promise<boolean> {
    const spm: SecurePushMessage = {
      encryptedEndpoint: shareSubscription,
      encryptedPayload: EP2Key.encrypt(peerId, msg)
    }
    return await this.pushMessages([spm])
  }

  async pushMessages (securePushMessages: SecurePushMessage[]): Promise<boolean> {
    const { secureChannel, handshake } = this.key.initiateHandshake(this.serverConfig.publicKey)
    const encryptedPushMessages = secureChannel.encrypt(securePushMessages)
    const webPushRequest: WebPushRequest = { handshake, encryptedPushMessages, senderId: this.key.peerId }
    return await new Promise((resolve, reject) => {
      axios.post(this.postURI, webPushRequest).then(response => { resolve(response.status === 200) }).catch(reject)
    })
  }
}

/**
 * Updates the service worker with the new key. Push messages received will be decrypted using this new key.
 * @param key
 */
async function postCommunicationKey (key: EP2Key): Promise<void> {
  navigator.serviceWorker.controller?.postMessage({ type: 'UPDATE_KEY', key: key.toJSON() })
}

/**
 * Service worker initialization for @ep2/offline-client.
 * 1. Adds a handler for receiving encrypted push messages
 * 2. Adds a handler for Updating the key from front-end with messages handler `event.data.type === 'UPDATE_KEY'`
 * @see postCommunicationKey
 */
export function initSecurePush (sw: ServiceWorkerGlobalScope, customHandleSecurePush?: (notification: NotificationOptions) => void): void {
  let key: EP2Key

  sw.addEventListener('message', handleMessage)
  sw.addEventListener('notificationclick', handleNotificationclick, false)
  sw.addEventListener('push', handlePush)

  function handleMessage (event: ExtendableMessageEvent): void {
    if (event.data.type === 'SKIP_WAITING') {
      // This allows the web app to trigger skipWaiting
      sw.skipWaiting().catch(console.error)
    } else if (event.data.type === 'UPDATE_KEY') {
      key = EP2Key.fromJson(event.data.key)
    }
  }

  function handleNotificationclick (event: NotificationEvent): void {
    event.notification.close()

    event.waitUntil(

      sw.clients.matchAll({ type: 'window' }).then((clientsArr: readonly WindowClient[]) => {
        // console.debug('Open windows: ' + clientsArr)
        // If a Window tab matching the targeted URL already exists, focus that;
        const hadWindowToFocus = clientsArr.some((windowClient: WindowClient) =>
          (windowClient.url.includes(self.location.origin) === true) ? (windowClient.focus(), true) : false
        )
        // Otherwise, open a new tab to the applicable URL and focus it.
        if (!hadWindowToFocus) {
          const dataString: string = event.notification.data.toString()
          sw.clients
            .openWindow(`${self.location.origin}/messages/${dataString}`)
            .then(async (windowClient) => ((windowClient != null) ? windowClient.focus() : null)).catch(console.error)
        }
      })
    )
  }

  function handlePush (pushEvent: PushEvent): void {
    if (key?.peerId === undefined) {
      console.warn('No key yet to handle Secure Push Event')
      return
    }
    const payload: string = pushEvent.data?.text() ?? ''
    if (payload.length === 0) {
      console.warn('No push data available')
      return
    }
    let relayedMessage: SymmetricallyEncryptedMessage<NotificationOptions>
    try {
      relayedMessage = JSON.parse(payload)
    } catch (error) {
      console.warn('Invalid PushRequest', error)
      return
    }

    let options = key.decryptSymmetrically(relayedMessage)

    const actionOpen = {
      title: 'Open',
      action: 'open'
    }
    const actionClose = {
      title: 'Close',
      action: 'close'
    }

    options = {
      ...options,
      vibrate: [1000, 2000, 3000, 4000, 5000],
      actions: [actionOpen, actionClose]
    }

    customHandleSecurePush?.(options)
    sw.registration.showNotification('Pushed', options).catch(console.error)
  }
}

interface PeriodicSyncManager {
  register: (tag: string, options?: { minInterval: number }) => Promise<void>
}

declare global {
  interface ServiceWorkerRegistration {
    readonly periodicSync: PeriodicSyncManager
  }
}

export function registerSW (): void {
  window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller != null) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // window.location.reload()
        })
      }

      void navigator.serviceWorker.ready.then(async (registration) => {
        if ('periodicSync' in registration) {
          const status = await navigator.permissions.query({
            // @ts-expect-error periodic-sync is not included in the default SW interface.
            name: 'periodic-background-sync'
          })

          if (status.state === 'granted') {
            await registration.periodicSync.register('UPDATE_CHECK', {
              minInterval: 24 * 60 * 60 * 1000
            })
          }
        }

        if (window.matchMedia('(display-mode: standalone)').matches) {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'hidden') {
              navigator.serviceWorker.controller?.postMessage('UPDATE_CHECK')
              registration.update().catch(console.error)
            }
          })
        }
      })
    }
  })
}
