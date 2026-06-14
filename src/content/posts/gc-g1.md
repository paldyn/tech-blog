---
title: "G1 GC — 리전 기반 수집기와 정지 시간 목표"
description: "G1(Garbage-First)은 힙을 동일 크기 region으로 잘게 나누고 역할을 동적으로 부여해, 정지 시간 목표(-XX:MaxGCPauseMillis) 안에서 회수 이득이 큰 region부터 비우는 수집기입니다. region 모델, evacuation 기반 compaction, concurrent marking cycle, Mixed GC, Remembered Set과 SATB write barrier 비용, Humongous 객체 처리, 그리고 튜닝 포인트를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "G1", "Garbage-First", "MaxGCPauseMillis", "region"]
featured: false
draft: false
---

[지난 글](/posts/gc-cms/)에서 CMS가 old gen을 앱과 동시에 수집해 멈춤을 잘게 쪼갰지만, compaction을 하지 않아 단편화가 쌓이고 결국 Concurrent Mode Failure라는 긴 STW로 무너지는 모습을 봤습니다. G1(Garbage-First)은 바로 이 한계를 구조적으로 푼 후계자입니다. G1은 힙을 **동일 크기의 region**으로 잘게 나누고, 각 region에 young/old 역할을 동적으로 부여한 뒤, **정지 시간 목표 안에서 회수 이득이 가장 큰 region부터** 비웁니다. "garbage-first"라는 이름이 곧 전략입니다.

이번 글은 G1이 힙을 어떻게 바라보는지(region 모델), 한 주기가 어떻게 흘러가는지(Young → 동시 마킹 → Mixed), 그리고 그 대가로 무엇을 지불하는지(Remembered Set과 write barrier)를 다룹니다. G1은 JDK 9부터 기본 GC가 되었고, 오늘날 가장 널리 쓰이는 범용 수집기입니다.

## region — 연속된 세대를 버리다

기존 수집기는 힙을 young gen과 old gen이라는 **연속된 큰 덩어리**로 나눴습니다. G1은 이 가정을 버립니다. 힙 전체를 보통 1~32MB 크기의 동일한 **region**으로 잘게 쪼개고, 각 region에 Eden / Survivor / Old / Humongous / Free 중 하나의 역할을 그때그때 부여합니다.

![G1 힙을 동일 크기 region의 격자로 나눈 구조](/assets/posts/gc-g1-regions.svg)

핵심은 **young과 old가 더 이상 물리적으로 연속이 아니라는 점**입니다. young은 "Eden·Survivor 역할을 맡은 region들의 집합", old는 "Old 역할을 맡은 region들의 집합"일 뿐이고, 이들은 힙 곳곳에 흩어져 있습니다. 역할은 고정이 아니라서, 비워진 Old region이 다음에는 Eden이 될 수도 있습니다.

| region 역할 | 의미 |
|---|---|
| Eden | 새 객체가 처음 할당되는 young region |
| Survivor | young 수집에서 살아남아 옮겨진 객체가 머무는 region |
| Old | 충분히 오래 살아 승격된 객체가 사는 region |
| Humongous | region 절반을 초과하는 큰 객체 전용 region |
| Free | 아직 역할이 없는 빈 region |

이 구조 덕분에 G1은 **힙 전체가 아니라 일부 region만 골라 수집**할 수 있습니다. 한 번에 비울 region 수를 조절하면 멈춤 시간을 제어할 수 있다는 뜻이고, 이것이 G1 설계의 출발점입니다.

## 정지 시간 목표 — 멈춤을 예산으로 다룬다

G1의 가장 큰 차별점은 **정지 시간을 목표로 직접 받는다**는 것입니다.

```bash
-XX:+UseG1GC                  # JDK 9+ 기본이라 보통 생략 가능
-XX:MaxGCPauseMillis=200      # 한 번의 STW 목표(기본 200ms)
-XX:InitiatingHeapOccupancyPercent=45   # old 점유율 45%면 동시 마킹 시작(IHOP)
```

`MaxGCPauseMillis`는 명령이 아니라 **목표(soft goal)**입니다. G1은 과거 수집들의 통계로 "region 하나를 비우는 데 평균 얼마가 걸리는지"를 학습해 두고, 다음 수집에서 이 목표 안에 들어오도록 **이번에 비울 region 수를 스스로 정합니다.** 목표를 너무 작게 잡으면 한 번에 적은 region만 비우게 되어 수집이 잦아지고 처리량이 떨어집니다. 보장이 아니라 예산이라는 점을 이해하는 것이 G1 튜닝의 출발입니다.

## 한 주기의 흐름 — Young, 동시 마킹, Mixed

G1의 수집은 크게 세 가지로 나뉩니다.

![G1의 수집 주기 — Young, Concurrent Mark, Mixed의 흐름](/assets/posts/gc-g1-collection-cycle.svg)

**1. Young Collection (evacuation).** 가장 자주 일어나는 기본 수집입니다. Eden·Survivor region의 살아 있는 객체를 빈 region으로 **복사(copying)**하고, 원래 region은 통째로 비웁니다. 이 복사가 곧 compaction 효과를 내므로 **CMS를 괴롭히던 단편화가 G1에는 없습니다.** 살아남은 객체는 Survivor를 거쳐 충분히 나이를 먹으면 Old region으로 승격됩니다.

**2. Concurrent Marking Cycle.** old 점유율이 IHOP 임계(`InitiatingHeapOccupancyPercent`, 기본 45%)에 닿으면, G1은 old region에 쓰레기가 얼마나 있는지 알아내기 위해 동시 마킹을 시작합니다.

| 단계 | STW 여부 | 하는 일 |
|---|---|---|
| Initial Mark | **STW (짧음)** | root가 직접 가리키는 객체 마킹 — young 수집에 piggyback |
| Concurrent Mark | 동시 | 객체 그래프 전체를 앱과 병행해 추적 |
| Remark | **STW (짧음)** | SATB로 추적한 변경분을 마무리해 마킹 일관성 확정 |
| Cleanup | 짧은 STW + 동시 | region별 산 객체량 집계, 완전히 빈 old region 즉시 회수 |

Initial Mark는 별도 STW를 만들지 않고 **Young Collection에 얹혀(piggyback)** 처리되는 점이 특징입니다. 동시 마킹이 끝나면 G1은 **어떤 old region에 쓰레기가 많은지**를 region 단위로 알게 됩니다. 이 정보가 다음 단계의 핵심 입력입니다.

**3. Mixed Collection (garbage-first).** 동시 마킹이 끝난 뒤 G1은 일반 Young 수집이 아니라 **Mixed 수집**을 몇 차례 수행합니다. Mixed는 young region 전부에 더해 **회수 이득이 큰(쓰레기가 많은) old region을 골라** 함께 evacuation합니다. 바로 이 "쓰레기가 많은 곳 먼저"가 garbage-first라는 이름의 뜻입니다.

이때 **한 번에 몇 개의 old region을 비울지를 정지 시간 목표가 결정**합니다. `MaxGCPauseMillis` 예산 안에 들어오는 만큼만 골라 비우고, 남은 old는 다음 Mixed 수집으로 미룹니다. 여러 번에 걸쳐 old를 나눠 정리하므로, old를 한 번에 통째로 비우던 과거의 긴 Full GC를 피할 수 있습니다.

## Remembered Set과 write barrier — region 모델의 대가

일부 region만 수집하려면 풀어야 할 문제가 있습니다. **"수집 대상 region 밖에서 안쪽 객체를 가리키는 참조"**를 어떻게 빠짐없이 찾을까요? 이걸 모르면 살아 있는 객체를 죽은 것으로 오해해 회수해버립니다.

G1은 각 region마다 **Remembered Set(RSet)**을 둡니다. RSet은 "다른 region에서 이 region을 가리키는 참조가 어디 있는지"를 기록한 자료구조입니다. 덕분에 G1은 전체 힙을 스캔하지 않고 RSet만 보면 region 밖에서 들어오는 참조를 알 수 있습니다.

RSet을 최신으로 유지하려면, 앱이 참조를 쓸 때마다 "이 쓰기가 region 경계를 넘었는가"를 검사하는 **write barrier**가 필요합니다. 이것이 G1이 상시 지불하는 비용입니다.

- **RSet 메모리**: region마다 RSet을 유지하므로 힙의 수 % 정도가 부가 자료구조에 쓰입니다.
- **write barrier CPU**: 모든 참조 쓰기에 barrier 코드가 끼어듭니다. 동시 마킹의 정확성을 위해 G1은 **SATB(Snapshot-At-The-Beginning)** 방식을 쓰는데, 마킹 시작 시점의 객체 그래프 스냅샷을 기준으로 삼고, 그 사이 끊긴 참조를 barrier로 기록해 누락 없이 마무리합니다.

정리하면, G1은 **"멈춤을 region 단위로 잘게 제어"하는 능력을 RSet 메모리와 write barrier CPU로 산** 셈입니다.

## Humongous 객체 — region을 넘는 큰 덩어리

region 절반 크기를 초과하는 객체는 일반 할당 경로를 타지 못합니다. G1은 이런 객체를 **Humongous 객체**로 분류해, 그 크기를 담을 수 있는 **연속된 region들에 직접 할당**합니다. 큰 배열 하나가 여러 region을 통째로 차지하는 식입니다.

Humongous 객체는 다루기가 까다롭습니다. 연속 region이 필요해 단편화에 민감하고, 일반 young 수집 경로로는 잘 회수되지 않아 old를 빠르게 채워 동시 마킹을 앞당길 수 있습니다. Humongous 할당이 잦다면 `G1HeapRegionSize`를 키워 객체가 "절반 초과" 기준에 걸리지 않게 만드는 것이 흔한 대응입니다.

## Full GC는 최후의 수단

G1의 정상 동작에는 전체 힙을 멈추고 통째로 비우는 Full GC가 들어 있지 않습니다. Full GC는 **회수 속도가 할당 속도를 못 따라가 힙이 고갈됐을 때만** 발생하는 비상 폴백입니다. 동시 마킹이 늦게 시작됐거나(IHOP가 너무 높음), Mixed 수집이 충분히 따라가지 못했거나, Humongous 할당이 폭주할 때 일어납니다.

초기 G1의 Full GC는 single-thread라 매우 느렸지만, **JDK 10부터 Full GC가 parallel로 동작**해 그 충격이 크게 줄었습니다. 그래도 Full GC는 여전히 "무언가 잘못되고 있다"는 신호이므로, GC 로그에서 보이면 IHOP·region 크기·힙 크기를 점검해야 합니다.

```text
[gc] GC(42) Pause Young (Normal) (G1 Evacuation Pause) 512M->210M(2048M) 18.3ms
[gc] GC(57) Pause Young (Concurrent Start) (G1 Humongous Allocation) ...
[gc] GC(63) Pause Mixed (G1 Evacuation Pause) 980M->430M(2048M) 47.1ms
[gc] GC(71) Pause Full (G1 Compaction Pause) 2010M->1180M(2048M) 1430ms
```

`Pause Young`·`Pause Mixed`는 목표 안에서 짧게 끝나지만, `Pause Full`이 보이면 위에서 말한 비상 상황입니다.

## 튜닝 포인트

G1은 "목표만 주고 나머지는 맡긴다"가 기본 철학이라, 손댈 노브가 다른 수집기보다 적습니다. 그래도 다음 두 가지는 자주 쓰입니다.

| 플래그 | 역할 | 조정 방향 |
|---|---|---|
| `-XX:MaxGCPauseMillis` | 한 번의 STW 목표(기본 200ms) | 작게 → 멈춤↓ 처리량↓ / 크게 → 멈춤↑ 처리량↑ |
| `-XX:G1HeapRegionSize` | region 크기(1~32MB, 2의 거듭제곱) | Humongous 잦으면 키워 일반 할당으로 흡수 |
| `-XX:InitiatingHeapOccupancyPercent` | 동시 마킹 시작 임계(IHOP, 기본 45%) | Full GC 잦으면 낮춰 마킹을 더 일찍 시작 |

가장 먼저 건드릴 것은 보통 `MaxGCPauseMillis`이고, Full GC가 보이면 IHOP를 낮추거나 힙을 키우는 순서로 접근합니다. region 크기는 Humongous 문제가 명확할 때만 손대는 것이 좋습니다.

## 정리

- G1은 힙을 **동일 크기 region(보통 1~32MB)**으로 나누고 역할을 동적으로 부여한다 — young/old는 흩어진 region 집합이다
- **정지 시간 목표(`MaxGCPauseMillis`, 기본 200ms)** 안에서 회수 이득이 큰 region부터 비운다 ("garbage-first")
- 모든 수집이 **evacuation(=copying)**이라 compaction 효과를 내고 **단편화가 없다** — CMS의 약점을 구조적으로 해결
- 한 주기는 **Young → Concurrent Marking Cycle(Initial Mark·Concurrent Mark·Remark·Cleanup) → Mixed**로 흐른다
- 일부 region만 수집하려고 **Remembered Set + write barrier(SATB)** 비용을 상시 지불한다
- region 절반 초과 객체는 **Humongous**로 연속 region에 직접 할당된다
- **JDK 9부터 기본 GC**, Full GC는 최후의 수단(**JDK 10부터 parallel full GC**로 충격 완화)
- 튜닝은 `MaxGCPauseMillis` → `InitiatingHeapOccupancyPercent` → `G1HeapRegionSize` 순으로 접근한다

다음 글에서는 멈춤 자체를 ms 단위로 끌어내린 초저지연 수집기, **ZGC**를 컬러드 포인터부터 해부합니다.

---

**지난 글:** [CMS GC — 동시 수집의 시작과 그 종말](/posts/gc-cms/)

**다음 글:** [ZGC — 컬러드 포인터와 초저지연 수집](/posts/gc-zgc/)

<br>
읽어주셔서 감사합니다. 😊
