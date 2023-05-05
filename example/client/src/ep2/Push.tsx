import React, { useEffect, useState } from "react";
import { EP2Key, type EP2PushConfig } from "@ep2/push";
import { EP2Push } from "@ep2/push";

import TEST_VAPID_KEYS from "../../../server/vapidKeys.test.json";
import TEST_VALUES from "../../../example-config.json";

const serverConfig: EP2PushConfig = {
  host: "localhost",
  port: TEST_VALUES.testConfig.server.port,
  path: TEST_VALUES.testConfig.server.EP2_PUSH_CTX,
  publicKey: TEST_VALUES.testConfig.server.publicKey,
  vapidPublicKey: TEST_VAPID_KEYS.publicKey,
};
export default function EP2PushYourself(): JSX.Element {
  const [ep2key, setEp2key] = useState<EP2Key>();
  const [ep2push, setEp2push] = useState<EP2Push | null>();
  const [result, setResult] = useState<boolean>();

  const [count, setCount] = useState(0);
  useEffect(() => {
    (async () => {
      if (ep2push !== undefined) return;
      const ep2key = await EP2Key.create();
      setEp2key(ep2key);
      setEp2push(await EP2Push.register(ep2key, serverConfig));
    })().catch(console.error);
  }, []);

  return (
    <div>
      <div>Key: {ep2key?.peerId}</div>
      <div>Push: {ep2push?.sharedSubscription?.toString()}</div>
      <div>Result: {result?.toString()}</div>
      <button onClick={postMessage}>Push yourself</button>
    </div>
  );

  async function postMessage(): Promise<void> {
    setCount(count + 1);
    ep2key !== undefined &&
      setResult(
        await pushSecureMessage("Hi again: " + count.toString(), ep2key.peerId)
      );
  }

  async function pushSecureMessage(
    payload: string,
    peerId: string
  ): Promise<boolean | undefined> {
    return await ep2push?.pushText(
      {
        body: payload,
        vibrate: [count * 1000, 100, 200, 1000],
      } as NotificationOptions,
      peerId,
      ep2push.sharedSubscription
    );
  }
}
