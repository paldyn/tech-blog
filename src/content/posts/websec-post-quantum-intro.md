---
title: "포스트 퀀텀 암호학 입문: 양자 컴퓨터 시대의 암호 전환 전략"
description: "양자 컴퓨터가 RSA·ECC를 깨는 원리, NIST PQC 표준 알고리즘(ML-KEM·ML-DSA·SLH-DSA·FN-DSA), Harvest Now Decrypt Later 위협, 하이브리드 전환 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["포스트퀀텀", "PQC", "양자컴퓨터", "ML-KEM", "ML-DSA", "NIST", "암호학", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-certificate-pinning/)에서 인증서 고정으로 MITM 공격을 막는 방법을 살펴봤다. 인증서의 신뢰 기반인 RSA·ECC 암호 체계가 흔들리면 모든 인증 구조가 위협받는다. 양자 컴퓨터는 아직 실용 수준에 이르지 않았지만, 우리가 지금 전송하는 암호화 데이터가 미래에 복호화될 수 있다는 "Harvest Now, Decrypt Later" 시나리오 때문에 전환은 이미 시작됐다.

## 왜 양자 컴퓨터가 위협인가

고전 컴퓨터는 RSA의 소인수분해 문제, ECC의 이산 로그 문제를 풀기 위해 지수적으로 증가하는 시간이 필요하다. RSA-2048 해독에는 현재 기술로 수십억 년이 걸린다. 그런데 양자 컴퓨터에서 실행되는 **Shor 알고리즘**은 같은 문제를 다항 시간에 풀 수 있다. 충분한 논리 큐비트를 가진 양자 컴퓨터가 완성되면 현재 모든 비대칭 암호 체계가 수 시간 내에 붕괴된다.

![양자 컴퓨터의 암호화 위협](/assets/posts/websec-post-quantum-threat.svg)

반면 대칭키 암호(AES)는 **Grover 알고리즘**의 영향을 받지만, 키 길이를 두 배로 늘리면(AES-128 → AES-256) 충분한 보안 마진을 유지할 수 있다. 해시 함수(SHA-256, SHA-3)도 출력 길이를 늘리면 안전하다.

## Harvest Now, Decrypt Later

현재 가장 즉각적인 위협은 "지금 당장 복호화"가 아니라 **지금 수집해서 나중에 복호화**다. 국가급 공격자는 이미 암호화된 트래픽을 대량 저장하고 있을 가능성이 있다. 10~20년 후 양자 컴퓨터가 완성되면 오늘 수집한 데이터를 소급해서 복호화할 수 있다. 따라서 장기 기밀성이 중요한 데이터(국가 기밀, 의료 기록, 금융 거래)는 **지금 당장** 포스트 퀀텀 암호로 전환해야 한다.

## NIST PQC 표준 알고리즘

NIST는 2024년 8월 FIPS 203~205를 최종 공표했다. 이후 FIPS 206(FN-DSA)도 확정됐다.

![NIST PQC 표준 알고리즘 (2024)](/assets/posts/websec-post-quantum-algorithms.svg)

### ML-KEM (FIPS 203) — TLS 키 교환의 미래

ML-KEM(Module-Lattice-based Key Encapsulation Mechanism)은 Kyber를 기반으로 표준화됐다. TLS의 ECDH 키 교환을 대체하는 주력 알고리즘이다. 격자 암호(Lattice Cryptography)는 고차원 벡터 공간에서 "가장 짧은 벡터 찾기"(SVP, CVP 문제)의 어려움에 의존하며, 양자 알고리즘으로도 효율적으로 풀 수 없다고 알려져 있다.

```python
# oqs-python (liboqs 바인딩) 예시
import oqs

# ML-KEM-768 키 캡슐화
kem = oqs.KeyEncapsulation("ML-KEM-768")
public_key = kem.generate_keypair()

# 상대방이 공개키로 캡슐화
kem_enc = oqs.KeyEncapsulation("ML-KEM-768")
ciphertext, shared_secret_enc = kem_enc.encap_secret(public_key)

# 원래 쪽에서 복원
shared_secret_dec = kem.decap_secret(ciphertext)
assert shared_secret_enc == shared_secret_dec
```

### ML-DSA (FIPS 204) — 인증서·코드 서명의 대체

ML-DSA(Dilithium)는 서명·검증 속도가 빠르고 키·서명 크기가 적당해 인증서, 코드 서명, JWT 서명 알고리즘 대체로 가장 유력하다.

```bash
# OpenSSL 3.5+ (PQC 지원) ML-DSA 키 생성 및 서명
openssl genpkey -algorithm ML-DSA-65 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem
echo "sign this" > message.txt
openssl pkeyutl -sign -inkey private.pem \
  -in message.txt -out message.sig
openssl pkeyutl -verify -pubin -inkey public.pem \
  -in message.txt -sigfile message.sig
```

## 하이브리드 모드 전환 전략

순수 PQC로의 즉각 전환은 위험하다. 아직 실전 배포 경험이 적고, 구현 버그가 발견될 수 있다. **하이브리드 모드**는 클래식(RSA/ECC) + PQC를 동시에 사용해 이중으로 보호한다. 클래식 알고리즘이 여전히 안전한 한 데이터는 보호되고, PQC도 동시에 적용되므로 양자 위협도 방어된다.

```nginx
# nginx (OpenSSL 3.5+ 빌드) TLS 하이브리드 설정
ssl_protocols TLSv1.3;
ssl_ecdh_curve X25519MLKEM768:X25519:P-256;
# X25519MLKEM768: X25519(클래식) + ML-KEM-768(PQC) 하이브리드
ssl_ciphers TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
```

TLS 1.3에서는 `key_share` 확장을 통해 하이브리드 그룹을 협상한다. Chrome 131+는 이미 X25519MLKEM768을 기본 지원한다. Cloudflare, AWS, Google도 하이브리드 TLS를 프로덕션 배포했다.

## 마이그레이션 체크리스트

```text
단기 (2025~2026):
  ✓ 암호화 인벤토리 작성 (어디에 RSA/ECC 사용?)
  ✓ TLS: X25519MLKEM768 하이브리드 활성화
  ✓ SSH: ssh-keygen -t ed25519 (단기), PQC SSH 실험

중기 (2026~2028):
  ✓ 인증서 인프라: ML-DSA 하이브리드 인증서 발급
  ✓ 코드 서명 파이프라인 PQC 서명 추가
  ✓ 하드웨어 HSM PQC 지원 확인

장기 (2028+):
  ✓ RSA/ECC 단독 사용 서비스 제거
  ✓ 순수 PQC 전환 (충분한 검증 후)
```

포스트 퀀텀 전환은 단순한 알고리즘 교체가 아니다. 인증서 체계, 키 관리 인프라, 하드웨어 HSM, 프로토콜 스택 전반의 업그레이드가 필요하다. 지금부터 인벤토리를 작성하고 하이브리드 전환부터 시작하는 것이 현실적인 접근이다.

---

**지난 글:** [Certificate Pinning: 인증서 고정으로 MITM 공격 차단하기](/posts/websec-certificate-pinning/)

**다음 글:** [시크릿 관리: 환경 변수·Vault·HSM으로 자격증명 안전하게 보관하기](/posts/websec-secrets-management/)

<br>
읽어주셔서 감사합니다. 😊
