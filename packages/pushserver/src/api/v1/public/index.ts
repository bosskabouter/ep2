import express from "express";
import type { IConfig } from "../../../config";
import {
  AsymmetricallyEncryptedMessage,
  EncryptedHandshake,
  SymmetricallyEncryptedMessage,
  type EP2Key,
} from "@ep2/key";
import * as webpush from "web-push";

import { EP2PushMessage } from "../../../types";

interface WebPushRequest {
  encryptedPushMessages: AsymmetricallyEncryptedMessage<EP2PushMessage[]>;
  handshake: EncryptedHandshake;
  senderId: string;
}

// const HTTP_ERROR_PUSH_TOO_BIG = 507
export default ({
  key,
  config,
}: {
  key: EP2Key;
  config: IConfig;
}): express.Router => {
  const app = express.Router();

  const PUSH_MAX_BYTES = config.pushMaxBytes;

  /**
   *
   * 0. validates request from valid ep2 push client
   * 1. Generates a new Vapid Key pair.
   * 2. Encrypt it the private key so only this server can decrypt: recipient === sender
   * 3. send response vapid public key and encrypted private key back to client
   */
  app.get("/vapid", (request, response) => {
    key.decryptSymmetrically(request.body);
    const vapid = webpush.generateVAPIDKeys();
    const encryptedPrivateKey = key.encrypt(key.peerId, vapid.privateKey);
    response.send({ encryptedPrivateKey, publicKey: vapid.publicKey });
  });

  app.get("/test", (_request, response) => {
    response.send(
      `
      <h1>EP²Push - Test</h1>
      
      <FORM method='POST' action='./' ><INPUT TYPE='SUBMIT' value='Post Test Push'/></FORM>
      * should return TypeError: Cannot read properties of undefined (reading 'signature')
      `
    );
  });

  /**
   * Post handler for push requests with body containing
   * `Array<{ destination: SymmetricallyEncryptedMessage, payload: SymmetricallyEncryptedMessage }>`
   */
  app.post("/", (request, response) => {
    pushAll(request.body as WebPushRequest)
      .then((res) => {
        response.status(200).send(res);
      })
      .catch((e) => {
        response.status(500).send(e.toString());
      });
  });

  async function pushAll(wpr: WebPushRequest): Promise<number[]> {
    const results = new Array<Promise<number>>();
    const pushes = key
      .receiveHandshake(wpr.senderId, wpr.handshake)
      .decrypt(wpr.encryptedPushMessages);
    pushes.forEach((spm) => {
      results.push(
        pushOne(
          spm.encryptedEndpoint as unknown as SymmetricallyEncryptedMessage<webpush.PushSubscription>,
          spm.encryptedPayload
        )
      );
    });
    return await Promise.all(results);
  }

  async function pushOne(
    destination: SymmetricallyEncryptedMessage<webpush.PushSubscription>,
    payload: SymmetricallyEncryptedMessage<any>
  ): Promise<number> {
    const subscription: webpush.PushSubscription =
      key.decryptSymmetrically(destination);
    const payloadBytes = Buffer.from(JSON.stringify(payload));
    if (payloadBytes.length >= PUSH_MAX_BYTES) {
      throw Error(
        `Refusing push too big: ${payloadBytes.length} bytes. Max size: ${PUSH_MAX_BYTES} bytes.`
      );
    }
    const res = await webpush.sendNotification(subscription, payloadBytes, {
      TTL: 1000 * 60,
    });
    return res.statusCode;
  }

  return app;
};
