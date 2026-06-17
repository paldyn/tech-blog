---
title: "JVM 플래그 — 표준·-X·-XX 옵션 이해하기"
description: "JVM 옵션은 표준·-X·-XX 세 계층으로 나뉩니다. 각 계층의 안정성과 의미, -XX의 Boolean·Value 형태, PrintFlagsFinal로 실제 적용값을 확인하는 법, 그리고 검증 없는 플래그 변경의 위험을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "플래그", "튜닝", "성능"]
featured: false
draft: false
---

[지난 글](/posts/java-jmh-benchmark/)에서 성능을 정확히 측정하는 법을 봤습니다. 측정의 결과로 무언가를 바꾸려 할 때, 가장 먼저 손대게 되는 것이 JVM 플래그입니다. `-Xmx512m`, `-XX:+UseG1GC` 같은 옵션을 한 번쯤 봤을 텐데, 이것들이 어떤 체계로 나뉘고 어떻게 동작하는지 알아 두면 막연한 두려움 없이 다룰 수 있습니다. JVM에는 수백 개의 플래그가 있지만, 그 구조는 의외로 단순합니다.

## 세 계층 — 표준, -X, -XX

JVM 옵션은 안정성과 호환성 보장 수준에 따라 세 계층으로 나뉩니다.

![JVM 플래그 3계층](/assets/posts/java-jvm-flags-categories.svg)

- **표준 옵션**: `-cp`, `-version`, `-D프로퍼티=값` 등. 모든 JVM 구현이 지원하고 버전이 바뀌어도 사라지지 않습니다. 가장 안전합니다.
- **-X 옵션**: `-Xmx`(최대 힙), `-Xms`(초기 힙), `-Xss`(스레드 스택 크기) 등. 비표준이라 구현에 따라 다를 수 있지만, 핵심 옵션들은 사실상 표준처럼 널리 쓰입니다.
- **-XX 옵션**: 가장 세밀한 튜닝용. GC 선택, JIT 동작, 진단 출력 등을 제어합니다. 일부는 실험적이거나 향후 제거될 수 있습니다.

## -XX의 두 가지 형태

-XX 옵션은 두 가지 문법을 가집니다. 처음 보면 헷갈리지만 규칙은 간단합니다.

![-XX 두 형태와 실제 값 확인](/assets/posts/java-jvm-flags-common.svg)

**Boolean 플래그**는 `+`로 켜고 `-`로 끕니다. `-XX:+UseG1GC`는 G1 GC를 켜고, `-XX:-UseBiasedLocking`은 편향 락을 끕니다. **Value 플래그**는 `=`로 값을 줍니다. `-XX:MaxGCPauseMillis=200`은 목표 최대 GC 정지 시간을 200ms로 설정합니다.

```bash
# Boolean: +/- 로 on/off
java -XX:+UseG1GC -XX:-TieredCompilation app.jar

# Value: =값
java -XX:MaxGCPauseMillis=200 -XX:MetaspaceSize=128m app.jar
```

## 실제 적용값 확인하기

명령줄에 안 적었다고 플래그가 기본값인 건 아닙니다. JVM은 머신의 CPU·메모리에 따라 **에르고노믹스(ergonomics)** 로 많은 값을 자동 결정합니다. 예를 들어 힙 최대치를 지정하지 않으면 물리 메모리의 약 1/4로 잡힙니다. 그래서 "지금 이 JVM에 실제로 적용된 값"을 확인하는 것이 중요합니다.

```bash
# 모든 플래그의 최종 적용값을 덤프
java -XX:+PrintFlagsFinal -version | grep -i heap

# 명령줄/에르고노믹스로 바뀐 것만 보기
java -XX:+PrintFlagsFinal -version | grep ':='
```

출력에서 `=`는 기본값, `:=`는 명령줄이나 에르고노믹스로 변경된 값을 뜻합니다. 옆에 붙은 `{product}`, `{diagnostic}`, `{experimental}` 같은 표시는 플래그의 성숙도입니다. `{experimental}` 플래그는 `-XX:+UnlockExperimentalVMOptions`를, `{diagnostic}` 플래그는 `-XX:+UnlockDiagnosticVMOptions`를 먼저 줘야 사용할 수 있습니다.

## 자주 쓰는 플래그 갈래

전체를 외울 필요는 없고, 큰 갈래만 알아 두면 됩니다.

- **메모리**: `-Xmx`, `-Xms`(둘을 같게 주면 힙 리사이징 비용 제거), `-Xss`, `-XX:MaxMetaspaceSize`
- **GC 선택**: `-XX:+UseG1GC`, `-XX:+UseZGC`, `-XX:+UseParallelGC`
- **진단**: `-XX:+HeapDumpOnOutOfMemoryError`, `-XX:HeapDumpPath=...`, `-Xlog:gc*`(통합 로깅)
- **JIT**: `-XX:+PrintCompilation`, `-XX:-TieredCompilation`

운영 환경에서 거의 항상 권장되는 한 가지는 OOM 시 자동 힙 덤프입니다.

```bash
java -XX:+HeapDumpOnOutOfMemoryError \
     -XX:HeapDumpPath=/var/log/app/heapdump.hprof \
     -jar app.jar
```

`OutOfMemoryError`가 터지는 순간의 힙을 파일로 남겨, 사후에 원인을 분석할 수 있게 해 줍니다. 비용이 거의 없으므로 운영 기본값으로 둘 만합니다.

## 검증 없이 바꾸지 마라

마지막으로 가장 중요한 원칙입니다. 인터넷에서 본 "마법의 플래그 조합"을 그대로 붙여넣는 것은 위험합니다. 플래그의 효과는 워크로드·힙 크기·하드웨어에 따라 정반대로 나타날 수 있고, 어떤 조합은 서로 충돌하거나 이미 기본값이라 무의미합니다. **현재 적용값을 확인하고, 한 번에 하나씩 바꾸고, 측정으로 효과를 검증하라.** JVM의 기본값과 에르고노믹스는 수많은 워크로드에서 다듬어진 것이라, 대부분의 경우 우리의 직관보다 낫습니다.

## 정리

JVM 플래그는 표준·-X·-XX 세 계층으로 나뉘고, -XX는 Boolean(`+/-`)과 Value(`=`) 두 형태를 가집니다. `PrintFlagsFinal`로 실제 적용값을 확인하는 습관이 튜닝의 출발점이며, 변경은 항상 측정으로 검증해야 합니다. 다음 글에서는 시작 속도를 끌어올리는 흥미로운 기능, 클래스 데이터 공유(CDS)를 다룹니다 — 여러 JVM이 클래스 메타데이터를 공유해 기동을 빠르게 하는 기법입니다.

---

**지난 글:** [JMH — 신뢰할 수 있는 마이크로벤치마크](/posts/java-jmh-benchmark/)

**다음 글:** [클래스 데이터 공유(CDS) — JVM 기동을 빠르게](/posts/java-class-data-sharing/)

<br>
읽어주셔서 감사합니다. 😊
