import axios from "axios";
import EventEmitter from "eventemitter3";

import {
  type AsymmetricallyEncryptedMessage,
  EP2Key,
  type EncryptedHandshake,
  type SymmetricallyEncryptedMessage,
} from "@ep2/key";
import { handleSW } from "./swutil";

/**
 * The body of a push request from EP2Push to EP2PushServer contains a JSON.toString(ep2PushRequest)
 */
export interface EP2PushRequest {
  encryptedPushMessages: AsymmetricallyEncryptedMessage<EP2PushMessage[]>;
  handshake: EncryptedHandshake;
  senderId: string;
}

/**
 * A PushMessage
 */
export interface EP2PushMessage {
  encryptedEndpoint: SymmetricallyEncryptedMessage<PushSubscription>;
  encryptedPayload: SymmetricallyEncryptedMessage<NotificationOptions>;
}

export interface EP2PushConfig {
  host: string;
  port: number;
  path: string;
  publicKey: string;
  vapidKey: string;
}

export interface EP2PushEvents {
  receivedMessage: (payload: any, senderId: string) => void;
}

/**
 * Client cLass with initialization for the given server config and client key. Enables pushing (and receiving) of encrypted messages through the push server.
 */
export class EP2Push extends EventEmitter<EP2PushEvents> {
  /**
   * Encode the pushSubscription symmetrically with the server public key so it is safe to share with other contacts. Only the server can get your subscription data.
   */

  /**
   * @param pushSubscription
   * @param key
   * @param config
   * @see EP2Push.register
   */
  constructor(
    private readonly key: EP2Key,
    readonly config: EP2PushConfig,
    private readonly postURI: string,
    readonly sharedSubscription: SymmetricallyEncryptedMessage<PushSubscription>
  ) {
    super();
  }

  /**
   * Gets the service worker and asks for a push subscription.
   * @param secureKey
   * @param serverConfig
   * @returns a EP2Push instance registered, ready to push and be pushed, or undefined when service worker did not return a registration or user denied notifications.
   */
  static async register(
    secureKey: EP2Key,
    serverConfig: EP2PushConfig
  ): Promise<EP2Push | undefined> {
    const serviceWorkerRegistration =
      await navigator.serviceWorker?.getRegistration();

    if (serviceWorkerRegistration === undefined) {
      console.warn("EP2PUSH: No serviceWorker Registration");
      return undefined;
    }

    const subs = await serviceWorkerRegistration.pushManager.subscribe({
      applicationServerKey: serverConfig.vapidKey,
      userVisibleOnly: true,
    });
    if (subs === undefined) {
      console.warn("EP2PUSH: PushManager did not subscribe");
      return undefined;
    }

    updateEP2ServiceWorker(secureKey);

    handleSW();
    const postURI = `${serverConfig.host}${serverConfig.path}/`;
    const sharedSubscription = EP2Key.encrypt(serverConfig.publicKey, subs);

    return new this(secureKey, serverConfig, postURI, sharedSubscription);
  }

  /**
   *
   * @param msg
   * @param peerId
   * @param shareSubscription
   * @returns
   */
  async pushText(
    msg: NotificationOptions,
    peerId: string,
    shareSubscription: SymmetricallyEncryptedMessage<PushSubscription>
  ): Promise<boolean> {
    const spm: EP2PushMessage = {
      encryptedEndpoint: shareSubscription,
      encryptedPayload: EP2Key.encrypt(peerId, msg),
    };
    return await this.pushMessages([spm]);
  }

  async pushMessages(ep2PushMessages: EP2PushMessage[]): Promise<boolean> {
    const { secureChannel, handshake } = this.key.initiateHandshake(
      this.config.publicKey
    );
    const encryptedPushMessages = secureChannel.encrypt(ep2PushMessages);
    const webPushRequest: EP2PushRequest = {
      handshake,
      encryptedPushMessages,
      senderId: this.key.peerId,
    };

    const response = await axios.post(this.postURI, webPushRequest);

    return (
      response !== undefined && response !== null && response.status === 200
    );
  }
}

/**
 * Updates the service worker with the new key. Push messages received will be decrypted using this new key.
 * @param key
 */
export function updateEP2ServiceWorker(key: EP2Key): void {
  navigator.serviceWorker.controller?.postMessage({
    type: "UPDATE_KEY",
    key: key.toJSON(),
  });
}
