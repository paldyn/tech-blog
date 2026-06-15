---
title: "JDK Flight Recorder — 저비용 상시 프로파일링"
description: "JDK Flight Recorder(JFR)는 JVM에 내장된 초저오버헤드 이벤트 기록기입니다. 스레드-로컬 버퍼 구조로 약 1% 오버헤드만으로 GC·할당·락 경합·메서드 샘플을 상시 기록하고, jcmd로 .jfr을 떠 분석으로 넘기는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "JFR", "Flight Recorder", "프로파일링", "jcmd", "성능 진단", "JVM"]
featured: false
draft: false
---

[지난 글](/posts/jvm-thread-dump/)에서 스레드 덤프로 한 시점의 스레드 상태를 봤습니다. 힙 덤프도, 스레드 덤프도 결국 **스냅샷** — 한 장의 사진입니다. 하지만 "처리량이 30분에 걸쳐 서서히 떨어졌다", "특정 시간대에만 pause가 튄다" 같은 *시간에 걸친* 문제는 사진 한 장으로는 안 잡힙니다. 영상이 필요합니다. 그 영상을 거의 공짜로 찍어 주는 도구가 **JDK Flight Recorder(JFR)** 입니다. JVM에 내장돼 있고, 오버헤드가 약 1% 수준이라 운영 환경에서 상시 켜둘 수 있습니다. 이번 글은 JFR이 어떻게 그렇게 가벼운지, 무엇을 기록하는지, 어떻게 기록을 뜨는지를 정리합니다.

## JFR이란 — JVM에 내장된 블랙박스

JFR은 JVM 자체가 자신의 내부 이벤트(GC, 객체 할당, 락 경합, 예외, 메서드 샘플 등)를 시간순으로 기록하는 기능입니다. 항공기의 블랙박스처럼 "평소엔 조용히 돌다가, 문제가 생기면 그 직전까지의 기록을 꺼내 보는" 용도에 맞춰 설계됐습니다. 원래 상용 기능이었지만 **JDK 11부터 오픈소스(OpenJDK)에 포함**되어 누구나 무료로 씁니다.

JFR의 가장 큰 강점은 오버헤드입니다. 외부 프로파일러는 JVM에 에이전트를 붙이고 샘플링을 위해 스레드를 멈추거나 바이트코드를 손대 부하가 큽니다. JFR은 JVM 내부에서 이미 발생하는 이벤트를 받아 적기만 하므로 부담이 작습니다. 비결은 버퍼 구조에 있습니다.

![JFR 이벤트가 스레드-로컬 버퍼를 거쳐 .jfr로 흐르는 경로](/assets/posts/jvm-flight-recorder-pipeline.svg)

이벤트는 먼저 **스레드마다 따로 있는 thread-local 버퍼**에 쌓입니다. 스레드가 자기 버퍼에만 쓰므로 락 경합이 없습니다. 이 버퍼가 차면 공용 **global 버퍼**로 모이고, 다시 주기적으로 `.jfr` 파일로 내려갑니다. global 버퍼는 고정 크기 ring buffer라, 가득 차면 가장 오래된 이벤트를 덮어씁니다. 그래서 메모리 사용량이 예측 가능하고, "최근 N분"을 항상 손에 쥔 채로 돌 수 있습니다.

## 무엇을 기록하나

JFR이 기록하는 이벤트는 수백 종에 달하지만, 진단에서 자주 보는 카테고리는 정해져 있습니다.

![JFR이 기록하는 주요 이벤트 카테고리](/assets/posts/jvm-flight-recorder-events.svg)

특히 **메서드 샘플**과 **객체 할당** 이벤트가 강력합니다. 메서드 샘플은 주기적으로 스택을 떠서 "CPU 시간을 어디서 쓰는지"를 알려주고(핫스팟 파악), 할당 이벤트는 "어떤 코드가 어떤 객체를 얼마나 만드는지"를 알려줘 GC 압력의 근원을 추적하게 해 줍니다. 락 경합 이벤트는 어떤 모니터에서 스레드들이 얼마나 오래 막히는지를 누적으로 보여 줘, 단발 스레드 덤프로는 놓치는 간헐적 경합을 잡아냅니다.

## 기록 뜨기

JFR은 두 가지 방식으로 켤 수 있습니다. 시작 시 플래그로 켜거나, 운영 중 `jcmd`로 동적으로 시작/덤프할 수 있습니다.

```bash
# 1) 시작 시 켜기 — 종료 시 .jfr 저장
java -XX:StartFlightRecording=duration=60s,filename=rec.jfr -jar app.jar

# 2) 운영 중 jcmd로 시작 (이름을 붙여둔다)
jcmd <pid> JFR.start name=diag settings=profile

# 3) 지금까지의 기록을 파일로 덤프 (계속 기록은 유지)
jcmd <pid> JFR.dump name=diag filename=/var/dumps/diag.jfr

# 4) 기록 중지
jcmd <pid> JFR.stop name=diag
```

`settings`에는 보통 두 프로파일을 씁니다. `default`는 오버헤드가 거의 없어(약 1%) **상시 운영**에 적합하고, `profile`은 샘플링 빈도를 높여 더 자세하지만 오버헤드가 조금 더 큽니다 — 문제를 좁혀 들어갈 때 잠깐 켭니다.

실무 패턴은 **상시 기록 + 덤프 온디맨드**입니다. `default` 설정으로 ring buffer를 계속 돌리다가, 이상 징후가 보이면 그 순간 `JFR.dump`로 직전 기록을 떠냅니다. 블랙박스처럼 "사건 직전"이 항상 남아 있는 셈입니다.

> JFR 기록(`.jfr`)은 그 자체로는 바이너리라 사람이 읽기 어렵습니다. `jfr print rec.jfr`로 텍스트로 풀어 볼 수도 있지만, 실전 분석은 다음 글에서 다룰 **JDK Mission Control(JMC)** 같은 GUI 도구로 합니다. JFR이 "기록", JMC가 "재생·분석" 역할입니다.

## 정리

- JFR은 JVM에 내장된 저오버헤드(~1%) 이벤트 기록기다. JDK 11부터 오픈소스로 누구나 쓴다.
- 스냅샷(힙/스레드 덤프)과 달리 **시간축으로 연속 기록**해, 서서히 나빠지거나 간헐적인 문제를 잡는다.
- 비결은 **스레드-로컬 버퍼 → global ring buffer → .jfr** 구조. 락 경합 없이, 메모리는 고정 크기로 예측 가능하다.
- GC·할당·락 경합·메서드 샘플·I/O·예외를 기록한다. 특히 할당·메서드 샘플이 GC 압력과 CPU 핫스팟 추적에 강력하다.
- `-XX:StartFlightRecording` 또는 `jcmd ... JFR.start/dump`로 뜬다. 상시 기록 + 온디맨드 덤프가 실무 패턴이다.
- 기록된 `.jfr`은 다음 글의 JDK Mission Control로 분석한다.

---

**지난 글:** [스레드 덤프 — 멈춘 스레드와 데드락 진단](/posts/jvm-thread-dump/)

**다음 글:** [JDK Mission Control — JFR 기록 분석](/posts/jvm-mission-control/)

<br>
읽어주셔서 감사합니다. 😊
