"""Read-only reproduction of the downloaded official CRX3 identity/payload checks.

Run from the repository root: python3 docs/evidence/1.1.2/release-closeout-20261101/verify-store-package.py
Requires cryptography. Does not install the extension, access profiles, or write files.
"""
from pathlib import Path
import hashlib
import json
import struct
import zipfile
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa

root = Path(__file__).resolve().parents[4]
evidence = Path(__file__).resolve().parent
crx = evidence / 'store-current.crx'
baseline = root / '.tmp/permission-recheck-20261101/baseline-source/dist'
data = crx.read_bytes()
assert hashlib.sha256(data).hexdigest() == '71804c76f85b30fc3b78c16a631f72fbcaa5d983a71ba8aedd47372ab9472cef'
assert data[:4] == b'Cr24' and struct.unpack_from('<I', data, 4)[0] == 3
header_length = struct.unpack_from('<I', data, 8)[0]


def varint(buf, pos):
    value = shift = 0
    while True:
        byte = buf[pos]
        pos += 1
        value |= (byte & 127) << shift
        if not byte & 128:
            return value, pos
        shift += 7


def fields(buf):
    pos, result = 0, []
    while pos < len(buf):
        tag, pos = varint(buf, pos)
        if tag & 7 == 2:
            length, pos = varint(buf, pos)
            result.append((tag >> 3, buf[pos:pos + length]))
            pos += length
        elif tag & 7 == 0:
            value, pos = varint(buf, pos)
            result.append((tag >> 3, value))
        else:
            raise ValueError('Unexpected protobuf wire type')
    return result


header = fields(data[12:12 + header_length])
signed_data = next(value for number, value in header if number == 10000)
crx_id = next(value for number, value in fields(signed_data) if number == 1)
alphabet = 'abcdefghijklmnop'
item_id = ''.join(alphabet[byte >> 4] + alphabet[byte & 15] for byte in crx_id)
assert item_id == 'bnbmgiidicjdbnmkmdnjeelhijnlhnjb'
payload = b'CRX3 SignedData\x00' + struct.pack('<I', len(signed_data)) + signed_data + data[12 + header_length:]
item_proof = False
proof_count = 0
for number, value in header:
    if number not in (2, 3):
        continue
    proof = dict(fields(value))
    key = serialization.load_der_public_key(proof[1])
    if isinstance(key, rsa.RSAPublicKey):
        key.verify(proof[2], payload, padding.PKCS1v15(), hashes.SHA256())
    else:
        key.verify(proof[2], payload, ec.ECDSA(hashes.SHA256()))
    proof_count += 1
    item_proof |= hashlib.sha256(proof[1]).digest()[:16] == crx_id
assert item_proof and proof_count == 3

with zipfile.ZipFile(crx) as archive:
    assert archive.testzip() is None
    names = [entry.filename for entry in archive.infolist() if not entry.is_dir()]
    assert len(names) == len(set(names)) == 39
    manifest = json.loads(archive.read('manifest.json'))
    assert manifest.pop('update_url') == 'https://clients2.google.com/service/update2/crx'
    assert manifest == json.loads((baseline / 'manifest.json').read_bytes())
    assert json.loads(archive.read('build-info.json'))['version'] == '1.1.1'
    expected = {str(p.relative_to(baseline)) for p in baseline.rglob('*') if p.is_file()}
    assert set(names) == expected | {'_metadata/verified_contents.json'}
    runtime = expected - {'manifest.json', 'build-info.json'}
    assert len(runtime) == 36
    for name in runtime:
        assert archive.read(name) == (baseline / name).read_bytes(), name

print('PASS: official CRX hash, 3 signatures, item-key binding, canonical manifest, 36 runtime files, exact payload differences')
