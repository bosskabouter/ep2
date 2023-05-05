import axios from 'axios'
import EventEmitter from 'eventemitter3'

import {
  type AsymmetricallyEncryptedMessage,
  EP2Key,
  type EncryptedHandshake,
  type SymmetricallyEncryptedMessage
} from '@ep2/key'
import { registerSW } from './swutil'

/**
 * The body of a push request from EP2Push to EP2PushServer contains a JSON.toString(ep2PushRequest)
 */
export interface EP2PushRequest {
  encryptedPushMessages: AsymmetricallyEncryptedMessage<EP2PushMessage[]>
  handshake: EncryptedHandshake
  senderId: string
}

/**
* A PushMessage
*/
export interface EP2PushMessage {
  encryptedEndpoint: SymmetricallyEncryptedMessage<PushSubscription>
  encryptedPayload: SymmetricallyEncryptedMessage<NotificationOptions>
}

export interface EP2PushConfig {
  host: string
  path: string
  publicKey: string
  vapidKey: string
}

export interface EP2PushEvents {
  receivedMessage: (payload: any, senderId: string) => void
}

/**
 * Client cLass with initialization for the given server config and client key. Enables pushing (and receiving) of encrypted messages through the push server.
 */
export class EP2Push extends EventEmitter<EP2PushEvents> {
  /**
   * Encode the pushSubscription symmetrically with the server public key so it is safe to share with other contacts. Only the server can get your subscription data.
   */
  readonly sharedSubscription: SymmetricallyEncryptedMessage<PushSubscription>
  /**
   * URL to EP2PushServer
   */
  private readonly postURI

  /**
   * @param pushSubscription
   * @param key
   * @param config
   * @see EP2Push.register
   */
  constructor (
    private readonly pushSubscription: PushSubscription,
    private readonly key: EP2Key,
    private readonly config: EP2PushConfig
  ) {
    super()
    registerSW()
    this.postURI = `${config.host}${config.path}/`
    this.sharedSubscription = EP2Key.encrypt(
      this.config.publicKey,
      this.pushSubscription
    )
  }

  /**
   * Gets the service worker and asks for a push subscription.
   * @param secureKey
   * @param serverConfig
   * @returns
   */
  static async register (
    secureKey: EP2Key,
    serverConfig: EP2PushConfig
  ): Promise<EP2Push | undefined> {
    const serviceWorkerRegistration: ServiceWorkerRegistration | undefined =
      await navigator.serviceWorker?.getRegistration()

    if (serviceWorkerRegistration !== undefined) {
      const subs = await serviceWorkerRegistration.pushManager.subscribe({
        applicationServerKey: serverConfig.vapidKey,
        userVisibleOnly: true
      })
      if (subs !== undefined) {
        updateEP2ServiceWorker(secureKey)
        return new this(subs, secureKey, serverConfig)
      }
    }
    return undefined
  }

  /**
   *
   * @param msg
   * @param peerId
   * @param shareSubscription
   * @returns
   */
  async pushText (
    msg: NotificationOptions,
    peerId: string,
    shareSubscription: SymmetricallyEncryptedMessage<PushSubscription>
  ): Promise<boolean> {
    const spm: EP2PushMessage = {
      encryptedEndpoint: shareSubscription,
      encryptedPayload: EP2Key.encrypt(peerId, msg)
    }
    return await this.pushMessages([spm])
  }

  async pushMessages (ep2PushMessages: EP2PushMessage[]): Promise<boolean> {
    const { secureChannel, handshake } = this.key.initiateHandshake(
      this.config.publicKey
    )
    const encryptedPushMessages = secureChannel.encrypt(ep2PushMessages)
    const webPushRequest: EP2PushRequest = {
      handshake,
      encryptedPushMessages,
      senderId: this.key.peerId
    }

    const response = await axios.post(this.postURI, webPushRequest)

    return (
      response !== undefined && response !== null && response.status === 200
    )
  }
}

/**
 * Updates the service worker with the new key. Push messages received will be decrypted using this new key.
 * @param key
 */
export function updateEP2ServiceWorker (key: EP2Key): void {
  navigator.serviceWorker.controller?.postMessage({
    type: 'UPDATE_KEY',
    key: key.toJSON()
  })
}
