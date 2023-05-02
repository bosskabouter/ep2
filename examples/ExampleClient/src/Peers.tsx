import { useEffect, useState } from 'react'
import {
  OnlineClient,
  EP2Key,
  type SecureLayer
} from '@ep2/online-client'

// import { SecurePeerKeyBip } from 'securepeerkey-bip'

import TEST_CONFIG from '../../example-config.json'

function Peers (): JSX.Element {
  const [key1, setKey1] = useState<EP2Key>()
  const [key2, setKey2] = useState<EP2Key>()

  const [local, setLocal] = useState(true)
  useEffect(() => {
    if (key1 === undefined) void EP2Key.create().then(setKey1)
    if (key2 === undefined) void EP2Key.create().then(setKey2)
  })

  return (
    <div><div>
       <input checked={local} type='checkbox' onChange={() => { setLocal(!local) }}/> {local ? 'local secure server' : 'public peer server'}
       </div>
      {key1 !== undefined && key2 !== undefined && (
        <div>
          <div>
            <PeerInstance secureKey={key1} local={local}/>
          </div>
          <div>
            <PeerInstance secureKey={key2} otherPeerId={key1.peerId} local={local}/>
            {/* {key2.mnemonic} */}
          </div>
        </div>
      )}
    </div>
  )
}

function PeerInstance ({
  secureKey, otherPeerId, local
}: {
  secureKey: EP2Key
  otherPeerId?: string
  local: boolean
}): JSX.Element {
  const [securePeer, setSecurePeer] = useState<OnlineClient>()

  const [online, setOnline] = useState<boolean>()
  const [secureLayer, setSecureLayer] = useState<SecureLayer>()

  const [count, setCount] = useState(0)

  const [received, setReceived] = useState('')

  function listenAndStore (sl: SecureLayer): void {
    sl.addListener('decrypted', (value) => {
      setReceived(value)
    })
    setSecureLayer(sl)
  }
  useEffect(() => {
    const peer = local
      ? new OnlineClient(
        secureKey,
        TEST_CONFIG.testConfig.server.publicKey,
        {
          host: 'localhost',
          port: TEST_CONFIG.testConfig.server.port,
          path: TEST_CONFIG.testConfig.server.SEC_PEER_CTX,
          debug: 1,
          secure: false,
          key: 'securepeerjs'
        }
      )
      : new OnlineClient(secureKey)
    peer.on('connection', (con) => { listenAndStore(con.metadata.secureLayer) })
    peer.on('open', () => {
      setOnline(true)
      if (otherPeerId !== undefined) {
        listenAndStore(peer.connectSecurely(otherPeerId))
      }
    })
    peer.on('error', (e) => { console.error(e) })
    setSecurePeer(peer)

    return () => {
      peer.disconnect()
      peer.destroy()
    }
  }, [secureKey, local])

  function doSendText (): void {
    setCount(count + 1)
    secureLayer?.send(count.toString())
  }

  function shortenBase64 (base64Value: string | undefined): string {
    if (base64Value === undefined) return 'no id'
    const maxLength = 10
    const firstPart = base64Value.substring(0, maxLength / 2)
    const lastPart = base64Value.substring(base64Value.length - maxLength / 2)
    return firstPart + '.....' + lastPart
  }

  function getColorFromBase64 (base64Value: string | undefined): string {
    if (base64Value === undefined) return 'red'
    let hash = 0
    for (let i = 0; i < base64Value.length; i++) {
      hash = base64Value.charCodeAt(i) + ((hash << 5) - hash)
    }
    const red = (hash & 0xFF0000) >> 16
    const green = (hash & 0x00FF00) >> 8
    const blue = hash & 0x0000FF
    const colorPattern = `rgb(${red}, ${green}, ${blue})`
    return colorPattern
  }

  return (
    <div>
      <div style={{ color: getColorFromBase64(securePeer?.id) }}>Peer ID: {shortenBase64(securePeer?.id)} </div>
      <div>Online: {online !== undefined ? '🟢' : '🟥'} {online}</div>
      <div>connected: {secureLayer !== undefined ? '🧅' : ''}
      </div>
      <div>received: {received}
      </div>

      <button onClick={doSendText} color='green' >Send {count}</button>
    </div>
  )
}
export default Peers
