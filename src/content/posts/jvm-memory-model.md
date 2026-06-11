---
title: "JVM 메모리 모델 — GC를 이해하기 위한 지도"
description: "GC 챕터의 출발점으로 JVM 메모리 구조를 GC 관점에서 재정리합니다. Heap의 세대 구조(Eden·Survivor·Old), TLAB 할당, 객체 승격 흐름, 약한 세대 가설, Metaspace와 비힙 영역의 수명 규칙을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "메모리 모델", "Heap", "Eden", "Survivor", "TLAB", "GC"]
featured: false
draft: false
---

[지난 글](/posts/java-old-date-pitfalls/)로 날짜·시간 챕터를 마치고, 이번 글부터 시리즈는 **JVM 메모리와 가비지 컬렉션** 챕터로 들어갑니다. 시리즈 초반 JVM 파트에서 런타임 데이터 영역과 힙 구조의 기초를 다룬 적이 있는데, 이번 글은 같은 지형을 **GC의 관점**에서 다시 그립니다. GC 로그를 읽고, 힙 덤프를 분석하고, GC 알고리즘의 차이를 이해하려면 "GC가 어떤 메모리를, 어떤 단위로, 왜 그렇게 나눠서 관리하는가"라는 지도가 먼저 머리에 있어야 하기 때문입니다.

## GC가 관리하는 영역과 아닌 영역

JVM 프로세스의 메모리는 크게 둘로 나뉩니다. GC가 주기적으로 청소하는 **Heap**, 그리고 각자의 수명 규칙으로 관리되는 **비힙 영역**입니다.

![GC 관점의 JVM 메모리 지도](/assets/posts/jvm-memory-model-areas.svg)

- **Heap**: `new`로 만든 모든 객체와 배열이 사는 곳. GC의 유일한 주 무대입니다
- **Metaspace**: 클래스 메타데이터. 네이티브 메모리에 있으며, 클래스로더가 언로드될 때 함께 해제됩니다 (Full GC가 트리거하기도 하지만 일반 객체처럼 수거되진 않습니다)
- **Code Cache**: JIT이 컴파일한 네이티브 코드 저장소. sweeper가 별도로 관리합니다
- **Thread Stacks**: 메서드 프레임과 지역 변수. 메서드가 리턴하면 프레임째 사라지므로 GC가 개입할 필요가 없습니다

"메모리 누수"라고 부르는 문제의 대부분, 그리고 GC 튜닝의 거의 전부가 Heap 이야기입니다. `OutOfMemoryError`의 종류가 `Java heap space`인지 `Metaspace`인지에 따라 봐야 할 영역이 완전히 달라진다는 점도 이 지도에서 나옵니다.

## 힙은 왜 세대로 나뉘는가 — 약한 세대 가설

힙을 단일 공간으로 두고 매번 전체를 뒤지는 GC는 힙이 커질수록 느려집니다. HotSpot의 전통적 GC들이 힙을 **Young/Old 세대로 나눈** 근거는 수십 년의 관측에서 나온 경험 법칙입니다.

> **약한 세대 가설(weak generational hypothesis)**: 대부분의 객체는 생성 직후 금방 도달 불가능해진다(일찍 죽는다).

요청 처리 중 만들어지는 DTO, 임시 문자열, 스트림 중간 객체를 떠올려 보세요. 응답이 나가면 전부 쓰레기입니다. 반면 커넥션 풀, 캐시, 싱글톤 빈처럼 오래 사는 객체는 소수입니다. 그렇다면 **"새 객체만 모인 작은 구역"을 자주, 빠르게 청소**하는 것이 전체를 뒤지는 것보다 압도적으로 효율적입니다. 이것이 세대별 수집(generational collection)의 핵심 아이디어이고, Young/Old 구분의 존재 이유입니다.

## 객체의 일생 — 할당부터 승격까지

세대 구조 위에서 객체 하나의 생애는 다음 경로를 따릅니다.

![객체의 일생 — 할당부터 승격까지](/assets/posts/jvm-memory-model-allocation.svg)

### 1. TLAB에서 태어난다

`new`가 실행되면 객체는 Young 세대의 **Eden**에 할당됩니다. 이때 모든 스레드가 Eden의 포인터 하나를 두고 경쟁하면 락 비용이 크기 때문에, 각 스레드는 Eden 안에 자기만의 버퍼인 **TLAB**(Thread-Local Allocation Buffer)을 미리 받아 둡니다. TLAB 내부 할당은 포인터를 객체 크기만큼 밀기만 하면 되는(bump-the-pointer) 몇 개의 기계어 명령 수준이라, "Java의 객체 할당은 C의 malloc보다 빠르다"는 말이 성립합니다.

```java
// 이 한 줄의 실제 비용:
// TLAB 포인터 증가 + 헤더 초기화 — 락 없음, 나노초 단위
Order order = new Order();
```

### 2. Minor GC에서 살아남으면 Survivor로

Eden이 가득 차면 **Minor GC**가 Young 세대를 청소합니다. 약한 세대 가설대로라면 이 시점에 Eden의 객체 대부분은 이미 죽어 있습니다. 살아 있는 소수만 **Survivor 공간**(S0/S1 중 비어 있는 쪽)으로 복사하고, Eden은 통째로 비웁니다. 죽은 객체에는 아무 비용도 들지 않는다 — 살아 있는 것만 옮긴다 — 는 것이 복사(copying) 방식의 묘미입니다.

Survivor가 두 개인 이유도 여기 있습니다. 매 Minor GC마다 살아남은 객체를 반대쪽 Survivor로 복사하면, 한쪽은 항상 비어 있어 메모리 단편화가 생기지 않습니다.

### 3. 나이가 차면 Old로 승격

객체는 Minor GC에서 살아남을 때마다 **나이(age)**가 1씩 증가하고, 임계값(`-XX:MaxTenuringThreshold`, 기본 15)에 도달하면 **Old 세대로 승격(promotion)**됩니다. Survivor에 다 안 들어갈 만큼 생존 객체가 많거나, Survivor보다 큰 대형 객체는 임계값과 무관하게 조기 승격되거나 Old에 직접 할당되기도 합니다.

Old 세대가 차오르면 Major GC(또는 Full GC)가 필요한데, Young보다 영역이 크고 생존율도 높아 일반적으로 훨씬 비쌉니다. **GC 튜닝의 상당 부분은 "일찍 죽을 객체가 Old로 승격되지 않게 하는 것"**이라고 요약할 수 있습니다.

## 세대 간 참조 문제 — card table

Young만 청소하는 Minor GC에는 한 가지 퍼즐이 있습니다. Old 객체가 Young 객체를 참조하고 있다면, Young만 스캔해서는 그 참조를 놓칩니다. 그렇다고 Minor GC마다 Old 전체를 스캔하면 세대 분리의 의미가 없습니다.

HotSpot의 해법은 **card table**입니다. Old 세대를 512바이트 단위 카드로 나누고, Old 객체의 필드에 참조가 써질 때마다 해당 카드를 "더럽다(dirty)"고 표시합니다(write barrier). Minor GC는 dirty 카드에 속한 영역만 추가로 스캔하면 됩니다. 모든 참조 쓰기에 미세한 비용을 지불하는 대신 Minor GC를 빠르게 유지하는 트레이드오프로, 이후 다룰 G1·ZGC의 remembered set과 barrier 개념의 원형입니다.

## 이 지도에서 나오는 실무 감각

- **할당은 싸다**: TLAB 덕분에 단명 객체 생성을 두려워할 필요가 없습니다. 어설픈 객체 재사용(풀링)은 오히려 객체를 오래 살려 Old를 오염시킵니다
- **누수의 전형적 패턴**: static 컬렉션이 잡고 있는 참조처럼 "죽지 못하는" 객체는 결국 Old에 쌓여 Full GC 반복과 `OutOfMemoryError: Java heap space`로 나타납니다
- **GC 로그의 어휘**: 다음 글부터 보게 될 `Minor GC`, `promotion failure`, `tenuring threshold` 같은 용어가 모두 이 지도 위의 사건들입니다

```bash
# 현재 JVM의 세대 크기 확인
java -XX:+PrintFlagsFinal -version | grep -E "NewSize|MaxTenuringThreshold"

# 힙 점유 현황 한눈에 (Eden/Survivor/Old 사용률)
jstat -gcutil <pid> 1000
```

## 정리

- GC의 주 무대는 Heap — Metaspace·스택·코드 캐시는 각자의 수명 규칙으로 관리된다
- 약한 세대 가설("대부분의 객체는 일찍 죽는다")이 Young/Old 세대 분리의 근거다
- 객체는 TLAB(Eden)에서 태어나 Minor GC를 견디며 Survivor를 왕복하고, 나이가 차면 Old로 승격된다
- 세대 간 참조는 card table + write barrier로 추적된다
- 튜닝의 큰 줄기는 "단명 객체가 Old로 승격되지 않게 하기"다

다음 글에서는 이 지도 위에서 GC가 실제로 무엇을 하는지 — 도달 가능성 판정과 GC 알고리즘의 큰 그림을 다룹니다.

---

**지난 글:** [레거시 Date·Calendar의 함정과 마이그레이션](/posts/java-old-date-pitfalls/)

**다음 글:** [가비지 컬렉션 개요 — 도달 가능성과 GC의 큰 그림](/posts/gc-overview/)

<br>
읽어주셔서 감사합니다. 😊
