import express from "express";
import type { EP2PushServerConfig } from "../../../config";

import {
  EP2PushMessageRequest,
  EP2PushVapidRequest,
  EP2PushVapidResponse,
} from "@ep2/push";

import webpush from "web-push";
import EP2Key, { EP2Anonymized } from "@ep2/key";

// const HTTP_ERROR_PUSH_TOO_BIG = 507
export default ({
  key: serverKey,
  config,
}: {
  key: EP2Key;
  config: EP2PushServerConfig;
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
  app.post("/vapid", (request, response) => {
    const vapidRequest: EP2PushVapidRequest = request.body;
    const vapidRequestPlaintext: string = vapidRequest.payload.decrypt(
      serverKey,
      vapidRequest.peerId
    );

    console.info("I don not care", vapidRequestPlaintext);

    const vapidKeys = webpush.generateVAPIDKeys();

    const secureChannel = serverKey.initSecureChannel(vapidRequest.peerId);

    // encrypts the keys for itself
    const encryptedVapidKeys = serverKey.anonymize(vapidKeys, serverKey.id);

    const vapidResponse: EP2PushVapidResponse = {
      encryptedVapidKeys,
      vapidPublicKey: vapidKeys.publicKey,
    };
    response.status(200).json(secureChannel.encrypt(vapidResponse));
  });

  /**
   * Post handler for push requests with body containing
   * `Array<{ destination: SymmetricallyEncryptedMessage, payload: SymmetricallyEncryptedMessage }>`
   */
  app.post("/push", (request, response) => {
    push(request.body as EP2PushMessageRequest)
      .then((res) => {
        response.status(200).send(res);
      })
      .catch((e) => {
        response.status(500).send(e.toString());
      });
  });

  async function push(request: EP2PushMessageRequest): Promise<number> {
    const pushMessage = request.payload.decrypt(serverKey, request.peerId);
    const encryptedVapidKeys = pushMessage.a.encryptedVapidKeys;
    Object.setPrototypeOf(encryptedVapidKeys, EP2Anonymized.prototype);

    // decrypt by the server, for the server
    const { publicKey, privateKey } = encryptedVapidKeys.decrypt(
      serverKey,
      serverKey.id
    );

    webpush.setVapidDetails(config.vapidSubject, publicKey, privateKey);

    const encryptedPushSubscription = pushMessage.a.encryptedPushSubscription;

    Object.setPrototypeOf(encryptedPushSubscription, EP2Anonymized.prototype);

    const subscription: webpush.PushSubscription =
      encryptedPushSubscription.decrypt(
        serverKey
      ) as any as webpush.PushSubscription;

    // encryptedPushSubscription.decrypt(
    //   serverKey
    // ) as any as webpush.PushSubscription;

    const payloadBytes = Buffer.from(JSON.stringify(pushMessage.cno));
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

  {
    // TEST HANDLERS
    app.get("/test", (_request, response) => {
      response.send(
        `
      <h1>EP²Push - Test</h1>
      
      <FORM method='POST' action='./test' ><INPUT TYPE='SUBMIT' value='Post Test Push'/></FORM>
      * should return VAPID public and private key
      `
      );
    });
    app.post("/test", (_request, response) => {
      const keys = webpush.generateVAPIDKeys();
      response.status(200).send(JSON.stringify(keys));
    });
  }

  return app;
};
