---
title: "Certificate Pinning: 인증서 고정으로 MITM 공격 차단하기"
description: "Static Pinning, HPKP, Certificate Transparency 비교부터 Android/iOS 구현, 핀 교체 전략, 우회 대응까지 Certificate Pinning 실무 완전 가이드."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["CertificatePinning", "MITM", "TLS", "SPKI", "HPKP", "모바일보안", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-tls-https/)에서 TLS 핸드셰이크 전 과정을 살펴봤다. TLS는 CA(인증 기관) 체계를 신뢰의 근거로 삼는데, 바로 이 지점에 약점이 있다. 브라우저나 OS가 신뢰하는 수백 개의 CA 중 어느 하나만 침해되거나 강제되면, **유효한 인증서를 위장한 MITM(중간자 공격)** 이 가능해진다. Certificate Pinning은 앱이나 클라이언트가 "이 서버는 반드시 이 인증서(또는 이 공개키)를 써야 한다"고 직접 못 박아, CA 신뢰 체계를 우회하는 공격을 차단한다.

## CA 체계의 한계

2011년 DigiNotar 해킹 사건은 CA 신뢰 모델의 취약성을 적나라하게 드러냈다. 공격자는 침해된 CA를 통해 Google, Mozilla 등 주요 사이트의 유효 인증서를 발급받아 이란 사용자를 대상으로 대규모 MITM 공격을 수행했다. 기업 환경에서도 SSL 인스펙션 장비가 내부 트래픽을 중간에서 복호화·재암호화하는데, 이 과정이 원칙적으로는 같은 구조다.

![Certificate Pinning 동작 흐름](/assets/posts/websec-certificate-pinning-flow.svg)

## 핀(Pin)이란 무엇인가

핀은 인증서 또는 공개키의 **암호학적 지문**이다. 두 가지 방식이 있다.

**인증서 핀(Certificate Pin)**: 전체 DER 인코딩된 인증서의 SHA-256 해시. 인증서가 갱신되면 해시가 바뀌므로, 핀도 업데이트해야 한다.

**SPKI 핀(SubjectPublicKeyInfo Pin)**: 공개키 부분만 해시한다. 동일한 키 쌍을 유지하면서 인증서만 갱신하면 핀을 바꾸지 않아도 된다. **실무에서 훨씬 선호**된다.

```bash
# SPKI 핀 추출 (OpenSSL)
openssl s_client -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -pubkey \
  | openssl pkey -pubin -outform DER \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64
# 출력 예: abc123XYZ...== (이 값을 앱에 하드코딩)
```

## 구현 방식 비교

![Certificate Pinning 구현 방식 비교](/assets/posts/websec-certificate-pinning-types.svg)

### Static Pinning (권장)

앱 빌드 시 핀 해시를 코드나 설정 파일에 직접 포함한다. Android Network Security Config, iOS ATS, OkHttp, Retrofit 등 주요 HTTP 라이브러리가 모두 지원한다.

```kotlin
// Android - network_security_config.xml
// <domain-config>
//   <domain includeSubdomains="true">api.example.com</domain>
//   <pin-set expiration="2027-01-01">
//     <pin digest="SHA-256">abc123...primary==</pin>
//     <pin digest="SHA-256">xyz789...backup==</pin>
//   </pin-set>
// </domain-config>

// OkHttp (Kotlin)
val certificatePinner = CertificatePinner.Builder()
    .add("api.example.com",
        "sha256/abc123...primary==",
        "sha256/xyz789...backup==")
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

```swift
// iOS - URLSession + TrustKit (Swift)
import TrustKit

let config: [String: Any] = [
    kTSKSwizzleNetworkDelegates: false,
    kTSKPinnedDomains: [
        "api.example.com": [
            kTSKEnforcePinning: true,
            kTSKPublicKeyHashes: [
                "abc123...primary==",
                "xyz789...backup=="
            ]
        ]
    ]
]
TrustKit.initShared(withConfiguration: config)
```

### HPKP (Deprecated — 참고용)

`Public-Key-Pins` HTTP 응답 헤더로 브라우저에 핀을 전달하는 방식이다. 잘못 설정하면 사이트가 수개월간 접근 불가 상태가 됐고, Chrome 68(2018), Firefox(2020) 등에서 제거됐다. **신규 구현에 사용하지 않는다.**

### Certificate Transparency (CT)

인증서 발급 내역을 공개 로그에 기록하는 표준(RFC 6962)이다. 직접적인 핀은 아니지만, 불법 발급된 인증서를 빠르게 탐지하는 보완책으로 기능한다. Chrome은 2018년부터 CT 로그 포함을 필수화했다.

## 핀 교체 전략 — 가장 중요한 운영 고려사항

Static Pinning의 최대 약점은 **핀이 만료되거나 인증서를 교체할 때 앱 업데이트가 필요**하다는 점이다. 앱 업데이트 전 핀이 만료되면 모든 사용자가 서버에 접속할 수 없다.

```text
핀 교체 안전 절차:
1. 신규 키 쌍 생성 (아직 인증서 미발급)
2. 신규 키의 SPKI 핀을 백업 핀으로 앱에 추가
3. 업데이트 배포 → 구버전 앱 비율 충분히 감소까지 대기
4. CA에서 신규 키로 인증서 발급 (서버 교체)
5. 기존 핀을 백업으로, 신규 핀을 주 핀으로 교체 후 재배포
6. 구버전 앱 완전 소멸 확인 후 기존 핀 제거
```

핀 유효 기간(`expiration`)은 항상 명시하되, 최소 60~90일 여유를 갖고 교체를 시작한다.

## 우회 시도와 대응

공격자나 침투 테스터는 Frida, Objection 등 동적 분석 도구로 런타임에 핀 검증 로직을 후킹해 비활성화를 시도한다.

```bash
# Objection으로 Android SSL Pinning 비활성화 시도 (침투 테스트 참고)
objection -g com.example.app explore
# > android sslpinning disable

# Frida 스크립트 예시 (방어 연구용)
# Java.use("okhttp3.CertificatePinner")
#   .check.overload("java.lang.String","java.util.List")
#   .implementation = function() { return; }
```

이런 공격을 막으려면 **루트 감지 + 앱 무결성 검증(Google Play Integrity API, Apple App Attest)** 을 핀닝과 함께 적용해야 한다. 또한 핀 검증 코드에 ProGuard/R8 난독화를 적용해 후킹 포인트를 숨기는 것이 좋다.

## 언제 Certificate Pinning을 쓰는가

모든 앱에 필요하지는 않다. 다음 상황에서 적용을 검토한다.

- 금융·의료·기업 내부 API 등 **민감 데이터를 다루는 모바일 앱**
- 고정된 서버 엔드포인트와 통신하는 **IoT/임베디드 클라이언트**
- 침투 테스트 중 SSL 인스펙션을 통과해야 하는 환경의 **내부 서비스**

반대로 **일반 웹사이트나 브라우저 기반 앱**에는 Certificate Transparency + HSTS + CAA DNS 레코드 조합이 더 적합하다.

```dns
# CAA 레코드로 특정 CA만 발급 허용
example.com. CAA 0 issue "letsencrypt.org"
example.com. CAA 0 issuewild ";"
example.com. CAA 0 iodef "mailto:security@example.com"
```

Certificate Pinning은 강력하지만 **운영 복잡도가 높다**. 핀 관리 프로세스와 비상 대응 계획(인증서 긴급 교체 시나리오)을 함께 수립해야 실제로 안전하게 유지된다.

---

**지난 글:** [TLS/HTTPS: 핸드셰이크 동작 원리와 보안 설정 완전 가이드](/posts/websec-tls-https/)

**다음 글:** [포스트 퀀텀 암호학 입문: 양자 컴퓨터 시대의 암호 전환 전략](/posts/websec-post-quantum-intro/)

<br>
읽어주셔서 감사합니다. 😊
