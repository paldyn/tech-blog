---
title: "Stop-The-World — GC가 애플리케이션을 멈추는 순간"
description: "GC가 안전하게 메모리를 정리하려면 모든 애플리케이션 스레드를 멈춰야 합니다. 그 멈춤(Stop-The-World)이 왜 필요한지, safepoint와 TTSP가 무엇인지, 한 번의 pause가 어떤 비용으로 채워지는지, 그리고 STW를 줄이는 현실적인 방향을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "Stop-The-World", "Safepoint", "TTSP", "JVM", "pause"]
featured: false
draft: false
---

[지난 글](/posts/gc-logs-reading/)에서 GC 로그 한 줄을 해부하며 pause 시간을 읽었습니다. 그 로그에 찍히는 `4.382ms` 같은 숫자가 바로 이번 글의 주인공입니다. GC는 메모리를 정리하는 동안 애플리케이션을 잠시 멈추는데, 이 멈춤을 **Stop-The-World(STW)** 라고 부릅니다. STW는 GC 성능 문제의 거의 모든 체감 증상 — 응답 지연, 간헐적 타임아웃, p99 튐 — 이 시작되는 지점입니다. 이번 글은 STW가 왜 필요하고, 내부적으로 어떤 절차로 일어나며, 무엇이 pause 시간을 길게 만드는지를 정리합니다.

## 왜 멈춰야 하는가

GC가 살아있는 객체와 죽은 객체를 가르려면 객체 그래프를 따라가며 도달 가능성(reachability)을 계산해야 합니다. 그런데 그 계산 도중에도 애플리케이션 스레드가 계속 객체를 만들고, 참조를 바꾸고, 필드에 새 주소를 쓴다면 어떻게 될까요? GC가 "이건 죽었다"고 판단한 객체를 바로 그 순간 애플리케이션이 다시 참조로 연결할 수 있습니다. 이미 회수한 메모리를 누군가 가리키고 있다면 그건 곧 크래시입니다.

특히 객체를 옮기는(moving) 수집기 — Serial·Parallel·G1·ZGC 등 — 는 객체의 메모리 주소 자체를 바꿉니다. 객체를 옮기는 동안 애플리케이션이 옛 주소로 접근하면 잘못된 메모리를 읽게 됩니다. 그래서 가장 단순하고 안전한 해법은 **"정리하는 동안에는 모두 멈춰라"** 입니다. 모든 애플리케이션 스레드를 일관된 한 시점에 정지시키면, GC는 변하지 않는 객체 그래프를 안심하고 다룰 수 있습니다.

![Stop-The-World 타임라인: 앱 스레드가 멈추고 GC 스레드가 일한다](/assets/posts/gc-stop-the-world-timeline.svg)

위 그림처럼 STW 구간에서는 애플리케이션 스레드 전부가 정지하고, 그 시간 동안 GC 스레드만 일합니다. 사용자 요청을 처리하던 스레드도 예외 없이 멈추므로, STW가 길면 그만큼 응답이 지연됩니다.

## Safepoint — 아무 데서나 멈출 수는 없다

스레드를 "그냥 OS 차원에서 멈추면" 될 것 같지만 그렇지 않습니다. 스레드가 객체 참조를 레지스터에 절반쯤 올려둔 상태, 또는 객체 주소를 계산하는 중간에 멈추면 JVM은 그 스레드의 스택과 레지스터에서 어떤 값이 "객체 참조"인지 정확히 알 수 없습니다. GC는 모든 스레드의 살아있는 참조 목록(루트 셋)을 정확히 알아야 하므로, 스레드는 **JVM이 그 상태를 신뢰할 수 있는 지점에서만** 멈춰야 합니다. 이 지점이 **safepoint** 입니다.

safepoint는 메서드 호출 경계, 루프의 백 엣지(back-edge), 할당 지점 등 JVM이 미리 정해둔 자리입니다. JVM이 STW를 시작하려 하면 "safepoint 요청" 플래그를 켜고, 각 스레드는 자신의 safepoint 검사(poll) 지점에 도달하는 순간 이를 발견하고 스스로 멈춰 섭니다. 모든 스레드가 safepoint에 도달해 정지하면 비로소 GC(정확히는 VM operation)가 시작됩니다.

```text
1. VMThread: "safepoint 필요" 플래그 ON
2. 각 앱 스레드: 다음 safepoint poll 지점에서 플래그 발견 → 멈춤
3. 모든 스레드가 멈출 때까지 대기  (← 이 대기 시간이 TTSP)
4. VM operation(GC) 수행
5. 플래그 OFF → 멈춘 스레드들 일제히 재개
```

## TTSP — 숨어 있는 pause 비용

여기서 자주 간과되는 비용이 **TTSP(Time-To-Safepoint)** 입니다. JVM이 safepoint를 요청한 뒤, 마지막 스레드가 실제로 멈추기까지 걸리는 시간입니다. GC 작업 자체가 1ms로 끝나도, 어떤 스레드가 safepoint poll 없는 긴 구간(예: safepoint 검사가 제거된 카운트 기반 루프, 거대한 배열 복사, JNI 네이티브 호출)에 들어가 있으면 그 스레드가 빠져나올 때까지 나머지 전부가 기다립니다. 결과적으로 측정되는 pause는 TTSP + GC 작업 시간입니다.

![STW pause 구성: TTSP + GC 작업 + 재개](/assets/posts/gc-stop-the-world-pause-anatomy.svg)

GC 로그만 봐서는 "GC가 빠른데 왜 pause가 길지?"가 잘 안 풀립니다. 이럴 때 TTSP를 따로 봐야 합니다. Unified Logging에서 safepoint 통계를 켜면 요청부터 정지까지의 시간이 드러납니다.

```bash
# safepoint 진입/소요 시간을 로그로 확인
java -Xlog:safepoint:file=safepoint.log -jar app.jar
```

출력에는 `Reaching safepoint`(= TTSP)와 `At safepoint`(= 실제 VM operation 시간)가 분리되어 찍힙니다. 전자가 비정상적으로 길면 GC 튜닝이 아니라 그 긴 루프나 네이티브 호출을 손봐야 한다는 신호입니다.

## STW를 줄이는 방향

STW를 완전히 없앨 수는 없지만, 줄이고 분산시키는 방향은 분명합니다.

- **수집기 선택**: G1은 young/혼합 수집을 점진적으로 쪼개 한 번의 pause를 짧게 유지합니다. ZGC·Shenandoah는 표시·재배치 대부분을 애플리케이션과 동시에(concurrent) 수행해 STW를 보통 1ms 미만으로 억제합니다. 지연이 핵심 지표라면 ZGC/Shenandoah가 강력한 선택지입니다.
- **힙 사이징**: 힙이 과도하게 크면 한 번의 작업량이 늘고, 너무 작으면 GC가 잦아집니다. 둘 다 STW 총량을 키웁니다.
- **할당 압력 줄이기**: 단기 객체를 덜 만들수록 young 수집 빈도가 줄어듭니다. 불필요한 박싱, 매 요청 로그 문자열 조립 등이 흔한 원인입니다.
- **TTSP 원인 제거**: safepoint poll이 없는 긴 카운트 루프나 오래 걸리는 JNI 호출을 쪼갭니다.

> ZGC/Shenandoah도 STW가 0은 아닙니다. 루트 스캔 등 일부 단계는 여전히 잠깐 멈춥니다. "concurrent = 멈춤 없음"이 아니라 "멈춤을 최소 단위로 줄였다"가 정확한 이해입니다.

## 정리

- GC는 객체 그래프를 안전하게 다루기 위해 모든 애플리케이션 스레드를 멈춘다 — 이것이 **Stop-The-World**다. 특히 객체를 옮기는 수집기에는 필수다.
- 스레드는 아무 데서나 멈출 수 없고, JVM이 참조 상태를 신뢰할 수 있는 **safepoint** 에서만 멈춘다.
- 측정되는 pause = **TTSP(safepoint 도달까지) + GC 작업 시간**. GC가 빨라도 TTSP가 길면 pause가 길어진다.
- `-Xlog:safepoint`로 TTSP와 실제 작업 시간을 분리해 보면 진단의 방향이 갈린다.
- STW를 줄이려면 수집기 선택(특히 ZGC/Shenandoah), 적정 힙 사이징, 할당 압력 감소, TTSP 원인 제거를 함께 본다.

---

**지난 글:** [GC 로그 읽기 — Unified Logging으로 진단하기](/posts/gc-logs-reading/)

**다음 글:** [OutOfMemoryError — 종류별 원인과 진단](/posts/jvm-out-of-memory/)

<br>
읽어주셔서 감사합니다. 😊
