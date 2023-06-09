import axios from "axios";

import { EP2Anonymized, EP2Key, EP2Sealed } from "@ep2/key";
import { addServiceWorkerHandle as addServiceWorkerHandle } from "./swutil";
import {
  EP2PushMessage,
  EP2PushMessageRequest,
  EP2PushAuthorization,
  EP2PushVapidRequest,
  EP2PushVapidResponse,
} from "./";
import defaultConfig from "./config";
import EventEmitter from "eventemitter3";
import { EP2PushEvents, EP2PushI } from "./shared-types";

/**
 * Client cLass with initialization for the given server config and client key. Enables pushing (and receiving) of encrypted messages through the push server.



In `EP2Push`, `VapidSubscription` is a `VAPID key pair` where the `private key` is `asymmetrically encrypted` *by and for* the server. The Vapid keys are generated on the server, as is typical with push setup. However, unlike in a traditional push setup, the ownership of the keys is transferred to the peer and forgotten on the server. 

When a requesting EP2Push client makes a valid handshake with the EP2PushServer, the server sends out a new key pair, but encrypts it asymmetrically for itself. This is because it is only of interest to the server at the time of pushing. 

The public key, on the other hand, is needed to register the peer's browser's PushManager. This allows the receiving owner of the VapidSubscription to subscribe to their own Vapid public key, which they only receive in plain text while subscribing. 

Once the client has subscribed, they can throw away the public key, but must keep the encrypted VapidKeys Keypair since they are needed by the server at the time of pushing. When this peer authorizes another peer to push, the encrypted key pair is sent to the other peer. 

When the other peer needs to push, they will send the encrypted key pair to the server along with the payload of the notification. The payload is encrypted symmetrically with the public key of the origin so that the origin can decrypt the received message from their endpoint and show the popup.

 */

export class EP2Push extends EventEmitter<EP2PushEvents> implements EP2PushI {
  /**
   * USE `await EP2Push.register()` to register a EP2Push instance!
   *
   * @param pushSubscription
   * @param key
   * @param config
   * @see EP2Push.register
   */
  private constructor(
    /**
     * The pushSubscription safe to share with other peers.
     */
    readonly sharedSubscription: EP2PushAuthorization,
    private readonly ep2key: EP2Key,
    private readonly postURI: string
  ) {
    super();
  }

  /**
   * Gets the service worker and asks for a push subscription.
   * @param secureKey
   * @param config
   * @returns a EP2Push instance registered, ready to push and be pushed, or undefined when service worker did not return a registration or user denied notifications.
   */
  // override
  static async register(
    ep2key: EP2Key,
    config = defaultConfig
  ): Promise<EP2Push | null> {
    config = { ...defaultConfig, ...config };
    const postURI = `${config.secure ? "https" : "http"}://${config.host}:${
      config.port
    }${config.path}`;

    let subs = await this.getSubscription();
    let anonymizedVapidKeys: EP2Anonymized<{
      privateKey: string;
      publicKey: string;
    }>;
    if (!subs) {
      //not subscribed (yet)
      const vapidSubscription = await EP2Push.requestVapidKeys(
        ep2key,
        postURI,
        // config.ep2PublicKey
      );
      console.debug(
        "Not subscribed yet, requested vapid keys",
        vapidSubscription
      );

      //store the encrypted vapid key pair
      anonymizedVapidKeys = vapidSubscription.encryptedVapidKeys;
      console.debug("Storing anonymizedVapidKeys", anonymizedVapidKeys);

      localStorage.setItem(
        "encryptedVapidKeys",
        JSON.stringify(anonymizedVapidKeys)
      );
      console.debug(
        "Subscribing vapidPublicKey",
        vapidSubscription.vapidPublicKey
      );
      subs = await EP2Push.subscribePushManager(
        vapidSubscription.vapidPublicKey
      );
    } else {
      //restore the encrypted vapid key pair
      anonymizedVapidKeys = JSON.parse(
        localStorage.getItem("encryptedVapidKeys")!
      );
    }

    if (subs === null) {
      console.warn("No subscription, no EP2Push");
      return null;
    }

    // Setup the service worker
    addServiceWorkerHandle();

    updateEP2ServiceWorker(ep2key);

    const sealedPushSubscription = new EP2Sealed(subs, config.ep2PublicKey);
    const sharedSubscription: EP2PushAuthorization = {
      sealedPushSubscription,
      anonymizedVapidKeys,
    };

    return new this(sharedSubscription, ep2key, postURI);
  }

  /**
   * First part of the process is to retrieve an EP2VapidSubscription from EP2PushServer. It contains the Vapid public key needed to register the PushNotifications in step 2.
   * @returns a new pair of Vapid Keys for this client from the server. The server encrypts the private key so that only he can use it. The public key is send 'plain-text' to be able to use it with its `PushManager`
   */
  public static async requestVapidKeys(
    ep2key: EP2Key,
    postURI: string,
    // serverId: string
  ): Promise<EP2PushVapidResponse> {
    const request: EP2PushVapidRequest = {
      peerId: ep2key.id,
    };

    const response = await axios.post(postURI + "/vapid", request);

    if (response.status > 200)
      throw Error("No VAPID Keys from EP2PushServer: " + response.statusText);

    const vapidR = response.data; // as EP2Anonymized<EP2PushVapidResponse>;
    // Object.setPrototypeOf(vapidR, EP2Anonymized.prototype);
    return vapidR; //.decrypt(ep2key, serverId);
  }

  /**
   *
   * @param {string} vapidPublicKey as received from the `EP2PushServer` during phase 1.
   * @returns {Promise<PushSubscription | undefined>} A `PushSubscription` from the browser, subscribed to the vapid public key given by the `EP2PushServer` in `EP2VapidSubscription.publicKey`
   */
  private static async getSubscription(): Promise<PushSubscription | null> {
    const serviceWorkerRegistration =
      await navigator.serviceWorker?.getRegistration();

    if (serviceWorkerRegistration === undefined) {
      throw Error("EP2PUSH: No serviceWorker Registration");
    }

    const subs = await serviceWorkerRegistration.pushManager.getSubscription();
    return subs;
  }
  private static async subscribePushManager(
    vapidPublicKey: string
  ): Promise<PushSubscription | null> {
    const serviceWorkerRegistration =
      await navigator.serviceWorker?.getRegistration();

    if (serviceWorkerRegistration === undefined) {
      throw Error("EP2PUSH: No serviceWorker Registration");
    }

    const subs = await serviceWorkerRegistration.pushManager.subscribe({
      applicationServerKey: vapidPublicKey,
      userVisibleOnly: true,
    });
    if (!subs) {
      console.warn("EP2PUSH: PushManager did not subscribe");
      return null;
    }
    return subs;
  }
  /**
   * Pushes `NotificationOptions` to the given destination EP2Push id, using the `SymmetricallyEncryptedMessage<PushSubscription>` given by the receiver.
   * @param notificationOptions
   * @param id
   * @param shareSubscription
   * @returns
   */

  // override
  async pushText(
    notificationOptions: NotificationOptions,
    receiver: string,
    pushVapid: EP2PushAuthorization
  ): Promise<boolean> {
    const cloakedNotificationOptions = this.ep2key.cloak(
      notificationOptions,
      receiver
    );
    const message: EP2PushMessage = {
      cno: cloakedNotificationOptions,
      a: pushVapid,
    };
    const pushMessageRequest: EP2PushMessageRequest = {
      peerId: this.ep2key.id,
      message,
    };

    const response = await axios.post(
      this.postURI + "/push",
      pushMessageRequest
    );

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
