import EventEmitter from "eventemitter3";
import {
  AsymmetricallyEncryptedMessage,
  EP2Key,
  EP2PushConfig,
  EncryptedHandshake,
  SymmetricallyEncryptedMessage,
} from "..";

/**
 * TL;DR The final result of the API;
 *
 * Send and Receive `PushNotifications` from anyone
 * The PushNotifications can be send by anyone authorized by the EP2Push client.
 */
export interface EP2PushEvents {
  receivedOffline: (payload: NotificationOptions, sender: string) => void;
}

/**
 * The main interface with the API. After successful registration able to send out and listen for PushNotifications
 */
export declare class EP2PushI extends EventEmitter<EP2PushEvents> {
  /**
   *
   * @param notificationOptions
   * @param sender
   * @param encryptedVapid
   */
  pushText(
    notificationOptions: NotificationOptions,
    receiver: string,
    encryptedVapid: EP2PushAuthorization
  ): Promise<boolean>;

  /**
   *
   * @param ep2key
   * @param config
   */
  static register(
    ep2key: EP2Key,
    config?: EP2PushConfig
  ): Promise<EP2PushI | null>;
}

/**
 * Contains information to contact a push endpoint through EP2PushServer;
 *
 * 1. encryptedVapidSubscription
 * 2. encryptedPushSubscription
 *
 * It is created by the owner after registration and can be safely shared with other peers, authorizing them to push.
 */
export interface EP2PushAuthorization {
  /**
   * Encrypted by the owner of the PushSubscription, for the server to decrypt, subscribed to the public key in `encryptedVapidKeys`
   */
  encryptedPushSubscription: AsymmetricallyEncryptedMessage<PushSubscription>;

  /**
   * The VAPID keypair generated and encrypted on, for and by the server but are kept on the client
   */
  encryptedVapidKeys: AsymmetricallyEncryptedMessage<{
    privateKey: string;
    publicKey: string;
  }>;
}

/**
 * A PushMessage as seen on the `EP2PushServer`, containing
 * 1. the endpoint encrypted for the server to decrypt,
 * 2. the payload of the message, encrypted for the receiver to decrypt.
 */
export interface EP2PushMessage {
  /**
   * The the endpoint encrypted for the server to decrypt
   */
  pushVapid: EP2PushAuthorization;

  /**
   * The encrypted payload of the message using symmetric encryption, for the recipient. The sender is unknown to the recipient.
   */
  encryptedNotificationOptions: SymmetricallyEncryptedMessage<NotificationOptions>;
}

/**
 *
 * Server REQUESTS - RESPONSE DEFINITIONS;
 *
 *
 * The base type of any request body sent from an EP2Push client to the EP2Push server. Any request to the (non-public) api of the server must be authenticated using the `EncryptedHandshake` protocol of `@ep2/key`.
 */
export interface EP2PushRequest {
  handshake: EncryptedHandshake;
  peerId: string;
  path: string;
}

export interface EP2PushMessageRequest extends EP2PushRequest {
  /**
   * The EP2PushMessage to be sent, encrypted by the sender for the server.
   */
  encryptedPushMessage: AsymmetricallyEncryptedMessage<EP2PushMessage>;
  path: "/push";
}

/**
 * Nothing is needed for a new Vapid keypair after valid handshake.
 */
export interface EP2PushVapidRequest extends EP2PushRequest {
  path: "/vapid";
}

/**
 * Response from EP2PushServer after successful VAPIDSubscribe
 */
export interface EP2PushVapidResponse extends EP2PushVapidRequest {
  /**
   * EP2PushVapidSubscription, contains VAPID key pair encrypted by the server, for the server
   */
  encryptedVapidKeys: AsymmetricallyEncryptedMessage<{
    privateKey: string;
    publicKey: string;
  }>;

  /**
   * Vapid public key needed for `ServiceWorkerRegistration.PushManager.subscribe(vapidPublicKey)`
   */
  vapidPublicKey: string;
}
