import type webpush from "web-push";
import {
  type AsymmetricallyEncryptedMessage,
  type EncryptedHandshake,
  type SymmetricallyEncryptedMessage,
} from ".";

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
  encryptedEndpoint: SymmetricallyEncryptedMessage<webpush.PushSubscription>;
  encryptedPayload: SymmetricallyEncryptedMessage<any>;
}
