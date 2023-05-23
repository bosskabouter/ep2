import { useEffect, useState } from "react";
import { EP2Key, EP2Peer, type EP2SecureLayer } from "@ep2/peer";

// import { EP2KeyBip } from '@ep2/key-bip'

import TEST_CONFIG from "../../../example-config.json";

function Peers(): JSX.Element {
  const [key1, setKey1] = useState<EP2Key>();
  const [key2, setKey2] = useState<EP2Key>();

  const [local, setLocal] = useState(true);
  useEffect(() => {
    if (!key1) EP2Key.create().then(setKey1);
    if (!key2) EP2Key.create().then(setKey2);
  });

  return (
    <div>
      <div>
        <input
          checked={local}
          type="checkbox"
          onChange={() => {
            setLocal(!local);
          }}
        />
        {"Connected with: "}
        {local ? "local EP²" : "public peerJS.com"}
      </div>
      {key1 !== undefined && key2 !== undefined && (
        <div>
          <div>
            <PeerInstance ep2Key={key1} local={local} />
          </div>
          <div>
            <PeerInstance ep2Key={key2} otherPeerId={key1.id} local={local} />
            {/* {key2.mnemonic} */}
          </div>
        </div>
      )}
    </div>
  );
}

function PeerInstance({
  ep2Key: ep2Key,
  otherPeerId,
  local,
}: {
  ep2Key: EP2Key;
  otherPeerId?: string;
  local: boolean;
}): JSX.Element {
  const [ep2Peer, setEp2Peer] = useState<EP2Peer>();

  const [online, setOnline] = useState<boolean>();
  const [isEP2PeerServer, setIsEP2PeerServer] = useState<boolean>();

  const [secureLayer, setSecureLayer] = useState<EP2SecureLayer>();

  const [count, setCount] = useState(0);

  const [received, setReceived] = useState("");

  function listenAndStore(sl: EP2SecureLayer): void {
    sl.addListener("decrypted", (value) => {
      setReceived(value as string);
    });
    setSecureLayer(sl);
  }
  useEffect(() => {
    const peer = local
      ? new EP2Peer(ep2Key, TEST_CONFIG.testConfig.server.publicKey, {
          host: "localhost",
          port: TEST_CONFIG.testConfig.server.port,
          path: TEST_CONFIG.testConfig.server.EP2_PEER_CTX,
          debug: 0,
          secure: false,
          key: "ep2peer",
        })
      : new EP2Peer(ep2Key);

    peer.isEp2PeerServer.then((ep2Verified) => {
      console.info("Secure Server: " + ep2Verified);
      setIsEP2PeerServer(ep2Verified);
    });
    peer.on("connected", (secureLayer) => {
      console.info("connected", secureLayer);
      listenAndStore(secureLayer);
    });
    peer.on("open", () => {
      setOnline(true);
      if (otherPeerId !== undefined) {
        listenAndStore(peer.connect(otherPeerId));
      }
    });
    peer.on("error", (e) => {
      console.error(e);
    });
    setEp2Peer(peer);

    return () => {
      peer.disconnect();
      peer.destroy();
    };
  }, [ep2Key, local]);

  function doSendText(): void {
    setCount(count + 1);
    secureLayer?.send(count.toString());
  }

  function shortenBase64(v: string | undefined): string {
    if (v === undefined || v === null) return "no id";
    const maxLength = 10;
    const firstPart = v.substring(0, maxLength / 2);
    const lastPart = v.substring(v.length - maxLength / 2);
    return firstPart + "....." + lastPart;
  }

  function getColorFromBase64(v: string | undefined): string {
    if (v === undefined || v === null) return "red";
    let hash = 0;
    for (let i = 0; i < v.length; i++) {
      hash = v.charCodeAt(i) + ((hash << 5) - hash);
    }
    const red = (hash & 0xff0000) >> 16;
    const green = (hash & 0x00ff00) >> 8;
    const blue = hash & 0x0000ff;
    const colorPattern = `rgb(${red}, ${green}, ${blue})`;
    return colorPattern;
  }

  return (
    <div>
      <div style={{ color: getColorFromBase64(ep2Peer?.id) }}>
        Peer ID: {shortenBase64(ep2Peer?.id)}
      </div>

      {online ? <div title="Online">🟢</div> : <div title="Offline">🟥</div>}
      {isEP2PeerServer ? (
        <div title="EP2Peer Server">👮 </div>
      ) : (
        <div title="Generic PeerJS Server">😷</div>
      )}
      {secureLayer && <div title="Connected with other peer"> 🧅</div>}

      <div>received: {received}</div>

      <button onClick={doSendText} color="green">
        Send {count}
      </button>
    </div>
  );
}
export default Peers;
