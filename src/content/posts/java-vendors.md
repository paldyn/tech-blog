---
title: "JDK 벤더 배포판 완전 가이드"
description: "Eclipse Temurin, Amazon Corretto, Oracle JDK, Microsoft OpenJDK 등 주요 JDK 배포판의 특징·라이선스·지원 기간을 비교하고 프로젝트에 맞는 선택 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["java", "jdk", "temurin", "corretto", "oracle-jdk", "openjdk", "sdkman", "vendor"]
featured: false
draft: false
---

[지난 글](/posts/java-write-once-run-anywhere/)에서 WORA 원리와 JVM 추상화 계층을 살펴봤습니다. 이번에는 실제로 JDK를 설치할 때 만나게 되는 질문, "어느 배포판을 써야 하나요?"를 정면으로 다룹니다. OpenJDK 에코시스템에는 수십 개의 배포판이 존재하며, 이름만 다른 것들도 있고 실질적인 차이가 있는 것들도 있습니다. 이 글을 읽고 나면 상황에 맞는 배포판을 자신 있게 선택할 수 있습니다.

---

## 왜 배포판이 여러 개인가

Java는 오픈소스입니다. [OpenJDK](https://openjdk.org) 프로젝트가 Java SE 명세(Specification)의 참조 구현(Reference Implementation)을 관리하며, 소스 코드는 GPL v2 + Classpath Exception 라이선스로 공개됩니다. 누구나 이 소스를 빌드하고 배포할 수 있습니다.

이 때문에 Oracle, Amazon, Microsoft, Azul, Eclipse 재단 등 여러 조직이 각자의 빌드 파이프라인과 테스트 스위트, 패치 정책, 비즈니스 모델을 바탕으로 **독자적인 JDK 배포판**을 제공합니다. 기능 면에서는 대부분 동일하지만, **지원 기간·라이선스·특화 기능**에서 차이가 납니다.

---

## 배포판 선택에서 중요한 세 가지 기준

1. **지원 기간**: LTS 버전을 몇 년까지 무료로 지원하는가
2. **라이선스**: 상업적 사용 시 비용이 발생하는가
3. **특화 기능**: 특정 클라우드 플랫폼 또는 기능(네이티브 이미지 등)이 필요한가

---

## Eclipse Temurin — 업계 표준 무료 배포판

**Eclipse Adoptium** 재단이 관리하는 **Eclipse Temurin**은 현재 가장 널리 쓰이는 OpenJDK 배포판입니다. 과거 AdoptOpenJDK 프로젝트에서 시작하여 Eclipse 재단 산하로 이전했습니다.

**특징:**
- GPL v2 + Classpath Exception — 상업적 사용 포함 완전 무료
- TCK(Technology Compatibility Kit) 통과 — Java SE 명세 완전 준수 보장
- LTS 버전 최대 8년 무료 지원 (Java 21은 2031년까지)
- Windows, Linux (x64/aarch64), macOS (Intel/Apple Silicon), Alpine Linux 등 폭넓은 플랫폼 지원
- Docker Hub에서 `eclipse-temurin` 이미지 공식 제공

```bash
# SDKMAN으로 Temurin 21 설치
sdk install java 21.0.3-tem

# Docker에서 사용 예시
FROM eclipse-temurin:21-jre-jammy
```

신규 프로젝트의 **기본 선택지**로 가장 추천합니다. 특정 벤더에 종속되지 않으면서 장기 무료 지원을 받을 수 있습니다.

---

## Amazon Corretto — AWS 환경의 최강자

**Amazon Corretto**는 Amazon이 AWS 내부에서 수백만 개의 서비스를 운영하며 검증한 OpenJDK 배포판입니다. Amazon은 Corretto를 직접 사용하기 때문에 품질에 대한 강한 인센티브가 있습니다.

**특징:**
- GPL v2 + Classpath Exception — 완전 무료
- 장기 무료 지원: Java 21은 2031년 3월까지
- Amazon 자체 백포트 패치 포함 (CVE 수정, 성능 개선)
- Lambda, Elastic Beanstalk, EC2 등 AWS 서비스의 기본 런타임
- ARM(Graviton) 프로세서 최적화 빌드 제공

```bash
# SDKMAN으로 Corretto 21 설치
sdk install java 21.0.3-amzn

# Amazon Linux 2023에서 직접 설치
sudo dnf install java-21-amazon-corretto
```

AWS 인프라에서 실행하거나 Graviton ARM 인스턴스를 쓴다면 Corretto가 자연스러운 선택입니다.

---

## Oracle JDK — 공식 참조 구현, 라이선스 주의

**Oracle JDK**는 Java SE의 공식 참조 구현이며, Oracle이 직접 빌드합니다. 성능 면에서 OpenJDK와 사실상 동일하지만, **라이선스 이력이 복잡**합니다.

**라이선스 변천사:**

| 버전 | 라이선스 | 상업적 무료 여부 |
|---|---|---|
| Java 8u202 이하 | Oracle Binary Code License | 무료 (구버전) |
| Java 8u211 ~ 11 | Oracle Technology Network License | ❌ 상업용 유료 |
| Java 17 이후 | NFTC (No-Fee Terms and Conditions) | ✅ 무료 |

Java 17부터 NFTC 라이선스로 개인·상업적 사용 모두 무료입니다. 다만 **버전별로 라이선스가 다르기 때문에**, Java 8이나 11의 Oracle JDK를 운영 중이라면 해당 버전의 라이선스를 반드시 확인해야 합니다.

```bash
# SDKMAN으로 Oracle JDK 21 설치
sdk install java 21.0.3-oracle
```

> ⚠️ Oracle의 Extended Support(연장 지원)는 유료입니다. 무료 Premier Support 기간(출시 후 5년)이 지나면 Temurin이나 Corretto로 전환하는 것을 권장합니다.

---

## Microsoft Build of OpenJDK — Azure 네이티브

**Microsoft Build of OpenJDK**는 Microsoft가 Azure 서비스에 직접 사용하는 OpenJDK 배포판입니다. Azure App Service, Azure Functions, GitHub Actions 등의 기본 Java 런타임으로 쓰입니다.

**특징:**
- GPL v2 + Classpath Exception — 완전 무료
- LTS 최대 8년 지원 (Adoptium 일정 준수)
- Windows ARM64, macOS ARM (Apple Silicon) 등 신규 아키텍처 빠른 지원
- VS Code 및 Azure 개발 도구와 통합

```bash
# SDKMAN으로 Microsoft OpenJDK 21 설치
sdk install java 21.0.3-ms

# Azure App Service는 자동으로 Microsoft OpenJDK 사용
```

Azure 중심 인프라를 사용하거나 Windows ARM64에서 개발한다면 고려할 만합니다.

---

## Azul Zulu — 가장 많은 플랫폼과 버전

**Azul Zulu**는 Azul Systems가 제공하는 OpenJDK 배포판입니다. 특히 **지원하는 Java 버전과 플랫폼의 폭**이 넓어 레거시 환경에서 강점을 보입니다.

**특징:**
- Community Edition: 무료 (지원 기간 약 5년)
- Platform Edition(상업): 더 긴 지원 기간 + SLA 보장
- Java 6, 7, 8부터 최신 LTS까지 모든 버전 지원
- Solaris, SPARC, musl libc 등 다양한 플랫폼 지원
- Zulu Prime (Zing): C4 GC 등 JVM 최적화 기능 (상업용)

```bash
# SDKMAN으로 Azul Zulu 21 설치
sdk install java 21.0.3-zulu
```

Java 6~7처럼 다른 배포판이 지원하지 않는 구버전이 필요하거나, Solaris 같은 이색적인 플랫폼을 지원해야 할 때 유용합니다.

---

## GraalVM CE — 네이티브 이미지와 다중 언어

**GraalVM Community Edition**은 Oracle이 관리하는 오픈소스 고성능 JDK입니다. 일반 JVM 실행뿐 아니라 두 가지 핵심 기능을 추가로 제공합니다.

**특징:**
- **Native Image**: Java 바이트코드를 플랫폼 네이티브 실행 파일로 AOT 컴파일
- **Polyglot**: JavaScript, Python, Ruby, R을 Java 프로세스 안에서 실행
- Truffle 프레임워크 기반의 언어 인터롭
- CE(무료 오픈소스)와 EE(상업용 Oracle GraalVM) 구분

```bash
# SDKMAN으로 GraalVM CE 21 설치
sdk install java 21.0.3-graalce

# Native Image 빌드 (native-image 도구 필요)
native-image -jar myapp.jar myapp-native
./myapp-native  # JVM 없이 즉시 실행
```

마이크로서비스, AWS Lambda, Kubernetes sidecar처럼 **빠른 시작 시간과 낮은 메모리 사용**이 중요한 환경에서 주목받습니다. Spring Boot Native, Quarkus, Micronaut가 GraalVM 네이티브 이미지를 1급 지원합니다.

![주요 JDK 배포판 한눈에 보기](/assets/posts/java-vendors-overview.svg)

---

## 기타 주목할 배포판

### SAP Machine

SAP가 사내 JVM 전문가 팀으로 관리하는 OpenJDK 배포판입니다. SAP 제품군(HANA, S/4HANA)에 최적화되어 있으며 무료입니다.

### Red Hat OpenJDK

Red Hat Enterprise Linux(RHEL)와 Fedora의 기본 JDK입니다. `yum`/`dnf`로 설치하면 자동으로 Red Hat OpenJDK가 설치됩니다.

### Liberica JDK (BellSoft)

JavaFX가 번들에 포함된 배포판이 필요할 때 유용합니다. 임베디드·Raspberry Pi 지원도 제공합니다.

---

## 어떤 배포판을 선택해야 하나

![Java 21 LTS 벤더별 무료 지원 기간](/assets/posts/java-vendors-comparison.svg)

| 상황 | 추천 배포판 |
|---|---|
| 신규 서버 사이드 프로젝트 (기본값) | **Eclipse Temurin** |
| AWS / Graviton 기반 서비스 | **Amazon Corretto** |
| Azure / Windows ARM64 환경 | **Microsoft OpenJDK** |
| 마이크로서비스 네이티브 이미지 | **GraalVM CE** |
| 레거시 Java 6~7 필요 | **Azul Zulu** |
| SAP 제품군 연동 | **SAP Machine** |
| Oracle 공식 지원 계약 필요 | **Oracle JDK** |

> **핵심 원칙**: 배포판은 언제든 바꿀 수 있습니다. `JAVA_HOME`과 클래스패스만 바꾸면 됩니다. 특수한 이유가 없다면 Temurin이나 Corretto를 선택하고, 필요에 따라 다른 배포판으로 전환하세요.

---

## SDKMAN으로 여러 JDK 관리하기

실무에서는 프로젝트별로 다른 Java 버전과 배포판을 써야 할 때가 많습니다. **SDKMAN**은 여러 JDK를 손쉽게 설치·전환할 수 있게 해 주는 도구입니다.

```bash
# 사용 가능한 Java 배포판 목록 조회
sdk list java

# 프로젝트 디렉터리에 .sdkmanrc 파일 생성
echo "java=21.0.3-tem" > .sdkmanrc

# .sdkmanrc를 읽어 자동 전환
sdk env install  # 최초 1회: 설치 + 전환
sdk env          # 이후: 전환만

# 전역(global) JDK 전환
sdk use java 21.0.3-tem
```

`.sdkmanrc` 파일을 버전 관리에 포함하면 팀 전체가 동일한 JDK 버전과 배포판을 쓸 수 있습니다.

---

## 정리

- 모든 주요 배포판은 **OpenJDK 소스 기반**으로 기능 동작이 동일합니다.
- **Temurin과 Corretto**가 LTS 8년 무료 지원의 가장 안전한 선택입니다.
- **Oracle JDK**는 Java 17 이후 NFTC로 무료지만, 라이선스 변천사를 이해해야 합니다.
- **GraalVM CE**는 네이티브 이미지가 필요한 마이크로서비스·서버리스 환경에서 유리합니다.
- **SDKMAN**으로 여러 배포판을 프로젝트별로 간편하게 관리할 수 있습니다.

---

**지난 글:** [Write Once, Run Anywhere — Java의 플랫폼 독립성](/posts/java-write-once-run-anywhere/)

**다음 글:** [JDK · JRE · JVM — 세 개념의 차이](/posts/java-jdk-jre-jvm/)

<br>
읽어주셔서 감사합니다. 😊
