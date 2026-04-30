---
title: "SDKMAN으로 JDK 설치하기"
description: "SDKMAN을 이용해 Eclipse Temurin, Amazon Corretto, GraalVM 등 다양한 JDK 배포판을 설치·전환하는 방법을 단계별로 설명하고, .sdkmanrc로 프로젝트별 버전을 고정하는 실무 워크플로를 소개합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["java", "jdk", "sdkman", "temurin", "corretto", "graalvm", "install", "version-manager"]
featured: false
draft: false
---

[지난 글](/posts/java-jdk-jre-jvm/)에서 JDK · JRE · JVM의 구조와 역할을 살펴봤습니다. 이제 실제로 JDK를 설치할 차례입니다. OS 패키지 매니저나 공식 사이트에서 직접 설치하는 방법도 있지만, 여러 버전과 배포판을 동시에 관리하려면 **SDKMAN**이 훨씬 편리합니다. 이 글에서는 SDKMAN 설치부터 프로젝트별 JDK 고정까지 실무에서 바로 쓸 수 있는 워크플로를 설명합니다.

---

## SDKMAN이란

**SDKMAN(Software Development Kit MANager)** 은 JDK를 비롯해 Maven, Gradle, Kotlin 등 JVM 생태계 도구들의 여러 버전을 손쉽게 설치·전환할 수 있는 커맨드라인 버전 관리자입니다. macOS, Linux, Windows(WSL2) 환경에서 동작합니다.

SDKMAN의 핵심 장점은 다음 세 가지입니다.

1. **단일 명령 설치**: `sdk install java 21.0.3-tem` 한 줄로 완료
2. **즉각적인 버전 전환**: `sdk use`로 현재 셸, `sdk default`로 전역 전환
3. **`.sdkmanrc`로 프로젝트별 고정**: 팀 전체가 동일한 JDK를 쓸 수 있음

---

## SDKMAN 설치

### macOS / Linux / WSL2

```bash
# 1. 설치 스크립트 실행
curl -s "https://get.sdkman.io" | bash

# 2. 현재 셸에 적용 (또는 새 터미널 열기)
source ~/.sdkman/bin/sdkman-init.sh

# 3. 설치 확인
sdk version
# SDKMAN 5.x.x
```

설치 스크립트는 `~/.sdkman/` 디렉터리를 생성하고, `~/.bashrc` 또는 `~/.zshrc`에 초기화 코드를 추가합니다. 이후에는 새 터미널을 열 때마다 `sdk` 명령을 바로 사용할 수 있습니다.

### Windows (WSL2 권장)

Windows에서는 [WSL2](https://learn.microsoft.com/ko-kr/windows/wsl/install)를 설치한 후 Ubuntu 터미널에서 위 명령을 실행합니다. Git Bash에서도 동작하지만 WSL2가 더 안정적입니다.

---

## JDK 설치

### 설치 가능한 버전 목록 확인

```bash
sdk list java
```

출력 예시(일부):

```
================================================================================
Available Java Versions for Linux 64bit
================================================================================
 Vendor        | Use | Version      | Dist    | Status     | Identifier
--------------------------------------------------------------------------------
 Corretto      |     | 21.0.3       | amzn    |            | 21.0.3-amzn
 GraalVM CE    |     | 21.0.3       | graalce |            | 21.0.3-graalce
 Microsoft     |     | 21.0.3       | ms      |            | 21.0.3-ms
 Oracle        |     | 21.0.3       | oracle  |            | 21.0.3-oracle
 Temurin       |     | 21.0.3       | tem     | installed  | 21.0.3-tem
 Temurin       |     | 17.0.10      | tem     |            | 17.0.10-tem
================================================================================
```

`Identifier` 열의 값이 `sdk install java` 명령에 사용할 식별자입니다.

### Temurin 21 설치 (권장)

```bash
# 설치 — 설치 후 기본값(default)으로 설정할지 묻는 프롬프트가 뜸
sdk install java 21.0.3-tem

# 버전 확인
java -version
# openjdk version "21.0.3" 2024-04-16
# OpenJDK Runtime Environment Temurin-21.0.3+9 (build 21.0.3+9)
```

### 여러 배포판 함께 설치

```bash
# Java 17 LTS (레거시 프로젝트용)
sdk install java 17.0.10-tem

# Amazon Corretto 21 (AWS 환경용)
sdk install java 21.0.3-amzn

# GraalVM CE 21 (네이티브 이미지용)
sdk install java 21.0.3-graalce
```

설치된 파일은 `~/.sdkman/candidates/java/` 아래 버전별로 보관됩니다. `JAVA_HOME`은 SDKMAN이 자동으로 관리합니다.

---

## 버전 전환

![SDKMAN 설치 & JDK 관리 흐름](/assets/posts/java-install-sdkman-flow.svg)

### 현재 셸에서만 임시 전환

```bash
# 현재 터미널 세션에서만 17로 전환
sdk use java 17.0.10-tem
java -version
# openjdk version "17.0.10" ...

# 새 터미널을 열면 기본값(21)으로 복귀
```

### 전역 기본값 변경 (영구)

```bash
# 모든 터미널의 기본 JDK를 21로 설정
sdk default java 21.0.3-tem
```

### 현재 사용 버전 확인

```bash
sdk current java
# Using java version 21.0.3-tem

# 설치된 모든 버전 목록
sdk list java | grep installed
```

---

## 프로젝트별 JDK 고정 — `.sdkmanrc`

실무에서 가장 중요한 기능입니다. 프로젝트 루트에 `.sdkmanrc` 파일을 두면, 해당 디렉터리에 진입할 때 자동으로 지정한 JDK로 전환됩니다.

### `.sdkmanrc` 생성

```bash
# 방법 1: sdk env init (현재 사용 중인 버전으로 자동 생성)
cd my-project/
sdk env init
cat .sdkmanrc
# java=21.0.3-tem

# 방법 2: 직접 작성
echo "java=21.0.3-tem" > .sdkmanrc
```

### 팀원이 처음 체크아웃할 때

```bash
# JDK가 설치되어 있지 않으면 다운로드까지 한 번에
sdk env install

# 이미 설치되어 있으면 전환만
sdk env
```

`.sdkmanrc`를 버전 관리에 포함하면 팀 전체가 동일한 JDK 버전과 배포판을 사용하게 됩니다.

```bash
git add .sdkmanrc
git commit -m "chore: pin JDK to 21.0.3-tem via .sdkmanrc"
```

### 자동 전환 활성화

`~/.sdkman/etc/config`에서 `sdkman_auto_env=true`를 설정하면 디렉터리 이동 시 `.sdkmanrc`를 자동으로 읽어 전환합니다.

```bash
# ~/.sdkman/etc/config
sdkman_auto_env=true
```

---

## CI/CD에서 JDK 설치

### GitHub Actions

CI에서는 SDKMAN 대신 `actions/setup-java`를 사용하는 것이 더 간결합니다.

```yaml
# .github/workflows/build.yml
name: Build
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21 (Temurin)
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21

      - name: Build with Maven
        run: mvn -B package --no-transfer-progress
```

### Docker 이미지

컨테이너 환경에서는 공식 베이스 이미지를 사용합니다.

```dockerfile
# 빌드 스테이지: JDK
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app
COPY . .
RUN ./mvnw -B package -DskipTests

# 런타임 스테이지: JRE (더 가벼움)
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=builder /app/target/app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## 핵심 명령어 레퍼런스

![SDKMAN 핵심 명령어 레퍼런스](/assets/posts/java-install-sdkman-commands.svg)

| 명령 | 설명 |
|---|---|
| `sdk install java <id>` | JDK 설치 |
| `sdk use java <id>` | 현재 셸에서만 전환 |
| `sdk default java <id>` | 전역 기본값 변경 |
| `sdk current java` | 현재 버전 확인 |
| `sdk list java` | 설치 가능한 전체 목록 |
| `sdk env init` | `.sdkmanrc` 생성 |
| `sdk env` | `.sdkmanrc`에 따라 전환 |
| `sdk env install` | `.sdkmanrc` 버전이 없으면 설치 후 전환 |
| `sdk uninstall java <id>` | JDK 제거 |
| `sdk upgrade java` | 업그레이드 가능한 버전 확인 |
| `sdk selfupdate` | SDKMAN 자체 업데이트 |
| `sdk offline enable` | 오프라인 모드 전환 |

---

## SDKMAN vs 다른 설치 방법 비교

| 방법 | 장점 | 단점 |
|---|---|---|
| **SDKMAN** | 다중 버전·배포판 관리, `.sdkmanrc` 팀 공유 | bash/zsh 의존, Windows 미지원(WSL 필요) |
| OS 패키지 매니저 | 시스템 통합, 자동 보안 업데이트 | 버전 선택 제한, 다중 버전 관리 불편 |
| 공식 사이트 직접 설치 | 특정 버전 정확히 선택 가능 | 수동 환경 변수 설정, 버전 전환 불편 |
| Docker | 완전한 격리, 재현 가능 | JVM 외부 실행 불가 |
| Homebrew (macOS) | macOS 기본 도구, 간편 | 다중 버전 관리 SDKMAN보다 불편 |

개발 머신에서는 SDKMAN, CI에서는 `actions/setup-java`, 프로덕션 컨테이너에서는 공식 Docker 이미지를 사용하는 조합이 실무에서 가장 흔합니다.

---

## 정리

- `curl -s "https://get.sdkman.io" | bash` 한 줄로 SDKMAN을 설치합니다.
- `sdk list java`로 70여 가지 JDK 버전·배포판 목록을 확인하고, `sdk install java <id>`로 설치합니다.
- `sdk use`는 현재 셸 한정, `sdk default`는 전역 기본값 변경입니다.
- `.sdkmanrc` 파일로 프로젝트별 JDK를 고정하고 git에 커밋하면 팀 전체가 동일한 환경을 사용할 수 있습니다.
- CI에서는 `actions/setup-java`, 컨테이너에서는 `eclipse-temurin` Docker 이미지를 사용합니다.

---

**지난 글:** [JDK · JRE · JVM — 세 개념의 차이](/posts/java-jdk-jre-jvm/)

**다음 글:** [JDK 핵심 도구 완전 정복](/posts/java-jdk-tools/)

<br>
읽어주셔서 감사합니다. 😊
