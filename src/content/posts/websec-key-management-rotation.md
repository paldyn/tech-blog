---
title: "키 관리와 순환: 암호화 키 생명주기와 안전한 운영"
description: "암호화 키 생명주기(생성·배포·사용·순환·파기), Envelope Encryption DEK/KEK 분리, 키 버전 관리, AWS KMS·HashiCorp Vault 연동, 키 순환 자동화를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["키관리", "키순환", "KMS", "EnvelopeEncryption", "Vault", "DEK", "KEK", "암호화운영"]
featured: false
draft: false
---

[지난 글](/posts/websec-encryption-at-rest-in-transit/)에서 저장·전송 데이터 암호화 방법을 살펴봤다. 암호화 알고리즘이 아무리 강력해도 **키 관리가 허술하면 의미가 없다**. 이번 글에서는 암호화 키를 안전하게 생성, 보관, 순환, 파기하는 실무 전략을 다룬다.

## 키 관리가 왜 어려운가?

```python
# 흔히 보이는 끔찍한 실수들
SECRET_KEY = "mySecretKey123"           # ❌ 하드코딩 — Git에 노출
KEY = os.environ.get("KEY", "default")  # ❌ 기본값 — 환경변수 미설정 시 취약
key = "password"                         # ❌ 약한 키, 추측 가능

# 설정 파일에 평문 저장
# config.yaml:
# encryption_key: "supersecretkey"      # ❌ Git 커밋 시 전체 노출
```

암호화 키는 단순히 어디에 저장하느냐의 문제가 아니다. **접근 제어, 감사, 순환, 비상 폐기** 전체를 체계적으로 관리해야 한다.

## 키 생명주기

![암호화 키 생명주기](/assets/posts/websec-key-lifecycle.svg)

### 키 생성 원칙

```python
import os
import secrets
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

# ✅ 암호화 키 생성
aes_key = os.urandom(32)          # AES-256 키
hmac_key = os.urandom(32)         # HMAC-SHA256 키

# 마스터 비밀에서 목적별 키 유도 (키 분리)
def derive_purpose_key(master_key: bytes, purpose: str) -> bytes:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=purpose.encode()
    )
    return hkdf.derive(master_key)

master = os.urandom(32)
encryption_key = derive_purpose_key(master, "data-encryption-v1")
mac_key = derive_purpose_key(master, "data-mac-v1")
# 같은 마스터에서 유도했지만 완전히 다른 키
```

### 키 배포 보안

```python
# ✅ 환경변수를 통한 키 주입 (컨테이너/서버리스)
import os
import base64

def load_encryption_key() -> bytes:
    key_b64 = os.environ.get("ENCRYPTION_KEY")
    if not key_b64:
        raise EnvironmentError("ENCRYPTION_KEY 환경변수가 설정되지 않았습니다")
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        raise ValueError(f"AES-256 키는 32바이트 필요, 현재 {len(key)}바이트")
    return key

# ✅ AWS Secrets Manager에서 조회 (권장)
import boto3, json

def load_key_from_secrets_manager(secret_name: str) -> bytes:
    client = boto3.client('secretsmanager', region_name='ap-northeast-2')
    response = client.get_secret_value(SecretId=secret_name)
    secret = json.loads(response['SecretString'])
    return base64.b64decode(secret['encryption_key'])
```

## Envelope Encryption: DEK + KEK 분리

![Envelope Encryption 전략](/assets/posts/websec-key-rotation-strategy.svg)

직접 마스터 키로 데이터를 암호화하면 순환이 어렵다. **Envelope Encryption**은 두 레이어로 분리한다:

- **DEK (Data Encryption Key)**: 실제 데이터 암호화에 사용. DB에 암호화되어 저장.
- **KEK (Key Encryption Key)**: DEK를 암호화. KMS/HSM에만 존재.

```python
import boto3
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class EnvelopeEncryption:
    def __init__(self, kms_key_id: str, region: str = 'ap-northeast-2'):
        self.kms = boto3.client('kms', region_name=region)
        self.kms_key_id = kms_key_id

    def encrypt(self, plaintext: str) -> dict:
        # 1. KMS에서 데이터 키 생성 (DEK)
        response = self.kms.generate_data_key(
            KeyId=self.kms_key_id,
            KeySpec='AES_256'
        )
        dek_plaintext = response['Plaintext']    # 암호화에 사용 후 삭제
        dek_encrypted = response['CiphertextBlob']  # DB에 저장

        # 2. DEK로 실제 데이터 암호화
        aesgcm = AESGCM(dek_plaintext)
        nonce = os.urandom(12)
        ct = aesgcm.encrypt(nonce, plaintext.encode(), None)

        # 3. 메모리에서 평문 DEK 제거
        dek_plaintext = b'\x00' * len(dek_plaintext)  # 덮어쓰기
        del dek_plaintext

        return {
            'encrypted_dek': base64.b64encode(dek_encrypted).decode(),
            'nonce': base64.b64encode(nonce).decode(),
            'ciphertext': base64.b64encode(ct).decode()
        }

    def decrypt(self, stored: dict) -> str:
        # 1. KMS로 DEK 복호화
        response = self.kms.decrypt(
            CiphertextBlob=base64.b64decode(stored['encrypted_dek'])
        )
        dek = response['Plaintext']

        # 2. DEK로 데이터 복호화
        aesgcm = AESGCM(dek)
        nonce = base64.b64decode(stored['nonce'])
        ct = base64.b64decode(stored['ciphertext'])
        plaintext = aesgcm.decrypt(nonce, ct, None)

        del dek
        return plaintext.decode()
```

## 키 버전 관리와 순환

키 순환은 **점진적**으로 해야 한다 — 기존 데이터를 즉시 재암호화할 필요 없이, 새 데이터는 새 키로 암호화하고 기존 키는 복호화용으로만 유지한다.

```python
from dataclasses import dataclass
from typing import Dict
import time

@dataclass
class KeyVersion:
    version: int
    key_material: bytes
    created_at: float
    status: str  # 'active' | 'deprecated' | 'retired'

class VersionedKeyStore:
    def __init__(self):
        self._keys: Dict[int, KeyVersion] = {}
        self._current_version = 0

    def rotate(self, new_key_material: bytes) -> int:
        # 기존 활성 키를 deprecated로 전환
        for kv in self._keys.values():
            if kv.status == 'active':
                kv.status = 'deprecated'

        # 새 키 등록
        self._current_version += 1
        self._keys[self._current_version] = KeyVersion(
            version=self._current_version,
            key_material=new_key_material,
            created_at=time.time(),
            status='active'
        )
        return self._current_version

    def get_current(self) -> KeyVersion:
        return self._keys[self._current_version]

    def get_version(self, version: int) -> KeyVersion:
        kv = self._keys.get(version)
        if not kv:
            raise KeyError(f"키 버전 {version} 없음")
        return kv

    def encrypt(self, plaintext: str) -> str:
        current = self.get_current()
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import os, base64
        aesgcm = AESGCM(current.key_material)
        nonce = os.urandom(12)
        ct = aesgcm.encrypt(nonce, plaintext.encode(), None)
        payload = base64.b64encode(nonce + ct).decode()
        return f"v{current.version}:{payload}"  # 버전 접두사

    def decrypt(self, stored: str) -> str:
        version_str, payload = stored.split(':', 1)
        version = int(version_str[1:])
        kv = self.get_version(version)
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import base64
        raw = base64.b64decode(payload)
        nonce, ct = raw[:12], raw[12:]
        aesgcm = AESGCM(kv.key_material)
        return aesgcm.decrypt(nonce, ct, None).decode()
```

## HashiCorp Vault 연동

```python
import hvac

class VaultKeyManager:
    def __init__(self, vault_url: str, token: str):
        self.client = hvac.Client(url=vault_url, token=token)

    def encrypt(self, plaintext: str, key_name: str = 'my-key') -> str:
        """Vault Transit Secrets Engine으로 암호화"""
        import base64
        pt_b64 = base64.b64encode(plaintext.encode()).decode()
        response = self.client.secrets.transit.encrypt_data(
            name=key_name,
            plaintext=pt_b64
        )
        return response['data']['ciphertext']  # vault:v1:...

    def decrypt(self, ciphertext: str, key_name: str = 'my-key') -> str:
        import base64
        response = self.client.secrets.transit.decrypt_data(
            name=key_name,
            ciphertext=ciphertext
        )
        return base64.b64decode(response['data']['plaintext']).decode()

    def rotate_key(self, key_name: str = 'my-key'):
        """Vault 내 키 순환 (기존 암호문 재암호화 불필요)"""
        self.client.secrets.transit.rotate_key(name=key_name)

    def rewrap(self, old_ciphertext: str, key_name: str = 'my-key') -> str:
        """새 키 버전으로 재암호화 (평문 노출 없이)"""
        response = self.client.secrets.transit.rewrap_data(
            name=key_name,
            ciphertext=old_ciphertext
        )
        return response['data']['ciphertext']  # vault:v2:...
```

## TLS 인증서 자동 갱신

```bash
# Let's Encrypt + Certbot 자동 갱신 (cron)
echo "0 0,12 * * * root certbot renew --quiet --deploy-hook 'nginx -s reload'" \
  >> /etc/crontab

# AWS Certificate Manager (ACM) — 완전 자동
# ACM은 만료 60일 전 자동 갱신, 서비스 재시작 불필요

# 인증서 만료 모니터링 스크립트
#!/usr/bin/env python3
import ssl, socket, datetime, sys

def check_cert_expiry(hostname: str, warning_days: int = 30) -> None:
    ctx = ssl.create_default_context()
    with socket.create_connection((hostname, 443), timeout=10) as s:
        with ctx.wrap_socket(s, server_hostname=hostname) as ss:
            cert = ss.getpeercert()

    expiry = datetime.datetime.strptime(
        cert['notAfter'], '%b %d %H:%M:%S %Y %Z'
    )
    days_left = (expiry - datetime.datetime.utcnow()).days

    if days_left < warning_days:
        print(f"⚠ {hostname}: 만료까지 {days_left}일 남음!", file=sys.stderr)
        sys.exit(1)
    print(f"✅ {hostname}: {days_left}일 남음")

check_cert_expiry("example.com")
```

## 키 유출 대응 절차

```
1. 즉시 감지: SIEM/모니터링 알람
2. 영향 범위 파악: 해당 키로 암호화된 데이터 목록
3. 키 폐기: KMS에서 즉시 비활성화
4. 새 키 생성 및 배포
5. 데이터 재암호화: 새 키로 순차적으로
6. 사후 분석: 유출 경로, 접근 로그 검토
7. 규제 신고: 개인정보 유출 시 72시간 내 신고 (GDPR, 개인정보보호법)
```

---

**지난 글:** [저장 데이터·전송 데이터 암호화 전략](/posts/websec-encryption-at-rest-in-transit/)

**다음 글:** [TLS/HTTPS: 핸드셰이크 동작 원리와 보안 설정](/posts/websec-tls-https/)

<br>
읽어주셔서 감사합니다. 😊
