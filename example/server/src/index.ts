import { EP2Key } from "@ep2/key";
// import { EP2KeyBIP } from "@ep2/key-bip";
import { ExpressEP2PushServer } from "@ep2/pushserver";
import { ExpressEP2PeerServer } from "@ep2/peerserver";

import express from "express";

import http from "http";
import cors from "cors";

import TEST_VALUES from "../../example-config.json";
// import { EP2KeyBIP } from "@ep2/key-bip";

const PORT = TEST_VALUES.testConfig.server.port;

const app = express();

const server = http.createServer(app);

// we use both secure - push and peerserver with the same key, but they can use their own.
EP2Key.create(TEST_VALUES.testConfig.server.seed)
  .then((key: EP2Key) => {
    app.use(cors());

    app.use(
      ExpressEP2PushServer(key, server, {
        path: TEST_VALUES.testConfig.server.EP2_PUSH_CTX,
      })
    );

    app.use(
      ExpressEP2PeerServer(key, server, {
        key: "ep2peer",
        path: TEST_VALUES.testConfig.server.EP2_PEER_CTX,
        allow_discovery: true,
        proxied: false,
      })
    );

    server.listen(PORT, () => {
      console.info( 
        `   EP²                                   🐝
        
        Example Server started 
    🐝   
        http://localhost:${PORT.toString()}                             🐝

        PUBLIC KEY: ${key.id}   
        
        Remember your mnemonic for easy recovery of your key: 
        *${key.seed}*
        

        `
      );
    });

    app.get("/", (_req: Request, res: any) =>
      res.send(`
  <h1>EP² - Encrypted Peer 🐝 Push  </h1>
  <a href='.${TEST_VALUES.testConfig.server.EP2_PEER_CTX}'/>Peer service</a> <br>
  <a href='.${TEST_VALUES.testConfig.server.EP2_PUSH_CTX}'/>Push Service</a> 
`)
    );
  })
  .catch(console.error);
