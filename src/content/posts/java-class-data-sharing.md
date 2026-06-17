---
title: "클래스 데이터 공유(CDS) — JVM 기동을 빠르게"
description: "CDS는 파싱·검증이 끝난 클래스 메타데이터를 아카이브 파일에 저장해 여러 JVM이 메모리 매핑으로 공유하게 함으로써 기동 시간과 메모리 사용을 줄입니다. 기본 CDS와 AppCDS, 동적 아카이브 생성 흐름을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "CDS", "AppCDS", "기동 시간"]
featured: false
draft: false
---

[지난 글](/posts/java-jvm-flags/)에서 운영에 권장되는 플래그를 몇 가지 봤습니다. 이번엔 그중에서도 **기동 속도**를 직접 끌어올리는 기능을 다룹니다. 자바 애플리케이션이 시작할 때 적지 않은 시간이 클래스 로딩에 쓰입니다. JVM은 수천 개의 클래스 파일을 디스크에서 읽고, 바이트코드를 파싱하고, 검증하고, 내부 메타데이터 구조로 변환합니다. 그런데 이 작업의 결과물은 실행마다 거의 동일합니다. **클래스 데이터 공유(Class Data Sharing, CDS)** 는 이 결과를 한 번 만들어 저장해 두고 재사용하자는 아이디어입니다.

## 매번 똑같은 일을 반복하지 않기

CDS의 핵심은 **파싱·검증이 끝난 클래스 메타데이터를 아카이브 파일(.jsa)에 저장**하는 것입니다. 다음 실행부터 JVM은 클래스를 일일이 다시 파싱하지 않고, 이 아카이브를 메모리에 매핑(mmap)해 바로 사용합니다.

![CDS 메모리 매핑 공유](/assets/posts/java-class-data-sharing-mapping.svg)

여기에 두 가지 이점이 있습니다. 첫째, 클래스 로딩·검증 비용이 줄어 **기동이 빨라집니다.** 둘째, 아카이브는 읽기 전용으로 매핑되므로 같은 머신에서 도는 여러 JVM 프로세스가 **메모리를 공유**할 수 있습니다 — 컨테이너를 여러 개 띄우는 환경에서 메모리 절약 효과가 큽니다.

## 기본 CDS는 이미 켜져 있다

사실 JDK의 핵심 라이브러리(`java.base` 모듈)에 대한 CDS는 최신 JDK에서 **기본으로 활성화**되어 있습니다. JDK를 설치하면 빌드 시점에 생성된 기본 아카이브가 함께 들어 있어, 별도 설정 없이도 `String`, `Object` 같은 표준 클래스들은 아카이브에서 로드됩니다. CDS가 동작 중인지 확인해 봅시다.

```bash
# CDS 사용 여부를 로그로 확인
java -Xshare:on -Xlog:cds -version
```

`-Xshare:on`은 공유 아카이브를 반드시 쓰도록 강제하고(없으면 실패), `-Xshare:off`는 끄며, 기본값 `-Xshare:auto`는 가능하면 사용합니다.

## AppCDS — 내 애플리케이션 클래스까지

기본 CDS는 JDK 클래스만 다룹니다. 진짜 효과는 **우리 애플리케이션의 클래스와 의존 라이브러리까지 아카이브에 넣는** AppCDS(Application CDS)에서 나옵니다. 전형적인 3단계 흐름은 이렇습니다.

![AppCDS 생성 흐름](/assets/posts/java-class-data-sharing-appcds.svg)

```bash
# 1. 앱을 한 번 실행하며 로드된 클래스 목록을 기록
java -XX:DumpLoadedClassList=app.lst -jar app.jar

# 2. 그 목록으로 아카이브를 덤프
java -Xshare:dump -XX:SharedClassListFile=app.lst \
     -XX:SharedArchiveFile=app.jsa -cp app.jar

# 3. 이후 실행마다 아카이브를 사용
java -XX:SharedArchiveFile=app.jsa -jar app.jar
```

1단계에서 실제 워크로드를 한 번 돌려 어떤 클래스가 로드되는지 수집하고, 2단계에서 그 클래스들을 미리 파싱·검증해 아카이브로 만듭니다. 이후 모든 실행은 3단계처럼 아카이브를 매핑해 기동합니다.

## 더 간단해진 최신 방식

JDK 13의 **동적 CDS**는 종료 시점에 로드된 클래스를 자동으로 아카이브에 담아, 별도의 클래스 목록 기록 단계를 없앴습니다.

```bash
# 종료 시 자동으로 아카이브 생성
java -XX:ArchiveClassesAtExit=app.jsa -jar app.jar

# 다음 실행부터 사용
java -XX:SharedArchiveFile=app.jsa -jar app.jar
```

나아가 JDK 19부터는 `-XX:+AutoCreateSharedArchive`로 "아카이브가 없으면 만들고, 있으면 쓰는" 동작을 한 줄로 처리할 수 있습니다. 도구 발전 방향은 분명합니다 — CDS를 쓰기 위한 수고를 계속 줄이는 쪽입니다.

## 어디에 효과적인가

CDS의 이득은 환경에 따라 다릅니다.

- **효과 큰 경우**: 짧게 살다 죽는 프로세스(서버리스 함수, CLI 도구), 같은 이미지를 다수 띄우는 컨테이너 환경, 기동 시간이 곧 비용인 자동 확장(autoscaling) 워크로드.
- **효과 작은 경우**: 한 번 떠서 오래 도는 장수 애플리케이션. 이런 경우 기동 시간은 전체 수명에서 미미합니다.

다만 어느 경우든 비용이 거의 없으므로, 컨테이너 이미지를 만들 때 AppCDS 아카이브를 함께 굽는 것은 좋은 기본 전략입니다. GraalVM 네이티브 이미지만큼 극적이지는 않지만, 기존 JVM을 그대로 쓰면서 얻는 손쉬운 기동 단축입니다.

## 정리

CDS는 파싱·검증이 끝난 클래스 메타데이터를 아카이브로 저장해 여러 JVM이 메모리 매핑으로 공유하게 함으로써, 기동 시간과 메모리를 절약합니다. 기본 CDS는 이미 켜져 있고, AppCDS·동적 아카이브로 애플리케이션 클래스까지 포함하면 효과가 커집니다. 다음 글에서는 성능 분석의 마지막 퍼즐 — 실제로 어디서 시간이 쓰이는지 들여다보는 async-profiler를 다룹니다.

---

**지난 글:** [JVM 플래그 — 표준·-X·-XX 옵션 이해하기](/posts/java-jvm-flags/)

**다음 글:** [async-profiler — 낮은 오버헤드의 프로파일링](/posts/java-profiler-async/)

<br>
읽어주셔서 감사합니다. 😊
