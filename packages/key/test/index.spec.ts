import { type AsymmetricallyEncryptedMessage, SecureChannel, EP2Key, type EncryptedHandshake, SymmetricallyEncryptedMessage, generateRandomKey } from '../src'

import { EP2KeyKX } from '../src/kx-test'

import { jest } from '@jest/globals'

describe('API in README.md', () => {

  let keyA: EP2Key
  let keyB: EP2Key

  beforeAll(async () => {
    keyA = await EP2Key.create()
    keyB = await EP2Key.create('some strong seed')
    expect(keyB.peerId).toContain('0ba1f4667d7cfc3e61a6fac75')

  })
  test('Encrypt between known public keys', () => {
    const m = 'Hi, you know me!'
    const a2b: AsymmetricallyEncryptedMessage<string> = keyA.encrypt(keyB.peerId, m)
    expect(keyB.decrypt(keyA.peerId, a2b)).toBe(m)

  })
  test('Encrypt from unknown for known recipient', () => {
    const m = { myObject: 'Who am I?' }
    const u4a = EP2Key.encrypt(keyA.peerId, m) // or  key2.encryptSymmetrically(key.peerId, msg) 
    expect(keyA.decryptSymmetrically(u4a)).toEqual(m)
  })
})

describe('ToJSON FromJSON should revive usefull key', () => {


  let key: EP2Key
  let json: string
  beforeAll(async () => {
    json = (key = await EP2Key.create()).toJSON()
    expect(key).toBeDefined()
    expect(json).toBeDefined()
  })
  test('should read json key', async () => {
    const keyAgain = EP2Key.fromJson(json)
    expect(keyAgain).toEqual(key)
    expect(keyAgain.encrypt(key.peerId, 'anything')).toBeDefined()
  })

})
describe('EP2Key create', () => {
  let peer1: EP2Key
  let peer2: EP2Key
  beforeEach(async () => {
    peer1 = await EP2Key.create()
    peer2 = await EP2Key.create()
    expect(peer1).toBeDefined()
    expect(peer2).toBeDefined()
    expect(peer1.peerId).toBeDefined()
    expect(peer2.peerId).toBeDefined()
  })

  describe('keys encrypts for himself', () => {
    test('Symmetrically', async () => {
      const key = await EP2Key.create()
      const encrypted = key.encryptSymmetrically(key.peerId, 'Hello World')
      const msg = key.decryptSymmetrically(encrypted)
      expect(msg).toBe('Hello World')
    })
    test('Asymmetrically', async () => {
      const key = await EP2Key.create()
      const encrypted = key.encrypt(key.peerId, 'Hello World')
      const msg = key.decrypt(key.peerId, encrypted)
      expect(msg).toBe('Hello World')
    })
  })

  describe('EP2Key creation', () => {

    test('should create equal keys from same seed string', async () => {
      const aSeed = 'JuStAsEeD&!*^#^'
      const key = await EP2Key.create(aSeed)
      expect(key).toBeDefined()
      const peer2 = await EP2Key.create(aSeed)
      expect(peer2).toBeDefined()
      expect(key).toEqual(peer2)
    })

    test('should create different keys from different seed string', async () => {
      const aSeed = 'JuStAsEeD&!*^#^'
      const key = await EP2Key.create(aSeed)
      expect(key).toBeDefined()
      const peer2 = await EP2Key.create(aSeed + aSeed)
      expect(peer2).toBeDefined()
      expect(key).not.toEqual(peer2)
    })
  })

  describe('Handshake', () => {
    test('should shake hands, encrypt and decrypt', async () => {
      const { secureChannel: secureChannel12, handshake } = peer1.initiateHandshake(peer2.peerId)
      const secureChannel21 = peer2.receiveHandshake(peer1.peerId, handshake)

      const encryptedMessage = secureChannel12.encrypt('Hello world!')
      const decrypted = secureChannel21.decrypt(encryptedMessage)

      expect(decrypted).toBe('Hello world!')
    })

    test('initiates and receives a handshake for a same peer id', () => {
      const { secureChannel, handshake } = peer1.initiateHandshake(peer2.peerId)
      const secureChannel21 = peer2.receiveHandshake(peer1.peerId, handshake)
      expect(secureChannel.sharedSecret).toEqual(secureChannel21.sharedSecret)
    })

    test('throws an error for an invalid signature', () => {
      const { handshake } = peer1.initiateHandshake(peer2.peerId)
      const modifiedSignature = handshake.signature.slice(2)
      handshake.signature = modifiedSignature
      expect(() => {
        peer2.receiveHandshake(peer1.peerId, handshake)
      }).toThrowError(/^[iI]nvalid signature/)
    })
    test('throws an error for an invalid nonce value', () => {
      const { handshake } = peer1.initiateHandshake(peer2.peerId)
      const modifiedNonce = handshake.message.slice(2)
      handshake.message = modifiedNonce
      expect(() => {
        peer2.receiveHandshake(peer1.peerId, handshake)
      }).toThrowError('invalid input')
    })
    test('throws an error for an invalid peer id', async () => {
      const { handshake } = peer1.initiateHandshake(peer2.peerId)
      const modifiedId = (await EP2Key.create()).peerId
      expect(() => {
        peer2.receiveHandshake(modifiedId, handshake)
      }).toThrowError('incorrect key pair for the given ciphertext')
    })
  })

  test('should encrypt/decrypt AsymmetricallyEncryptedMessage simple text', async () => {
    const ciphered = peer1.encrypt(peer2.peerId, 'Hello world!')
    expect(ciphered).toBeDefined()
    const decrypted = ciphered.decrypt(peer2, peer1.peerId)
    expect(decrypted).toEqual('Hello world!')
  })

  test('generate random key (for bin)', async () => {
    const consoleSpy = jest.spyOn(console, 'log')
    generateRandomKey()
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()

  })
  test('should encrypt/decrypt SymmetricallyEncryptedMessage object', async () => {
    const obj = {
      anything: 'https://example.com/endpoint',
      counts: {
        even: 'auth'
      }
    }
    const ciphered = EP2Key.encrypt(peer2.peerId, obj)
    expect(ciphered).toBeDefined()
    const decrypted = ciphered.decrypt(peer2)
    expect(decrypted).toEqual(obj)
  })

  test('should encrypt for and from relay', async () => {
    const aMessage = 'Hello world!'
    const relayMessage = EP2Key.encrypt(peer1.peerId, aMessage)
    expect(relayMessage).toBeDefined()
    const received = relayMessage.decrypt(peer1)
    expect(received).toEqual(aMessage)
  })
  test('should encrypt for and from relay long message', async () => {
    const aMessage = 'Hello world!'.repeat(2522)
    const relayMessage = EP2Key.encrypt(peer2.peerId, aMessage)
    expect(relayMessage).toBeDefined()
    const received = peer2.decryptSymmetrically(relayMessage)
    expect(received).toEqual(aMessage)
  })
  test('should fail to decrypt with wrong public key', async () => {
    const ciphered = peer1.encrypt(peer2.peerId, 'Hello world!')
    expect(ciphered).toBeDefined()
    const wrongPublicKey = await EP2Key.create()
    expect(() => peer2.decrypt(wrongPublicKey.peerId, ciphered)).toThrow('')
  })

  test('should fail to decrypt from invalid relay message', async () => {
    expect(() => peer2.decryptSymmetrically<any>(new SymmetricallyEncryptedMessage('1313123', '23232344', '232323232'))).toThrow('')
  })

  test('should fail to decrypt from tampered relay message', async () => {
    const aMessage = 'Hello world!'
    let relayMessage = EP2Key.encrypt(peer2.peerId, aMessage)
    expect(relayMessage).toBeDefined()
    // Tamper the cipher

    relayMessage = new SymmetricallyEncryptedMessage(relayMessage.nonceB64, relayMessage.cipherB64, relayMessage.cipherB64.substring(2))

    expect(() => peer2.decryptSymmetrically(relayMessage)).toThrow('')
  })

  describe('AsymmetricallyEncryptedMessage over secure Channel', () => {
    const message = 'A message, Bla blah'.repeat(100)
    let initiated: { secureChannel: SecureChannel, handshake: EncryptedHandshake }
    beforeEach(async () => {
      initiated = peer1.initiateHandshake(
        peer2.peerId
      )
      expect(initiated).toBeDefined()
      expect(initiated.handshake).toBeDefined()
      expect(initiated.secureChannel).toBeDefined()
      expect(initiated.secureChannel.sharedSecret).toBeDefined()
    })

    test('should AsymmetricallyEncryptedMessage from message', async () => {
      const encryptedMessage: AsymmetricallyEncryptedMessage<string> =
        initiated.secureChannel.encrypt(message)
      expect(encryptedMessage).toBeDefined()
      expect(encryptedMessage).toBeDefined()
      expect(encryptedMessage).not.toEqual(message)
    })
    describe('Decrypt EncryptedMessage', () => {
      let encryptedMessage: AsymmetricallyEncryptedMessage<string>
      beforeEach(async () => {
        encryptedMessage = initiated.secureChannel.encrypt(message)
      })
      test('should decryptMessage', async () => {
        const decryptedMessage = initiated.secureChannel.decrypt(
          encryptedMessage
        )
        expect(decryptedMessage).toBeDefined()
        expect(decryptedMessage).toEqual(message)
      })

      test('should reject: tampered shared secret', async () => {
        // aSecureChannel.
        // const secureChannel2 = new SecureChannel(
        //   new Uint8Array(Array.from(
        //     aSecureChannel.sharedSecret).reverse())
        // )
        // expect(secureChannel2.decryptMessage(encryptedMessage)).toThrow(/wrong secret key for the given ciphertext/)
      })
    })
    describe('SecureChannel Handshake', () => {
      let sender: EP2Key
      let receiver: EP2Key

      let initiated: { secureChannel: SecureChannel, handshake: EncryptedHandshake }
      beforeEach(async () => {
        sender = await EP2Key.create()
        receiver = await EP2Key.create()
        expect(sender).toBeDefined()
        expect(receiver).toBeDefined()
        initiated = sender.initiateHandshake(receiver.peerId)
        expect(initiated).toBeDefined()
        expect(sender).toBeDefined()

        const sharedSecret = receiver.receiveHandshake(sender.peerId, initiated.handshake)
        expect(sharedSecret).toBeDefined()
      })
      test('should share Secret', () => {
        const sharedSecret = receiver.receiveHandshake(
          sender.peerId,
          initiated.handshake
        ).sharedSecret

        expect(sharedSecret).toEqual(initiated.secureChannel.sharedSecret)
        const decrypted = new SecureChannel(initiated.secureChannel.sharedSecret).decrypt(
          initiated.secureChannel.encrypt('Hello'))
        expect(decrypted).toEqual('Hello')
      })

      describe('Should Reject:', () => {
        let fakeKey: EP2Key
        let fakeHandshake: { secureChannel: SecureChannel, handshake: EncryptedHandshake }

        beforeEach(async () => {
          fakeKey = await EP2Key.create()
          fakeHandshake = fakeKey.initiateHandshake(receiver.peerId)
        })

        test('tampered Signature', () => {
          initiated.handshake.signature = fakeHandshake.handshake.signature
          void expect(
            async () =>
              receiver.receiveHandshake(
                sender.peerId,
                initiated.handshake
              )
          ).rejects.toThrow(/Invalid signature/)
        })
        test('tampered public SignKey', async () => {
          initiated.handshake.publicSignKey = fakeHandshake.handshake.publicSignKey
          await expect(
            async () =>
              receiver.receiveHandshake(
                sender.peerId,
                initiated.handshake
              )
          ).rejects.toThrow(/Invalid signature/)
        })
        test('tampered messageBytes', async () => {
          initiated.handshake.message = fakeHandshake.handshake.message
          await expect(
            async () =>
              receiver.receiveHandshake(
                sender.peerId,
                initiated.handshake
              )
          ).rejects.toThrow(/Invalid signature/)
        })

        test('tampered public peerId', async () => {
          const fakePubId = fakeKey.peerId
          await expect(
            async () =>
              receiver.receiveHandshake(fakePubId, initiated.handshake)
          ).rejects.toThrow(/incorrect key pair for the given ciphertext/)
        })

        test('tampered everything', async () => {
          await expect(
            async () =>
              receiver.receiveHandshake(
                sender.peerId,
                fakeHandshake.handshake
              )
          ).rejects.toThrow(/incorrect key pair for the given ciphertext/)
        })
      })
    })
  })
})



describe('EP2KeyKX', () => {
  test('should first', async () => {
    const key = await EP2KeyKX.create()
    const msg = "Hello World"
    expect(key).toBeDefined()
    const asymmetrically = key.encrypt(key.peerId, msg)
    expect(asymmetrically.decrypt(key, key.peerId)).toBe(msg)
    const symmetrically = key.encryptSymmetrically(key.peerId, msg)
    expect(symmetrically.decrypt(key)).toBe(msg)
  })

})