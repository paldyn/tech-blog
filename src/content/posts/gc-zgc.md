---
title: "ZGC — 컬러드 포인터와 초저지연 수집"
description: "ZGC는 힙 크기와 무관하게 STW를 1ms 미만으로 유지하는 초저지연 수집기입니다. 64비트 컬러드 포인터로 객체 상태를 인코딩하고, 로드 배리어로 동시 relocation 중에도 일관성을 self-healing으로 유지합니다. mark·relocate·remap이 거의 모두 concurrent하게 도는 구조, ZPage 기반 힙, multi-mapping의 메모리 비용, JDK 15 production-ready와 JDK 21 Generational ZGC까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "ZGC", "Colored Pointers", "Load Barrier", "초저지연", "Concurrent"]
featured: false
draft: false
---

[지난 글](/posts/gc-g1/)에서 G1 GC가 힙을 리전으로 쪼개고 정지 시간 목표(`-XX:MaxGCPauseMillis`)에 맞춰 수집 범위를 조절하는 모습을 봤습니다. G1은 한 번의 긴 멈춤을 여러 번의 짧은 멈춤으로 분산하는 데 성공했지만, 그 멈춤들의 총합과 한 번의 길이는 여전히 힙 크기와 객체 수에 영향을 받습니다. 힙이 수백 GB, 수 TB로 커지면 G1의 정지 시간도 따라서 늘어납니다. ZGC(Z Garbage Collector)는 바로 이 한계를 정면으로 깬, **힙 크기와 무관하게 정지 시간을 1ms 미만으로 유지하는 초저지연(low-latency) 수집기**입니다.

이번 글은 ZGC가 어떻게 "거의 멈추지 않는" 수집을 해내는지를 다룹니다. 핵심은 두 가지입니다. 포인터 안에 객체 상태를 담는 **컬러드 포인터(colored pointers)**, 그리고 참조를 읽을 때마다 끼어드는 **로드 배리어(load barrier)** 입니다. 이 둘의 조합이 마킹·재배치·재매핑을 거의 전부 애플리케이션과 동시에 돌릴 수 있게 만듭니다.

## ZGC가 노리는 것

ZGC의 설계 목표는 명확하고 야심찹니다.

- **STW 1ms 미만** — 한 번의 멈춤을 사람이 체감할 수 없는 수준으로 줄인다.
- **정지 시간이 힙 크기와 무관** — 힙이 8GB든 16TB든 멈춤 길이가 거의 같다. 이것이 ZGC의 가장 큰 차별점입니다.
- **수 TB 힙 지원** — 거대한 힙에서도 실용적으로 동작한다.

기존 수집기에서는 "힙을 키우면 멈춤이 길어진다"가 거의 법칙이었습니다. ZGC는 무거운 작업을 전부 동시(concurrent) 단계로 옮기고, STW로 남는 작업을 **힙 크기와 무관한 고정 비용** 으로 묶어버려 이 법칙을 깨뜨립니다.

## 컬러드 포인터 — 포인터에 상태를 담는다

64비트 시스템에서 포인터는 64비트지만, 실제 주소 공간은 그렇게 넓지 않습니다. ZGC는 이 여유 비트 중 일부를 **메타데이터(컬러) 비트** 로 사용합니다. 포인터의 하위 비트는 실제 객체 주소를 가리키고, 그 위에 객체의 현재 상태를 인코딩하는 색을 얹는 구조입니다.

![ZGC 컬러드 포인터와 로드 배리어의 자가 치유](/assets/posts/gc-zgc-colored-pointers.svg)

색에 쓰이는 메타데이터 비트는 다음 네 가지입니다.

| 비트 | 의미 |
|---|---|
| Marked0 / Marked1 | 이번 마킹 주기에 도달(live)했는지. 주기마다 0/1을 번갈아 써서 이전 주기의 흔적과 구분 |
| Remapped | 객체가 최신 주소로 갱신(remap)되었는지 |
| Finalizable | finalizer를 통해서만 도달 가능한 객체인지 |

한 시점에 포인터는 이 중 **하나의 색** 만 "좋은 색(good color)"으로 갖습니다. 즉 포인터의 색만 보면 그 참조가 지금 단계 기준으로 최신인지, 아니면 손봐야 하는 상태인지 즉시 판단할 수 있습니다. 객체 헤더를 따로 읽지 않고 **포인터 자체에서 상태를 읽는다** 는 것이 컬러드 포인터의 핵심입니다.

## 로드 배리어 — 읽을 때마다 검사하고 자가 치유

컬러드 포인터만으로는 부족합니다. 동시 재배치(concurrent relocation) 중에는 객체가 GC 스레드에 의해 다른 위치로 옮겨질 수 있고, 그동안에도 애플리케이션 스레드는 그 객체를 참조합니다. 옛 주소를 들고 있는 스레드가 깨진 포인터를 따라가면 안 됩니다.

ZGC는 **애플리케이션이 힙에서 참조를 로드(load)할 때마다** 짧은 검사 코드를 끼워 넣습니다. 이것이 로드 배리어입니다.

```java
// 참조를 읽을 때 JIT이 삽입하는 로드 배리어 (개념 코드)
ref = obj.field;
if (color(ref) != GOOD) {            // 색이 낡았으면 (bad color)
    ref = relocate_or_remap(ref);    // 새 위치를 찾고
    store(slot, ref);                // 포인터 슬롯을 갱신 (self-healing)
}
```

색이 최신이면 추가 작업 없이 그대로 사용하는 **빠른 경로** 입니다. 색이 낡았다면(옮겨진 객체를 가리키고 있다면) 배리어가 새 주소를 조회한 뒤, **그 참조가 담긴 슬롯 자체를 올바른 포인터로 다시 써 넣습니다.** 이것이 **self-healing(자가 치유)** 입니다. 한 번 고친 슬롯은 다음부터 good color이므로 다시 느린 경로를 타지 않습니다.

덕분에 ZGC는 "모든 참조를 한꺼번에 멈춰 세우고 고치는" STW 단계 없이, 애플리케이션이 자연스럽게 객체에 접근하는 흐름 속에서 점진적으로 포인터를 정리할 수 있습니다.

## 거의 모든 작업이 동시에 — 3개의 미세 STW

ZGC의 한 사이클은 마킹 → 재배치 → 재매핑으로 흐르는데, 이 무거운 작업들이 **거의 전부 애플리케이션과 동시에** 돕니다. STW로 남는 것은 단 세 개의 미세 멈춤뿐이고, 각각 sub-millisecond입니다.

![ZGC 타임라인 — 거의 모든 작업이 concurrent, STW는 3개의 미세 멈춤](/assets/posts/gc-zgc-concurrent.svg)

| 단계 | STW 여부 | 하는 일 |
|---|---|---|
| Pause Mark Start | **STW (sub-ms)** | 루트 스캔을 시작하고 마킹 색을 전환 |
| Concurrent Mark | 동시 | 객체 그래프 전체를 추적하며 live 표시 |
| Pause Mark End | **STW (sub-ms)** | 마킹 종료를 동기화 |
| Concurrent Relocate / Compact | 동시 | live 객체를 새 ZPage로 옮겨 단편화 해소 |
| Pause Relocate Start | **STW (sub-ms)** | 재배치 집합(relocation set)을 확정하고 루트 갱신 |
| Concurrent Remap | 동시 | 남은 옛 포인터를 로드 배리어로 점진 갱신 (다음 마킹과 겹침) |

세 STW는 모두 **루트 집합과 동기화 지점만 처리** 하므로, 작업량이 힙 전체 크기가 아니라 **GC 루트와 스레드 수** 정도에만 비례합니다. 그래서 힙을 아무리 키워도 멈춤 길이가 거의 변하지 않습니다. 위 그림 아래쪽처럼, 힙 크기 대비 정지 시간 곡선이 기존 GC는 우상향하지만 ZGC는 평평하게 유지됩니다.

재매핑(remap)은 별도의 거대한 단계가 아니라, 다음 사이클의 마킹과 겹쳐 로드 배리어가 객체를 만질 때마다 점진적으로 끝낸다는 점도 영리한 부분입니다.

## ZPage 기반 힙과 multi-mapping

ZGC도 힙을 region 단위로 관리합니다. ZGC의 region은 **ZPage** 라 부르며, Small / Medium / Large 세 종류의 크기로 객체를 담습니다. 재배치는 ZPage 단위로 일어나며, 비어가는 페이지의 live 객체를 새 페이지로 옮겨 압축(compaction)합니다.

컬러드 포인터를 실제 메모리 접근으로 바꾸기 위해 ZGC는 **multi-mapping** 을 씁니다. 색이 다른 여러 가상 주소(Marked0 뷰, Marked1 뷰, Remapped 뷰)를 **동일한 물리 메모리** 에 매핑해 두는 기법입니다. 덕분에 색이 어떻든 같은 객체에 도달할 수 있지만, 같은 물리 페이지가 여러 가상 주소에 매핑되므로 OS 도구(예: `top`의 가상 메모리)에서 메모리 사용량이 부풀려 보일 수 있습니다.

## 장점과 단점

ZGC의 강점은 분명하지만 공짜는 아닙니다.

| 항목 | 내용 |
|---|---|
| 장점 | 힙 크기와 무관한 sub-ms 정지, 수 TB 힙, 큰 힙에서도 안정적 응답 시간 |
| 단점 1 | 로드 배리어 때문에 약간의 **throughput overhead** — 처리량 위주 배치엔 Parallel GC가 유리 |
| 단점 2 | multi-mapping으로 **메모리를 더 씀** (가상 주소 측면), 메모리 회계가 직관적이지 않음 |

응답 시간이 SLA를 좌우하는 서비스, 거대한 힙을 다루는 애플리케이션이라면 약간의 처리량을 내주고도 ZGC가 압도적으로 유리합니다. 반대로 정지 시간보다 총 처리량이 중요한 일괄 작업에서는 다른 수집기가 나을 수 있습니다.

## G1과의 비교

| 항목 | G1 GC | ZGC |
|---|---|---|
| 목표 | 정지 시간 목표 내 처리량 균형 | 초저지연(sub-ms) 우선 |
| 정지 시간 | 힙·객체 수에 따라 증가 | **힙 크기와 무관, sub-ms** |
| 재배치(압축) | STW 중 evacuation | **동시 relocation** + 로드 배리어 |
| 배리어 | write barrier (SATB·remembered set) | **load barrier** (self-healing) |
| 포인터 | 일반 포인터 | **컬러드 포인터** (상태 인코딩) |
| 권장 힙 규모 | 수 GB ~ 수십 GB | 수 GB ~ **수 TB** |
| 메모리 비용 | 보통 | multi-mapping으로 더 큼 |

## 사용 방법과 도입 시점

ZGC는 다음 플래그로 켭니다.

```bash
# 기본 ZGC (단일 세대)
java -XX:+UseZGC -Xmx16g -jar app.jar

# JDK 21+ : Generational ZGC (세대 구분 추가, 권장)
java -XX:+UseZGC -XX:+ZGenerational -Xmx16g -jar app.jar
```

ZGC는 **JDK 15에서 production-ready** 로 정식 도입되었습니다. 그리고 **JDK 21에서 Generational ZGC(`-XX:+ZGenerational`)** 가 추가되어, 약한 세대 가설(weak generational hypothesis)을 활용해 젊은 객체를 더 자주·싸게 수집함으로써 처리량과 메모리 효율을 크게 개선했습니다. 새로 도입한다면 JDK 21 이상에서 Generational ZGC를 쓰는 것이 일반적인 권장 사항입니다.

수집 로그는 다음처럼 sub-ms 멈춤을 확인할 수 있습니다.

```
[gc] GC(42) Pause Mark Start 0.312ms
[gc] GC(42) Pause Mark End 0.205ms
[gc] GC(42) Pause Relocate Start 0.241ms
```

세 멈춤 모두 1ms 미만이고, 힙을 키워도 이 숫자가 거의 변하지 않는다는 점이 ZGC의 정체성입니다.

다음 글에서는 ZGC와 같은 초저지연 목표를 다른 방식 — Brooks 포인터와 동시 압축 — 으로 풀어낸 **Shenandoah GC**를 살펴봅니다.

---

**지난 글:** [G1 GC — 리전 기반 수집기와 정지 시간 목표](/posts/gc-g1/)

**다음 글:** [Shenandoah GC — Brooks 포인터와 동시 압축](/posts/gc-shenandoah/)

<br>
읽어주셔서 감사합니다. 😊
