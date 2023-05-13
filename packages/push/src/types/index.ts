import EP2Key, { EP2Anonymized, EP2Cloaked, EP2Sealed } from "@ep2/key";
import EventEmitter from "eventemitter3";
import { EP2PushConfig } from "../";

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
 * The interface `EP2PushAuthorization` describes the data that is necessary to contact a push endpoint through EP2PushServer without revealing unnecessary information to any involved party. It contains two properties:

    `encryptedVapidKeys` - an encrypted object containing the VAPID key pair (private and public key) generated by the server for this peer to be pushed, and encrypted by the server for the server to be able to decrypt.

    `encryptedPushSubscription` - a sealed push subscription object containing the browser's push subscription of the authorizing party, sealed for only the server to be able to read.
 */
export interface EP2PushAuthorization {
  /**
   * Encrypted by the owner of the PushSubscription, for the server to decrypt, subscribed to the public key in `encryptedVapidKeys`. Server cannot know origin of the encrypted message, see @see Sealed.
   */
  sealedPushSubscription: EP2Sealed<PushSubscription>;

  /**
   * The VAPID keypair originally generated and encrypted on, for and by the server but are kept by the client and shared between peers in a EP2PushAuthorization.
   */
  anonymizedVapidKeys: EP2Anonymized<{
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
   * The authorization to push containing information to contact.
   */
  a: EP2PushAuthorization;

  /**
   * The encrypted payload of the message using Cloak message - unidentifiable, while encrypt, unknown for the recipient, but reveals identity after successful decryption by the receiver. The sender is unknown to the recipient at the time of decrypting.
   */
  cno: EP2Cloaked<NotificationOptions>;
}

/**
 *
 * Server REQUESTS - RESPONSE DEFINITIONS;
 *
 *
 * The base type of any request body sent from an EP2Push client to the EP2Push server. Any request to the (non-public) api of the server must be authenticated using the `EncryptedHandshake` protocol of `@ep2/key`.
 */
export interface EP2PushRequest {
  peerId: string;
  path: string;
  payload: EP2Anonymized<any>;
}

/**
 * The object passed from EP2Push to EP2PushServer in a post request. No additional info is needed, besides the EP2PushRequest basic authentication.
 */
export interface EP2PushMessageRequest extends EP2PushRequest {
  path: "/push";
}
// export interface EP2PushMessageResponse  {
// should there be a response?
// }

/**
 * A request for a new pair of VAPID keys from the server. private
 * Nothing is needed for a new Vapid keypair after valid handshake.
 */
export interface EP2PushVapidRequest extends EP2PushRequest {
  path: "/vapid";
}
/**
 * Response from EP2PushServer after successful VAPIDSubscribe
 */
export interface EP2PushVapidResponse {
  /**
   * EP2PushVapidSubscription, contains VAPID key pair encrypted by the server, for the server
   */
  encryptedVapidKeys: EP2Anonymized<{
    privateKey: string;
    publicKey: string;
  }>;

  /**
   * Vapid public key needed for `ServiceWorkerRegistration.PushManager.subscribe(vapidPublicKey)`
   */
  vapidPublicKey: string;
}
