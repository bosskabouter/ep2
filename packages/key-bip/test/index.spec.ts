import { SecurePeerKeyBip } from '../src'

const VALID_MNEMONIC =
  'plastic seed stadium payment arrange inherit risk spend suspect alone debris very'
const INVALID_MNEMONIC =
  '111 222 333 444 555 ckm risk spend suspect alone debris very'

describe('BIP Key', () => {
  test('should have valid new key', async () => {
    const securePeerKeyBip = await SecurePeerKeyBip.create()
    testValidKey(securePeerKeyBip)
    expect(securePeerKeyBip).not.toEqual(
      SecurePeerKeyBip.create()
    )
  })

  test('should restore', async () => {
    const SecureChannelKeyBU1 = await SecurePeerKeyBip.create(
      VALID_MNEMONIC
    )
    const SecureChannelKeyBU2 = await SecurePeerKeyBip.create(
      VALID_MNEMONIC
    )
    testValidKey(SecureChannelKeyBU1)
    expect(SecureChannelKeyBU1).toEqual(SecureChannelKeyBU2)
    expect(SecureChannelKeyBU1.peerId).toEqual(
      SecureChannelKeyBU2.peerId
    )
    expect(SecureChannelKeyBU1.masterKey).toEqual(
      SecureChannelKeyBU2.masterKey
    )
    expect(SecureChannelKeyBU1.keySet.signKeyPair).toEqual(
      SecureChannelKeyBU2.keySet.signKeyPair
    )
  })

  test('Entered wrong mnemonic', async () => {
    await expect(async () => {
      await SecurePeerKeyBip.create(INVALID_MNEMONIC)
    }).rejects.toThrow('Invalid mnemonic')
  })
})

function testValidKey (secureChannelKey: SecurePeerKeyBip | null): void {
  if (secureChannelKey == null) expect(secureChannelKey).toBeDefined()
  else {
    expect(secureChannelKey.mnemonic).toBeDefined()
    expect(secureChannelKey.mnemonic.split(' ').length).toBe(12)
    expect(secureChannelKey.peerId).toBeDefined()
    expect(secureChannelKey.keySet.signKeyPair).toBeDefined()
    expect(secureChannelKey.masterKey).toBeDefined()
  }
}
