---
title: "OutOfMemoryError — 종류별 원인과 진단"
description: "OutOfMemoryError는 한 가지가 아닙니다. Java heap space·GC overhead limit·Metaspace·unable to create native thread·Direct buffer memory 등 메시지마다 터진 메모리 영역과 원인이 다릅니다. 메시지를 읽고 영역을 특정해 진단으로 이어가는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "OutOfMemoryError", "OOM", "Metaspace", "Native Memory", "JVM", "메모리 누수"]
featured: false
draft: false
---

[지난 글](/posts/gc-stop-the-world/)에서 GC가 메모리를 정리하기 위해 애플리케이션을 멈춘다는 것을 봤습니다. 그렇다면 GC가 아무리 멈춰서 정리해도 더 이상 회수할 메모리가 없을 때는 어떻게 될까요? JVM은 더 버티지 못하고 `OutOfMemoryError`를 던집니다. 그런데 이 에러는 한 종류가 아닙니다. 콜론 뒤에 붙는 메시지에 따라 터진 메모리 영역도, 진짜 원인도, 처방도 전부 달라집니다. 이번 글은 대표적인 OOM 메시지를 영역별로 갈라 읽고, 각각을 어떻게 진단으로 이어갈지를 정리합니다.

## OOM은 "메모리 부족"의 한 단어가 아니다

가장 흔한 오해는 `OutOfMemoryError`를 보면 무조건 "힙을 늘리자(`-Xmx` 증가)"고 반응하는 것입니다. 하지만 OOM이 힙에서만 나는 건 아닙니다. JVM이 쓰는 메모리는 객체가 사는 **Java Heap**, 클래스 메타데이터가 사는 **Metaspace**, 그리고 스레드 스택·다이렉트 버퍼처럼 힙 바깥 OS가 직접 관리하는 **Native Memory**로 나뉩니다. OOM 메시지는 그 중 어느 영역이 한계에 부딪혔는지를 알려주는 1차 단서입니다.

![OutOfMemoryError 종류별 메모리 영역 매핑](/assets/posts/jvm-out-of-memory-regions.svg)

`-Xmx`를 늘리는 처방이 맞는 건 사실상 `Java heap space` 한 가지뿐입니다. 나머지는 엉뚱한 곳을 늘리는 셈이라 문제가 그대로 재발합니다. 그래서 진단의 첫걸음은 늘 **메시지부터 정확히 읽는 것**입니다.

## Java heap space — 가장 흔한 케이스

```text
java.lang.OutOfMemoryError: Java heap space
```

객체를 담을 힙 공간이 없고, GC를 돌려도 회수가 안 될 때 나옵니다. 원인은 크게 둘입니다. (1) 정말로 힙이 작아서 정상적인 작업량을 못 담는 경우 — 이때는 `-Xmx`를 올리는 게 맞습니다. (2) **메모리 누수** — 더 이상 쓰지 않는 객체를 어딘가(정적 컬렉션, 캐시, 리스너 목록 등)가 계속 참조해 GC가 회수하지 못하는 경우입니다.

![할당이 OutOfMemoryError로 가는 흐름](/assets/posts/jvm-out-of-memory-flow.svg)

둘을 가르는 가장 확실한 신호는 **GC 로그의 after-힙 추세**입니다. Full GC 직후의 사용량이 계속 우상향하면 누수, 일정 수준에서 안정되면 단순 사이징 문제일 가능성이 큽니다. 누수가 의심되면 `-Xmx`를 올리는 건 시간만 버는 미봉책이고, 힙 덤프로 어떤 객체가 쌓이는지를 봐야 합니다.

## GC overhead limit exceeded — 사실상 힙 문제

```text
java.lang.OutOfMemoryError: GC overhead limit exceeded
```

힙이 거의 다 찼지만 아직 완전히 0은 아닐 때, JVM이 "GC에 너무 많은 시간을 쓰는데(기본: 전체 시간의 98% 이상) 회수량은 미미하다(2% 미만)"고 판단하면 던집니다. 본질은 `Java heap space`와 같은 힙 부족/누수이며, 메모리가 완전히 바닥나기 직전 GC가 헛도는 상태를 조기에 잡아 던지는 것뿐입니다. 진단도 동일하게 GC 로그와 힙 덤프로 접근합니다.

## Metaspace — 클래스가 너무 많다

```text
java.lang.OutOfMemoryError: Metaspace
```

Metaspace는 클래스 메타데이터(클래스 구조, 메서드 정보 등)가 사는 영역입니다(자바 8에서 PermGen을 대체). 여기서 OOM이 나면 힙 객체가 아니라 **로딩된 클래스가 너무 많다**는 뜻입니다. 전형적인 원인은 동적 프록시·바이트코드 생성을 남발하거나, 애플리케이션을 반복 재배포하는데 옛 클래스로더가 GC되지 않아 클래스가 누적되는 클래스로더 누수입니다.

```bash
# Metaspace 상한을 명시하고, 한계에 다가가는지 모니터링
java -XX:MaxMetaspaceSize=256m -Xlog:gc+metaspace -jar app.jar
```

`-Xmx`를 올려도 소용없고, `-XX:MaxMetaspaceSize`를 늘리거나(임시방편) 클래스 누적의 원인을 잡아야 합니다.

## Native 영역 — 힙 바깥의 한계

```text
java.lang.OutOfMemoryError: unable to create native thread
```

이건 힙과 거의 무관합니다. 스레드 하나를 만들 때마다 OS가 스택용 네이티브 메모리를 잡는데, 스레드를 수천 개씩 만들면 OS의 스레드/메모리 한계(`ulimit`, 프로세스당 스레드 수)에 먼저 부딪힙니다. 역설적으로 `-Xmx`를 **너무 크게** 잡으면 힙이 주소공간을 차지해 네이티브 영역이 좁아져 이 에러가 더 잘 납니다. 처방은 힙 증설이 아니라 스레드 수 자체를 줄이는 것 — 스레드 풀 도입, 또는 가상 스레드 전환입니다.

```text
java.lang.OutOfMemoryError: Direct buffer memory
```

NIO의 다이렉트 `ByteBuffer`는 힙 밖 네이티브 메모리를 씁니다. `-XX:MaxDirectMemorySize` 한도를 넘으면 이 메시지가 납니다. 다이렉트 버퍼를 만들고 제때 정리(참조 해제)하지 못해 쌓이는 경우가 많습니다.

## 진단 절차 — 메시지에서 출발한다

OOM은 결과일 뿐이고, 핵심은 "어느 영역이, 왜"입니다.

- **메시지 읽기**: 콜론 뒤 메시지로 영역을 특정한다. `heap space`/`GC overhead` → 힙, `Metaspace` → 클래스, `native thread`/`Direct buffer` → 네이티브.
- **항상 덤프 자동화**: `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/dumps`를 켜두면 OOM 순간의 힙 덤프가 남는다. 운영에서는 필수.
- **추세 보기**: GC 로그의 after-힙이 우상향이면 누수, 평탄하면 사이징 문제.
- **영역에 맞는 처방**: 힙 누수는 힙 덤프 분석, Metaspace는 클래스로더 누수 추적, 네이티브는 스레드/버퍼 수 통제. `-Xmx`는 만능 처방이 아니다.

> OOM이 던져졌다고 JVM이 곧장 죽는 건 아니지만, 한 번 OOM이 난 JVM은 메모리 상태가 불안정해 신뢰하기 어렵습니다. 운영 환경에서는 `-XX:+ExitOnOutOfMemoryError`로 즉시 종료시키고, 오케스트레이터가 깨끗한 인스턴스로 교체하게 하는 편이 안전합니다.

## 정리

- `OutOfMemoryError`는 단일 에러가 아니라 **터진 메모리 영역**에 따라 갈라지는 에러군이다. 메시지를 먼저 읽어 영역을 특정한다.
- `Java heap space`·`GC overhead limit`은 힙 부족/누수 — `-Xmx`가 맞을 수도, 누수일 수도. after-힙 추세로 가른다.
- `Metaspace`는 클래스 과다 로딩/클래스로더 누수, 힙과 무관하다.
- `native thread`·`Direct buffer memory`는 힙 바깥 네이티브 한계 — 스레드 수·다이렉트 버퍼를 통제한다.
- `-XX:+HeapDumpOnOutOfMemoryError`를 항상 켜 두고, 다음 글의 힙 덤프 분석으로 누수의 정체를 좁힌다.

---

**지난 글:** [Stop-The-World — GC가 애플리케이션을 멈추는 순간](/posts/gc-stop-the-world/)

**다음 글:** [힙 덤프 — 메모리 누수를 잡는 스냅샷 분석](/posts/jvm-heap-dump/)

<br>
읽어주셔서 감사합니다. 😊
