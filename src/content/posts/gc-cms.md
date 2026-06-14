---
title: "CMS GC — 동시 수집의 시작과 그 종말"
description: "CMS(Concurrent Mark-Sweep)는 old gen을 애플리케이션과 동시에 수집해 STW를 줄인 최초의 실용 collector입니다. 4단계 동작, concurrent의 대가(CPU 분할·write barrier·floating garbage), compaction을 하지 않아 생기는 단편화와 Concurrent Mode Failure, 그리고 JDK 9 deprecate·JDK 14 제거에 이르는 흥망을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "CMS", "Concurrent Mark-Sweep", "Stop-The-World", "단편화"]
featured: false
draft: false
---

[지난 글](/posts/gc-parallel/)에서 Parallel GC가 여러 스레드로 STW 시간을 압축해 처리량을 끌어올리는 모습을 봤습니다. 하지만 Parallel GC의 old gen 수집은 여전히 "전 스레드를 멈추고, 그동안 청소를 끝내는" 방식이라, 힙이 커질수록 한 번의 멈춤도 길어집니다. 응답 시간이 중요한 서비스에서는 이 한 번의 긴 멈춤이 곧 SLA 위반입니다. CMS(Concurrent Mark-Sweep)는 바로 이 문제를 정면으로 겨냥한, **old gen을 애플리케이션과 동시에 수집해 STW를 줄인 최초의 실용 collector**입니다.

이번 글은 CMS가 어떻게 멈춤을 잘게 쪼갰는지, 그 대가로 무엇을 지불했는지, 그리고 왜 결국 JDK에서 제거되었는지를 다룹니다. CMS는 사라졌지만, "수집기를 앱과 동시에 돌린다"는 발상 자체는 이후 G1·ZGC·Shenandoah로 이어지는 모든 동시 수집기의 출발점입니다.

## 발상의 전환 — 멈추지 말고 같이 돌자

기존 수집기의 old gen 수집은 단순합니다. 앱을 전부 멈추고(STW), GC 스레드가 마킹과 청소를 끝낸 뒤, 앱을 다시 깨웁니다. 청소가 오래 걸리면 멈춤도 그만큼 길어집니다.

CMS의 아이디어는 명쾌합니다. **가장 무거운 두 작업 — 전체 객체 그래프 마킹과 죽은 객체 스윕 — 을 앱이 도는 동안 동시에(concurrent) 수행**하면 어떨까? 그러면 앱을 멈추는 구간은 동시 작업이 불가능한 최소한의 시점으로 줄어듭니다.

물론 공짜는 아닙니다. 앱이 도는 동안 객체 그래프가 계속 바뀌므로, CMS는 변경을 추적하고 마지막에 보정하는 장치가 필요합니다. 이 보정 비용이 CMS의 4단계 구조와 여러 한계를 만들어냅니다.

## CMS의 4단계

CMS의 한 주기는 네 단계로 이루어집니다. 이 중 STW는 **Initial Mark**와 **Remark** 둘뿐이고, 둘 다 짧습니다. 무거운 작업인 **Concurrent Mark**와 **Concurrent Sweep**는 앱과 동시에 돕니다.

![CMS의 4단계 동시 수집 타임라인](/assets/posts/gc-cms-phases.svg)

| 단계 | STW 여부 | 하는 일 | 비용 |
|---|---|---|---|
| 1. Initial Mark | **STW (짧음)** | GC Roots가 직접 가리키는 객체만 마킹 | 매우 짧음 |
| 2. Concurrent Mark | 동시 | 마킹된 객체에서 그래프 전체를 추적 | 무겁지만 앱과 병행 |
| 3. Remark | **STW (짧음)** | 동시 마킹 중 바뀐 부분을 재확인 | 짧음 |
| 4. Concurrent Sweep | 동시 | 죽은 객체를 회수해 free list에 반환 | 무겁지만 앱과 병행 |

- **Initial Mark**: 루트에서 한 단계만 마킹하므로 빠르게 끝납니다. 전 스레드를 멈추지만 작업량이 작습니다.
- **Concurrent Mark**: 앱이 도는 동안 객체 그래프 전체를 추적합니다. 이때 앱이 참조를 바꾸면, 이미 검사한 객체가 새 객체를 가리키게 될 수 있습니다. CMS는 **write barrier**로 이런 변경이 일어난 영역(카드)을 더티로 표시해 둡니다.
- **Remark**: 동시 마킹 중 더티로 표시된 카드만 다시 훑어 누락을 보정합니다. 전체를 다시 보지 않으므로 짧게 끝납니다. STW가 필요한 이유는, 이 보정 순간만큼은 그래프가 더 이상 변하지 않아야 일관성을 보장할 수 있기 때문입니다.
- **Concurrent Sweep**: 죽은 객체를 회수합니다. 그런데 여기서 **compaction(압축)을 하지 않습니다.** 살아 있는 객체를 한쪽으로 모으지 않고, 죽은 객체가 있던 자리만 free list에 등록합니다. 이 선택이 CMS의 가장 큰 약점으로 이어집니다.

## concurrent의 대가

"앱과 동시에 돈다"는 것은 멈춤을 줄이는 대신 다른 비용을 지불한다는 뜻입니다. CMS가 치르는 대가는 세 가지입니다.

**1. CPU를 나눠 쓴다.** GC 스레드가 앱과 동시에 도는 동안 코어를 점유합니다. 멈춤은 짧아졌지만, 동시 구간 동안 앱이 쓸 수 있는 CPU가 줄어 처리량은 오히려 떨어질 수 있습니다. 지연 시간을 위해 처리량을 양보하는 셈입니다.

**2. write barrier 비용을 상시 지불한다.** 동시 마킹의 정확성을 위해, 앱이 참조를 쓸 때마다 해당 카드를 더티로 표시하는 코드(write barrier)가 끼어듭니다. GC가 돌지 않을 때도 이 비용은 항상 따라다닙니다.

**3. floating garbage가 생긴다.** 동시 마킹이 객체를 "살아 있다"고 표시한 뒤, 그 객체가 sweep 전에 죽을 수 있습니다. 이미 살아 있다고 표시됐으니 이번 주기에는 회수되지 못하고 다음 주기까지 남습니다. 이렇게 떠다니는 쓰레기를 floating garbage라 부릅니다.

또 하나 중요한 점: CMS는 **old gen이 꽉 차기 전에 미리** 수집을 시작해야 합니다. 동시 수집은 시간이 걸리는데, 그 사이에도 young gen에서 객체가 계속 승격(promotion)되기 때문입니다. 회수 속도가 채워지는 속도를 못 따라가면 사고가 납니다.

## 가장 큰 약점 — 단편화와 Concurrent Mode Failure

Concurrent Sweep는 청소만 하고 압축하지 않습니다. 그래서 시간이 지나면 old gen은 살아 있는 객체와 빈 조각이 뒤섞인 **단편화(fragmentation)** 상태가 됩니다.

![CMS의 단편화와 Concurrent Mode Failure](/assets/posts/gc-cms-fragmentation.svg)

총 여유 공간이 충분해도, 그 공간이 작은 조각으로 흩어져 있으면 큰 객체를 담을 **연속된 공간**이 없을 수 있습니다. 빈 조각은 free list로 관리되므로, 할당이 단순한 bump pointer(포인터를 끝으로 밀기)가 아니라 "적합한 크기의 조각 찾기"가 되어 비용이 더 듭니다.

여기서 두 가지 상황 중 하나라도 벌어지면 **Concurrent Mode Failure**가 발생합니다.

- 동시 수집이 채우는 속도를 못 따라가 old gen이 먼저 꽉 차는 경우
- 단편화로 인해 승격된 객체를 담을 연속 공간을 못 찾는 경우

Concurrent Mode Failure가 나면 CMS는 더 이상 동시로 버틸 수 없어 **Serial Old(단일 스레드 압축 수집기)로 폴백**합니다. 전 스레드를 멈추고, 단 하나의 스레드로 old gen 전체를 압축하는 **긴 STW Full GC**가 발생합니다. CMS가 그토록 피하려던 바로 그 길고 무거운 멈춤이, 단편화가 쌓인 최악의 순간에 터지는 것입니다. 이 폴백은 CMS 튜닝에서 가장 두려운 이벤트입니다.

## 사용법과 로그 읽기

CMS는 다음 플래그로 활성화했습니다. (구버전 JDK에서만 동작합니다.)

```text
-XX:+UseConcMarkSweepGC
-XX:CMSInitiatingOccupancyFraction=70   # old gen 70% 차면 동시 수집 시작
-XX:+UseCMSInitiatingOccupancyOnly      # 위 임계값만 사용(휴리스틱 끔)
```

`CMSInitiatingOccupancyFraction`을 너무 높게 잡으면 동시 수집이 늦게 시작돼 Concurrent Mode Failure 위험이 커지고, 너무 낮게 잡으면 수집이 잦아져 CPU 낭비가 됩니다. 이 임계값을 워크로드에 맞추는 것이 CMS 튜닝의 핵심이었습니다.

GC 로그에서는 4단계가 다음처럼 보입니다.

```text
[GC (CMS Initial Mark) ... 2.1 ms]
[CMS-concurrent-mark: 0.412/0.418 secs]
[GC (CMS Final Remark) ... 5.4 ms]
[CMS-concurrent-sweep: 0.305/0.310 secs]
```

두 STW(Initial Mark·Final Remark)는 합쳐 수 ms로 짧고, 무거운 mark/sweep는 `CMS-concurrent-*`로 앱과 동시에 진행됩니다. 반면 다음 줄이 보이면 단편화·승격 경쟁으로 폴백이 일어난 것이니 경계해야 합니다.

```text
(concurrent mode failure): ... [Full GC ...]
```

## 종말 — 그리고 G1으로

CMS는 동시 수집이라는 옳은 방향을 제시했지만, 구조적 한계가 분명했습니다. compaction을 하지 않아 단편화가 누적되고, 그 끝에는 긴 STW Full GC라는 폴백이 도사렸으며, write barrier와 CPU 분할로 처리량을 양보해야 했습니다. 무엇보다 튜닝이 까다로워, 워크로드가 바뀌면 Concurrent Mode Failure가 언제 터질지 예측하기 어려웠습니다.

그 대안으로 나온 것이 **G1 GC**입니다. G1은 힙을 리전(region)으로 나눠 부분적으로 압축하면서도 정지 시간 목표를 추구합니다. 단편화 문제를 구조적으로 완화한 것이죠. 결국 CMS는 **JDK 9에서 deprecated**되었고, **JDK 14에서 완전히 제거**되어 G1에게 자리를 넘겼습니다.

| 항목 | CMS | 비고 |
|---|---|---|
| 목표 | 낮은 지연 시간(짧은 STW) | old gen 동시 수집 |
| STW 구간 | Initial Mark · Remark (짧음) | mark/sweep는 동시 |
| compaction | **안 함** | → 단편화 누적 |
| 최악의 경우 | Concurrent Mode Failure → Serial Old Full GC | 긴 STW |
| 상시 비용 | write barrier, CPU 분할 | floating garbage |
| 현재 상태 | JDK 9 deprecate, JDK 14 제거 | G1으로 대체 |

## 정리

- CMS는 **old gen을 앱과 동시에 수집해 STW를 줄인 최초의 실용 collector**다
- 4단계 중 STW는 Initial Mark·Remark 둘뿐이고 짧으며, 무거운 mark/sweep는 concurrent로 돈다
- 대가는 **CPU 분할, write barrier 상시 비용, floating garbage** — 지연 시간을 위해 처리량을 양보한다
- Concurrent Sweep는 compaction을 안 해서 **단편화**가 쌓이고, free list 기반 할당이 된다
- 단편화·승격 경쟁이 한계에 닿으면 **Concurrent Mode Failure → Serial Old Full GC**라는 긴 STW로 폴백한다
- **JDK 9에서 deprecate, JDK 14에서 제거** — 동시 수집의 바통은 G1이 이어받았다

다음 글에서는 CMS의 한계를 구조적으로 푼 후계자, **G1 GC**를 해부합니다.

---

**지난 글:** [Parallel GC — 처리량을 위한 병렬 수집기](/posts/gc-parallel/)

**다음 글:** [G1 GC — 리전 기반 수집기와 정지 시간 목표](/posts/gc-g1/)

<br>
읽어주셔서 감사합니다. 😊
