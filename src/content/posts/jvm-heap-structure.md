---
title: "JVM Heap 구조 완전 분석"
description: "Eden·Survivor·Old Generation·Metaspace 세대 구조, TLAB 할당 원리, Minor/Major/Full GC 발생 조건, 그리고 운영 환경에서 Heap을 튜닝하는 핵심 JVM 옵션을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "Heap", "Young Generation", "Old Generation", "Metaspace", "TLAB", "GC", "Minor GC", "Full GC"]
featured: false
draft: false
---

[지난 글](/posts/jvm-runtime-data-areas/)에서 JVM 런타임 데이터 영역 전반을 살펴봤습니다. 그 중에서도 GC가 직접 관리하고 성능 문제의 대부분이 시작되는 **Heap**은 따로 깊게 파고들 가치가 있습니다. 이번 글에서는 Heap 내부의 세대 구조, 객체가 생성되어 소멸하기까지의 흐름, 그리고 운영 현장에서 자주 조정하는 JVM 플래그를 집중적으로 다룹니다.

## 왜 세대(Generation)를 나눌까

GC를 설계할 때 가장 중요한 관찰이 하나 있습니다. **대부분의 객체는 아주 짧게 살다 죽는다**는 것입니다. HTTP 요청 처리 도중 만들어지는 DTO, 루프 안에서 생성되는 임시 문자열, 스트림 파이프라인 내부의 중간 객체들이 대표적입니다. 이 가설을 **Generational Hypothesis**라고 부르며, JVM Heap 설계의 근거가 됩니다.

이 가설이 맞다면 전략이 명확해집니다. 새로 생긴 객체만 모아 두는 영역을 자주, 빠르게 청소하고, 오래 살아남은 객체는 따로 보관해 청소 빈도를 줄이면 됩니다. 이것이 Young Generation과 Old Generation으로 Heap을 나누는 이유입니다.

![JVM Heap 세대 구조](/assets/posts/jvm-heap-structure-generations.svg)

## Young Generation

`new` 키워드로 생성된 모든 객체의 최초 도착지입니다. 내부는 다시 세 공간으로 나뉩니다.

**Eden Space**는 객체가 처음 할당되는 곳입니다. Eden이 가득 차면 **Minor GC**가 트리거되어 살아있는 객체만 Survivor로 복사하고, 나머지는 즉시 회수합니다. Minor GC는 Young Generation만 대상으로 하기 때문에 보통 수 밀리초 이내에 끝납니다.

**Survivor 0 / Survivor 1**은 Eden에서 살아남은 객체를 교대로 보관합니다. Minor GC가 발생할 때마다 현재 Survivor(from)의 살아있는 객체와 Eden의 살아있는 객체를 반대쪽 Survivor(to)로 복사합니다. 이 과정에서 각 객체의 **age 카운터**가 1씩 올라갑니다. Survivor 공간 중 하나는 항상 비어 있어야 합니다.

```java
// 이 코드에서 각 객체의 운명은 다르다
void processRequest(Request req) {
    // 메서드 반환 후 참조 사라짐 → Eden에서 Minor GC로 즉시 회수
    String temp = req.getBody().trim();

    // 캐시에 저장되어 오래 살아남음 → Old Gen으로 Promotion
    cache.put(req.getId(), parseResult(temp));
}
```

### TLAB (Thread-Local Allocation Buffer)

Eden에 객체를 할당할 때마다 포인터를 이동시키는 작업은 멀티스레드 환경에서 경합이 발생할 수 있습니다. JVM은 이를 막기 위해 각 스레드에게 Eden의 작은 구획을 미리 할당합니다. 이것이 TLAB입니다. 스레드는 자신의 TLAB 안에서 lock 없이 포인터만 전진시켜 객체를 빠르게 할당합니다.

```
-XX:+UseTLAB          # 기본값 true, 거의 항상 ON
-XX:TLABSize=512k     # 스레드별 버퍼 크기 (기본값은 JVM이 자동 조정)
```

TLAB가 꽉 차면 새 TLAB를 요청하거나(여유가 있으면 빠름) Eden 전체에서 직접 할당(slow path)합니다.

## 객체 생명주기: Eden → Survivor → Old

![Heap 객체 생명주기](/assets/posts/jvm-heap-structure-object-lifecycle.svg)

Minor GC를 반복해서 살아남아 age가 임계값에 도달하면 객체는 Old Generation으로 **Promotion**됩니다. 기본 임계값은 15이지만, JVM이 Survivor 공간 사용률에 따라 동적으로 낮출 수도 있습니다.

```
# Promotion 관련 옵션
-XX:MaxTenuringThreshold=15   # age 임계값 (G1GC 기본 15)
-XX:+PrintTenuringDistribution # Minor GC마다 age 분포 출력
```

Old Generation이 가득 차면 **Major GC** 또는 **Full GC**가 발생합니다. Full GC는 Young/Old Generation 전체와 Metaspace를 한꺼번에 정리하며, 그 동안 모든 애플리케이션 스레드가 멈추는 **Stop-the-World(STW)** 시간이 수십 밀리초에서 수 초에 이를 수 있습니다.

## Old Generation과 Humongous 객체

일반적인 Promotion 경로 외에, 크기가 **Heap Region의 50% 이상**인 대형 객체는 Eden을 거치지 않고 바로 Old Generation의 Humongous Region에 할당됩니다(G1GC 기준). 대형 byte 배열, 대형 HashMap 등이 해당됩니다.

```java
// G1GC에서 Humongous 할당이 일어나는 예
byte[] bigBuffer = new byte[4 * 1024 * 1024]; // 4MB

// Humongous 할당은 Full GC 압박이 될 수 있으므로
// 가능하면 분할하거나 재사용(풀링)을 고려한다
```

## Metaspace

Java 8부터 PermGen이 사라지고 Metaspace가 그 역할을 대신합니다. 클래스 메타데이터, 메서드 바이트코드, 런타임 상수 풀, `static` 변수가 저장됩니다. Heap이 아닌 **Native Memory**를 사용하므로 기본적으로 OS가 허용하는 만큼 늘어납니다.

```
-XX:MetaspaceSize=128m        # 초기 Metaspace 크기 (첫 GC 트리거 임계값)
-XX:MaxMetaspaceSize=512m     # 상한선 (설정 안 하면 무제한)
```

클래스 언로딩이 제대로 되지 않으면(특히 리플렉션이나 동적 클래스 생성이 많은 환경) Metaspace가 지속적으로 증가하여 결국 `OutOfMemoryError: Metaspace`가 발생합니다.

## 핵심 JVM Heap 옵션 정리

```
# 크기
-Xms2g -Xmx2g          # 초기·최대 동일하게 → 크기 재조정 비용 제거
-XX:NewRatio=2          # Young : Old = 1 : 2 (기본값)
-XX:SurvivorRatio=8     # Eden : S0 : S1 = 8 : 1 : 1

# GC 알고리즘 선택
-XX:+UseG1GC            # Java 9+ 기본 (Region 기반, 균형 있는 처리량·지연)
-XX:+UseZGC             # Java 17+ 안정화 (매우 낮은 STW, 대용량 Heap)
-XX:+UseShenandoahGC    # Red Hat 제공 (ZGC와 유사 특성)

# 진단
-Xlog:gc*:file=/var/log/app-gc.log:time,uptime,level,tags
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp/heapdump.hprof
```

운영 환경에서 `-Xms`와 `-Xmx`를 동일하게 설정하는 이유는, JVM이 Heap을 늘리는 작업 자체가 GC와 맞물려 일시적인 지연을 유발하기 때문입니다. 처음부터 최대 크기로 고정하면 이 불확실성이 사라집니다.

## Minor GC vs. Full GC 비교

| 구분 | Minor GC | Full GC |
|------|----------|---------|
| 대상 | Young Generation | Heap 전체 + Metaspace |
| 빈도 | 높음 (수초~수분마다) | 낮음 (문제 상황에서 자주) |
| STW | 짧음 (수ms~수십ms) | 길음 (수십ms~수초) |
| 트리거 | Eden 꽉 참 | Old Gen 꽉 참, Metaspace 한계 등 |
| 목표 | 최소화하되 빠르게 | 빈도·시간 모두 최소화 |

GC 튜닝의 핵심은 **Full GC를 줄이는 것**입니다. 대부분의 객체가 Young Gen에서 소멸하도록 코드를 설계하고, Old Gen 사용률이 지속적으로 증가하는 원인(메모리 누수, 과도한 캐싱)을 제거하는 것이 출발점입니다.

---

**지난 글:** [JVM 런타임 데이터 영역](/posts/jvm-runtime-data-areas/)

**다음 글:** [JVM 실행 엔진](/posts/jvm-execution-engine/)

<br>
읽어주셔서 감사합니다. 😊
