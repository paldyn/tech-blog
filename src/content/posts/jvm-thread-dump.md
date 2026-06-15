---
title: "스레드 덤프 — 멈춘 스레드와 데드락 진단"
description: "스레드 덤프는 모든 스레드의 현재 상태와 스택을 찍은 사진입니다. jstack·jcmd로 덤프를 뜨고, BLOCKED/WAITING 상태와 락 정보(waiting to lock / locked)를 읽어 응답 지연·행(hang)·데드락의 원인을 짚어내는 실전 절차를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "스레드 덤프", "Thread Dump", "jstack", "데드락", "BLOCKED", "진단"]
featured: false
draft: false
---

[지난 글](/posts/jvm-heap-dump/)에서 힙 덤프로 *메모리* 문제를 추적했다면, 이번에는 *동작* 문제를 봅니다. "응답이 갑자기 느려졌다", "특정 API가 멈춘 듯 응답이 없다", "CPU는 한가한데 처리량이 0이다" 같은 증상은 메모리가 아니라 스레드의 상태에서 답이 나옵니다. 이때 보는 것이 **스레드 덤프(thread dump)** 입니다. 스레드 덤프는 그 순간 JVM의 모든 스레드가 어떤 상태로, 어느 코드에서, 어떤 락을 두고 멈춰 있는지를 통째로 찍은 사진입니다. 이번 글은 스레드 덤프를 뜨고 읽어 행(hang)과 데드락을 진단하는 절차를 정리합니다.

## 스레드 덤프란

스레드 덤프는 힙 덤프와 달리 가볍습니다. 객체를 직렬화하는 게 아니라, 각 스레드의 **이름·상태·스택 트레이스·보유/대기 중인 락** 정보를 텍스트로 출력할 뿐입니다. 그래서 운영 중에도 부담 없이 여러 번 뜰 수 있습니다. 오히려 **여러 번 떠서 비교하는 것**이 핵심입니다 — 한 장만으로는 "지금 멈춰 있다"는 건 알아도 "계속 멈춰 있는지, 잠깐 지나가는 중인지"를 구분할 수 없기 때문입니다.

```bash
# 1) jstack — 가장 표준적인 방법
jstack <pid> > dump1.txt

# 2) jcmd — 권장. Thread.print가 jstack과 동일한 출력을 준다
jcmd <pid> Thread.print > dump1.txt

# 행 진단은 3~5초 간격으로 여러 장을 떠서 비교한다
for i in 1 2 3; do jcmd <pid> Thread.print > dump$i.txt; sleep 3; done
```

3~5초 간격으로 3장쯤 뜬 뒤, 같은 스레드가 **같은 위치에 계속 멈춰 있으면** 그곳이 병목이거나 행입니다. 매번 다른 위치라면 정상적으로 일하는 중일 뿐입니다.

## 한 블록을 읽는 법

스레드 덤프는 스레드마다 한 블록입니다. 첫 줄에 이름과 속성, 둘째 줄에 상태, 그 아래로 스택과 락 정보가 이어집니다.

![스레드 덤프 한 블록의 구조](/assets/posts/jvm-thread-dump-anatomy.svg)

핵심은 **상태**와 **락 정보** 두 가지입니다. 상태로 스레드가 무엇을 하는 중인지 큰 분류가 잡힙니다.

- **RUNNABLE**: 실제로 CPU를 쓰며 실행 중(혹은 I/O 대기). 여기 오래 머무는 스레드가 많고 CPU가 높으면 CPU 병목 — 어떤 메서드인지 스택을 본다.
- **BLOCKED**: 다른 스레드가 쥔 모니터 락(`synchronized`)을 기다리는 중. `waiting to lock <0x...>` 줄이 보인다.
- **WAITING / TIMED_WAITING**: `wait()`, `park()`, `sleep()`, 락 대기 등으로 능동적으로 기다리는 중. 스레드 풀의 유휴 스레드가 보통 여기 있다(정상).

락 정보의 두 줄이 진단의 열쇠입니다. `- waiting to lock <0x7f..a>`는 "이 주소의 락을 기다린다", `- locked <0x7f..b>`는 "이 주소의 락을 이미 쥐고 있다"는 뜻입니다. 어떤 스레드가 기다리는 락을 **다른 어떤 스레드가 쥐고 있는지**를 주소(`0x...`)로 맞춰 보면, 누가 누구를 막고 있는지 사슬이 그려집니다.

## 데드락 — 순환 대기 찾기

가장 극적인 케이스가 데드락입니다. 두 스레드가 서로 상대가 쥔 락을 기다리면, 둘 다 영원히 진행하지 못합니다.

![두 스레드의 순환 대기로 인한 데드락](/assets/posts/jvm-thread-dump-deadlock.svg)

스레드 덤프에서 데드락은 락 주소를 따라가면 보입니다. Thread-1이 `locked <A>`이면서 `waiting to lock <B>`이고, Thread-2가 `locked <B>`이면서 `waiting to lock <A>`라면 순환이 닫힌 것 — 데드락입니다. 다행히 JVM은 이 사슬을 자동으로 탐지해 덤프 끝에 친절하게 요약해 줍니다.

```text
Found one Java-level deadlock:
=============================
"Thread-1": waiting to lock <0x..b> held by "Thread-2",
            which is waiting to lock <0x..a> held by "Thread-1"
```

이 `Found ... deadlock` 블록이 보이면 거의 다 끝난 셈입니다. 위쪽 각 스레드의 스택에서 어느 코드가 `<A>`와 `<B>`를 잠갔는지를 찾아, **락을 항상 같은 순서로 획득**하도록 코드를 고치면 순환이 깨집니다.

> 모든 행(hang)이 데드락은 아닙니다. 외부 DB·HTTP 응답을 기다리며 RUNNABLE 상태로 멈춘 스레드, 풀이 고갈돼 작업이 큐에 쌓인 경우, `WAITING` 상태로 시그널을 못 받는 라이브락성 정체 등이 더 흔합니다. 그래서 상태 + 스택 + 락을 함께 읽는 것이 중요합니다.

## 실전 진단 흐름

- **증상 분류**: CPU 높음 → RUNNABLE 스레드의 스택을 본다. CPU 낮은데 멈춤 → BLOCKED/WAITING과 락을 본다.
- **여러 장 비교**: 같은 스레드가 같은 위치에 계속 있으면 그곳이 문제다.
- **데드락 자동 탐지 확인**: 덤프 끝의 `Found ... deadlock`을 먼저 본다.
- **락 사슬 추적**: `waiting to lock`의 주소를 `locked` 주소와 맞춰 누가 누구를 막는지 잇는다.
- **스레드 이름 활용**: 풀 스레드 이름(`http-nio-exec-N`, `ForkJoinPool-...`)으로 어느 컴포넌트인지 빠르게 짚는다.

## 정리

- 스레드 덤프는 모든 스레드의 **상태·스택·락**을 찍은 가벼운 사진. 운영 중 여러 번 떠서 비교하는 게 핵심이다.
- `jcmd <pid> Thread.print`(권장) 또는 `jstack <pid>`로 뜬다.
- 상태(RUNNABLE/BLOCKED/WAITING)로 큰 분류를 잡고, `waiting to lock`/`locked` 주소로 누가 누구를 막는지 추적한다.
- 데드락은 JVM이 `Found ... deadlock`으로 자동 요약해 준다. 처방은 **락 획득 순서 통일**이다.
- 다음 글에서는 이런 단발 스냅샷을 넘어, 시간축으로 연속 기록하는 JDK Flight Recorder를 다룬다.

---

**지난 글:** [힙 덤프 — 메모리 누수를 잡는 스냅샷 분석](/posts/jvm-heap-dump/)

**다음 글:** [JDK Flight Recorder — 저비용 상시 프로파일링](/posts/jvm-flight-recorder/)

<br>
읽어주셔서 감사합니다. 😊
