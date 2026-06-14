---
title: "Parallel GC — 처리량을 위한 병렬 수집기"
description: "Parallel GC(Throughput Collector)가 여러 GC 스레드로 STW 구간을 단축해 처리량을 끌어올리는 원리, young/old 모두 병렬 수집하는 구조, UseParallelGC·ParallelGCThreads·UseAdaptiveSizePolicy·MaxGCPauseMillis·GCTimeRatio 튜닝, 그리고 지연 민감 서비스에는 부적합한 이유를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "Parallel GC", "Throughput Collector", "Stop-The-World", "처리량"]
featured: false
draft: false
---

[지난 글](/posts/gc-serial/)에서 우리는 가장 단순한 GC인 Serial GC를 봤습니다. 단일 스레드 하나가 마킹부터 압축까지 모든 일을 혼자 처리하는 구조였죠. 깔끔하지만 멀티코어 시대에는 명백한 낭비입니다. 8코어 머신에서 GC가 도는 동안 코어 7개가 놀고 있다면, 그 STW 시간을 줄일 여지가 분명히 있습니다. **Parallel GC**는 바로 그 여지를 공략합니다. 같은 일을 여러 GC 스레드가 나눠 처리해서, 멈추는 건 똑같이 멈추되 *더 짧게* 멈추는 것이 핵심 아이디어입니다.

## Parallel GC란 — Throughput Collector

Parallel GC는 다른 이름으로 **Throughput Collector(처리량 수집기)** 라고도 불립니다. 이 별명에 설계 철학이 그대로 담겨 있습니다. 한 번의 멈춤이 얼마나 짧은가(지연)보다, 전체 실행 시간 중 애플리케이션이 실제로 일한 비율(처리량)을 최대화하는 데 초점을 둔다는 뜻입니다.

Serial GC와 알고리즘 자체는 같은 계열입니다. young 영역은 **copying**, old 영역은 **mark-sweep-compact**를 씁니다. 차이는 단 하나, "혼자 하느냐 여럿이 하느냐"입니다. Serial이 스레드 1개로 순차 처리하던 작업을, Parallel은 여러 스레드가 분담합니다.

![여러 GC 스레드가 STW 구간을 함께 처리하는 타임라인](/assets/posts/gc-parallel-multi-thread.svg)

위 그림처럼 STW가 시작되면 애플리케이션 스레드는 모두 멈추지만, 그 정지 구간 안에서 GC 스레드 여러 개(T1~T4)가 동시에 일합니다. 같은 양의 쓰레기를 치워도 코어 수만큼 빨리 끝나므로, 멈춤 구간 자체가 짧아집니다. 멈춤이 짧아진 만큼 애플리케이션이 일하는 시간 비율, 즉 처리량이 올라갑니다.

## young도 old도 모두 병렬

Parallel GC의 내부 구현은 두 개의 컬렉터로 나뉩니다.

| 영역 | 컬렉터 이름 | 알고리즘 | 병렬 여부 |
|---|---|---|---|
| Young | **PSYoungGen** | copying (Eden → Survivor) | 병렬 |
| Old | **PSOldGen** | mark-sweep-compact | 병렬 |

여기서 "PS"는 Parallel Scavenge의 약자입니다. 중요한 점은 young 마이너 GC뿐 아니라 old 메이저 GC(풀 GC)까지 **양쪽 모두 멀티스레드로 동작**한다는 것입니다. 과거 일부 조합에서는 old 영역만 단일 스레드로 처리하기도 했지만, 현대의 `UseParallelGC`는 young/old 모두 병렬로 수집합니다.

## 활성화와 스레드 수 제어

JDK 8에서는 Parallel GC가 **기본 GC**였기 때문에 별도 옵션 없이도 켜져 있었습니다. JDK 9부터는 G1이 기본이 되었으므로, 이제는 명시적으로 선택해야 합니다.

```bash
# Parallel GC 활성화 (JDK 9+에서는 명시 필요)
-XX:+UseParallelGC

# GC 작업에 투입할 스레드 수 (기본값은 CPU 코어 수 기반)
-XX:ParallelGCThreads=8
```

`ParallelGCThreads`의 기본값은 보통 다음 공식을 따릅니다. 코어가 8개 이하면 코어 수 그대로, 그보다 많으면 `5/8 * N` 정도로 줄여 잡습니다. 컨테이너 환경에서는 cgroup이 인식한 CPU 한도를 기준으로 계산되므로, 컨테이너에 할당한 CPU와 실제 GC 스레드 수가 어긋나지 않는지 확인하는 것이 좋습니다.

## 적응형 크기 조정 — UseAdaptiveSizePolicy

Parallel GC의 또 다른 특징은 **적응형 크기 조정(Adaptive Size Policy)** 입니다. JVM이 런타임 통계를 보고 Eden, Survivor, old 영역의 크기와 승격 임계값(tenuring threshold)을 스스로 조정합니다.

```bash
# 적응형 크기 조정 (Parallel GC에서 기본 활성)
-XX:+UseAdaptiveSizePolicy
```

이 기능 덕분에 손으로 `NewRatio`, `SurvivorRatio` 같은 값을 일일이 튜닝하지 않아도 JVM이 워크로드에 맞춰 영역 비율을 맞춰 줍니다. 편리하지만 양날의 검이기도 한데, 영역 크기가 계속 바뀌면 GC 동작이 예측하기 어려워질 수 있습니다. 세밀하게 고정된 동작이 필요하다면 이 옵션을 끄고 영역 크기를 직접 지정하기도 합니다.

## 목표 지향 튜닝 — MaxGCPauseMillis와 GCTimeRatio

Parallel GC는 "이렇게 동작해라"라고 명령하는 대신, "이런 목표를 달성해라"라고 목표를 주는 방식의 튜닝을 지원합니다. 핵심 플래그는 두 가지입니다.

![처리량 중심 트레이드오프와 목표 지향 튜닝 플래그](/assets/posts/gc-parallel-throughput.svg)

```bash
# 목표: 한 번의 GC 멈춤을 이 값(ms) 이하로
-XX:MaxGCPauseMillis=200

# 목표: 처리량. GC 시간이 전체의 1/(1+N) 이하가 되도록
-XX:GCTimeRatio=99
```

`MaxGCPauseMillis`는 최대 멈춤 시간 *목표*입니다. JVM은 이 목표를 맞추려고 힙 영역 크기를 줄이는 등으로 조정하지만, 어디까지나 목표일 뿐 *보장*은 아닙니다. 값을 너무 작게 잡으면 영역을 잘게 쪼개 GC가 더 자주 발생해 오히려 처리량이 떨어질 수 있습니다.

`GCTimeRatio`는 처리량 목표입니다. `GCTimeRatio=99`이면 GC에 쓰는 시간이 전체의 `1/(1+99)`, 즉 1% 이하가 되도록 노력하라는 뜻입니다. 기본값은 99로, "전체 시간의 99%는 애플리케이션이 일하게 하라"는 처리량 중심 철학이 기본값에 그대로 드러납니다.

두 목표는 종종 충돌하므로, JVM은 멈춤 시간 → 처리량 → 힙 크기 순으로 우선순위를 두고 절충합니다.

## 모니터링 — jstat로 보는 처리량

Parallel GC가 어떻게 동작하는지는 `jstat`으로 들여다볼 수 있습니다.

```bash
# 1초 간격으로 GC 통계 출력 (PID 12345)
jstat -gcutil 12345 1000
```

출력의 `YGC`/`YGCT`(young GC 횟수·누적 시간), `FGC`/`FGCT`(풀 GC 횟수·누적 시간)를 보면 GC에 얼마의 시간을 쓰는지 가늠할 수 있습니다. 전체 가동 시간 대비 `YGCT + FGCT`의 비율이 작을수록 처리량이 좋다는 뜻입니다.

## 한계 — 처리량은 최고지만 STW는 그대로

Parallel GC의 강점은 분명합니다. 멀티코어를 충분히 활용하므로 **순수 처리량 측면에서는 여전히 가장 좋은 선택지 중 하나**입니다. 배치 잡, 대용량 데이터 처리, 야간 정산처럼 "총 처리량이 응답 지연보다 훨씬 중요한" 워크로드에 잘 맞습니다.

하지만 결정적인 한계가 있습니다. 병렬화로 STW를 *단축*할 수는 있어도 *제거*할 수는 없다는 점입니다. 모든 GC 작업은 여전히 애플리케이션을 완전히 멈춘 채 진행됩니다. 그리고 힙이 커지면 치워야 할 객체와 압축해야 할 메모리도 늘어나므로, 스레드를 아무리 늘려도 풀 GC의 STW는 다시 길어집니다. 수십 GB 힙에서는 한 번의 풀 GC가 수 초에 이르기도 합니다.

그래서 API 응답 시간이나 실시간성이 중요한 **지연 민감(latency-sensitive) 서비스에는 부적합**합니다. 이 지점이 바로 다음 세대 수집기들이 등장한 배경입니다. 동시(concurrent) 수집으로 STW 자체를 줄이려는 시도, 그 첫 주자가 CMS입니다.

## 정리

- Parallel GC는 **Throughput Collector**로, 여러 GC 스레드로 STW 구간을 단축해 처리량을 극대화한다.
- young은 **PSYoungGen(copying)**, old는 **PSOldGen(mark-sweep-compact)** 으로 **양쪽 모두 병렬** 수집한다.
- `-XX:+UseParallelGC`로 활성화하고 `-XX:ParallelGCThreads`로 스레드 수를, `-XX:+UseAdaptiveSizePolicy`로 적응형 크기 조정을 제어한다.
- `MaxGCPauseMillis`(멈춤 목표)와 `GCTimeRatio`(처리량 목표)로 목표 지향 튜닝을 한다.
- 처리량은 최고지만 힙이 크면 STW가 여전히 길어져 **지연 민감 서비스에는 부적합**하다.
- **JDK 8의 기본 GC**였으나 **JDK 9부터 G1**이 기본이 되었다.

---

**지난 글:** [Serial GC — 가장 단순한 단일 스레드 수집기](/posts/gc-serial/)

**다음 글:** [CMS GC — 동시 수집의 시작과 그 종말](/posts/gc-cms/)

<br>
읽어주셔서 감사합니다. 😊
