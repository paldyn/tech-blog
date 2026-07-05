---
title: "JCA — Java 암호화 아키텍처"
description: "Java Cryptography Architecture(JCA)의 프로바이더 기반 설계를 이해하고, 해시(MessageDigest), 대칭 암호(Cipher, AES-GCM), 비대칭 암호(RSA, Signature)를 실제 코드로 구현합니다. 암호 프리미티브 3종의 용도 차이와 안전한 사용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "보안", "암호화", "JCA", "AES", "RSA"]
featured: false
draft: false
---

[지난 글](/posts/java-security-overview/)에서 Java 보안의 전체 계층과 CIA 3대 목표를 조망했다. 이번에는 그중 **암호화 계층**의 기반인 JCA(Java Cryptography Architecture)를 다룬다. JCA는 해시·대칭 암호·비대칭 암호를 표준화된 방식으로 제공하는 프레임워크로, `java.security`와 `javax.crypto` 패키지에 걸쳐 있다. 암호 알고리즘을 직접 구현하지 말고 이 표준 API를 쓰는 것이 보안의 첫 번째 원칙이다.

## 프로바이더 기반 설계

JCA의 핵심은 **엔진 클래스와 프로바이더의 분리** 다. 애플리케이션은 `MessageDigest`, `Cipher` 같은 엔진 클래스에 알고리즘 이름만 넘기고, 실제 구현은 등록된 프로바이더가 제공한다.

![JCA 프로바이더 아키텍처](/assets/posts/java-cryptography-jca-architecture.svg)

```java
// 엔진 클래스는 알고리즘 이름만 안다
MessageDigest md = MessageDigest.getInstance("SHA-256");

// 특정 프로바이더를 명시할 수도 있다
MessageDigest md2 = MessageDigest.getInstance("SHA-256", "SUN");
```

이 설계 덕분에 BouncyCastle 같은 서드파티 프로바이더를 추가해도 애플리케이션 코드는 바뀌지 않는다. 알고리즘 이름은 그대로 두고, 그 이름을 처리할 프로바이더만 교체하면 된다. 이것이 JCA를 **플러그형(pluggable)** 이라고 부르는 이유다.

## 프리미티브 3종의 용도 구분

암호화를 처음 배울 때 가장 흔한 실수는 **잘못된 도구를 고르는 것** 이다. 해시로 암호화하려 하거나, 비밀번호를 대칭 암호로 저장하는 식이다. 세 프리미티브는 목적이 완전히 다르다.

![3가지 암호 프리미티브](/assets/posts/java-cryptography-jca-primitives.svg)

## 해시: 단방향 요약

해시는 임의 길이 입력을 고정 길이 요약으로 바꾸며, **복호화가 불가능** 하다. 무결성 검증과 (솔트를 곁들인) 비밀번호 저장에 쓴다.

```java
import java.security.MessageDigest;
import java.util.HexFormat;

MessageDigest md = MessageDigest.getInstance("SHA-256");
byte[] hash = md.digest("hello".getBytes(StandardCharsets.UTF_8));

// Java 17+ HexFormat으로 16진수 변환
String hex = HexFormat.of().formatHex(hash);
System.out.println(hex);
// 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

주의할 점: **MD5와 SHA-1은 충돌 공격이 확립되어 더 이상 안전하지 않다.** 새 코드는 SHA-256 이상을 쓴다. 또한 비밀번호 저장에는 일반 해시가 아니라 PBKDF2·bcrypt·Argon2처럼 의도적으로 느린 알고리즘을 써야 한다(무차별 대입 방어).

## 대칭 암호: AES-GCM

대칭 암호는 하나의 키로 암·복호화한다. 빠르므로 대용량 데이터 암호화에 적합하다. 현대 표준은 **AES-GCM** 인데, 암호화와 무결성 검증(인증 태그)을 동시에 제공하는 AEAD 모드이기 때문이다.

```java
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.security.SecureRandom;

// 키 생성 (실무에선 KeyStore에서 로드)
KeyGenerator kg = KeyGenerator.getInstance("AES");
kg.init(256);
SecretKey key = kg.generateKey();

// GCM은 매 암호화마다 고유한 12바이트 IV(논스) 필요
byte[] iv = new byte[12];
new SecureRandom().nextBytes(iv);

Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
byte[] ciphertext = cipher.doFinal("민감한 데이터".getBytes(StandardCharsets.UTF_8));
// 복호화 시에는 iv와 ciphertext를 함께 저장/전송해야 한다
```

여기서 절대 하면 안 되는 실수 두 가지: **IV를 재사용하는 것**(GCM에서 같은 키+IV로 두 번 암호화하면 기밀성이 완전히 무너진다)과 **ECB 모드를 쓰는 것**(같은 평문 블록이 같은 암호문이 되어 패턴이 노출된다). IV는 매번 `SecureRandom`으로 새로 생성하고, `java.util.Random`은 예측 가능하므로 절대 쓰지 않는다.

## 비대칭 암호와 전자서명

비대칭 암호는 공개키·개인키 쌍을 쓴다. 키 공유 문제가 없어 키 교환과 전자서명에 적합하지만 느리므로, 실무에서는 비대칭으로 대칭 키를 안전하게 전달하고 실제 데이터는 대칭으로 암호화하는 하이브리드 방식을 쓴다. 전자서명은 무결성과 부인방지를 제공한다.

```java
import java.security.*;

// 키 쌍 생성
KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
kpg.initialize(2048);
KeyPair pair = kpg.generateKeyPair();

// 개인키로 서명
Signature signer = Signature.getInstance("SHA256withRSA");
signer.initSign(pair.getPrivate());
signer.update("계약서 내용".getBytes(StandardCharsets.UTF_8));
byte[] signature = signer.sign();

// 공개키로 검증
Signature verifier = Signature.getInstance("SHA256withRSA");
verifier.initVerify(pair.getPublic());
verifier.update("계약서 내용".getBytes(StandardCharsets.UTF_8));
boolean valid = verifier.verify(signature); // true
```

RSA 키는 최소 2048비트, 새 시스템은 3072비트 이상을 권장한다. 성능과 키 크기 면에서 유리한 타원곡선(EC, Ed25519)도 널리 쓰인다.

## 실무 체크리스트

| 항목 | 권장 |
|------|------|
| 해시 알고리즘 | SHA-256 이상 (MD5·SHA-1 금지) |
| 비밀번호 저장 | PBKDF2·bcrypt·Argon2 + 솔트 |
| 대칭 암호 | AES-GCM (ECB 금지) |
| IV/논스 | 매번 `SecureRandom`으로 새로 생성 |
| 난수 생성 | `SecureRandom` (`Random` 금지) |
| RSA 키 길이 | 2048비트 이상 (신규 3072+) |
| 알고리즘 직접 구현 | 절대 금지 — 표준 API 사용 |

암호화의 원칙은 단순하다. **직접 만들지 말고, 검증된 표준 알고리즘을 올바른 모드로 사용하라.** 다음 글에서는 이 암호 기술이 실제 네트워크에서 작동하는 방식인 **TLS와 KeyStore** 를 다룬다.

---

**지난 글:** [Java 보안 개요 — 심층 방어와 보안 3대 목표](/posts/java-security-overview/)

**다음 글:** [TLS와 KeyStore — Java 전송 구간 보안](/posts/java-tls-keystore/)

<br>
읽어주셔서 감사합니다. 😊
