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
  vapid,
  key,
  config,
}: {
  vapid: {
    keys: webpush.VapidKeys;
    subject: string;
  };
  key: EP2Key;
  config: IConfig;
}): express.Router => {
  const app = express.Router();

  const PUSH_MAX_BYTES = config.pushMaxBytes;

  webpush.setVapidDetails(
    vapid.subject,
    vapid.keys.publicKey,
    vapid.keys.privateKey
  );

  app.get("/test", (_request, response) => {
    response.send(
      `
      <h1>EP²Push 🛰️</h1>
      
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
    const res = await webpush.sendNotification(
      subscription,
      payloadBytes,
      { TTL: 1000 * 60 }
    );
    return res.statusCode;
  }

  return app;
};
