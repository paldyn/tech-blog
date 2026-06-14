---
title: "세대별 GC — 약한 세대 가설과 Minor/Major GC"
description: "대부분의 객체는 일찍 죽는다는 약한 세대 가설에서 출발해, Eden/Survivor로 나뉜 Young 세대, Copying을 쓰는 Minor GC, MaxTenuringThreshold 기반 승격, Mark-Compact류 Old 세대, 그리고 Card Table로 교차 세대 참조를 추적하는 원리까지 세대별 GC를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "가비지 컬렉션", "세대별 GC", "Minor GC", "Major GC", "약한 세대 가설", "Card Table"]
featured: false
draft: false
---

[지난 글](/posts/gc-mark-sweep-compact/)에서 Mark-Sweep, Mark-Compact, Copying이라는 세 가지 기본 알고리즘과 각자의 트레이드오프를 살펴봤습니다. 그런데 실제 JVM은 이 알고리즘 중 하나를 힙 전체에 똑같이 적용하지 않습니다. 대신 힙을 **세대(generation)** 로 나누고, 영역마다 서로 다른 알고리즘을 쓰는 **세대별 GC(Generational GC)** 를 채택합니다. 이 글에서는 왜 힙을 굳이 나누는지, 그 분할이 어떻게 처리량을 끌어올리는지를 약한 세대 가설에서부터 차근차근 짚어봅니다.

## 약한 세대 가설 — 대부분의 객체는 일찍 죽는다

세대별 GC의 모든 설계는 단 하나의 경험적 관찰에서 출발합니다. 바로 **약한 세대 가설(weak generational hypothesis)** 입니다.

> 대부분의 객체는 생성된 직후에 죽는다. 오래 살아남은 객체일수록 앞으로도 더 오래 살 가능성이 높다.

실제 애플리케이션을 프로파일링해 보면 이 가설은 놀라울 만큼 잘 들어맞습니다. 메서드 안에서 잠깐 쓰고 버리는 지역 객체, 루프마다 새로 만드는 임시 문자열, 한 번의 요청을 처리하고 사라지는 DTO 같은 것들이 할당량의 대부분을 차지합니다. 반면 캐시, 커넥션 풀, 싱글톤처럼 오래 사는 객체는 수는 적지만 한 번 살아남으면 계속 살아남습니다.

여기서 핵심 통찰이 나옵니다. **객체 대부분이 금방 죽는다면, 그 "금방 죽는 영역"만 자주, 빠르게 청소하는 것이 효율적**이라는 것입니다. 힙 전체를 매번 훑는 대신, 새 객체가 모이는 작은 영역만 집중적으로 수집하면 적은 비용으로 많은 쓰레기를 회수할 수 있습니다.

## 힙의 구조 — Young과 Old

이 통찰을 구조로 옮긴 것이 힙의 세대 분할입니다. JVM의 힙은 크게 **Young Generation**과 **Old Generation(Tenured)** 으로 나뉘고, Young은 다시 **Eden** 하나와 **Survivor 두 개(S0, S1)** 로 나뉩니다.

![Young/Old 세대로 나뉜 힙 레이아웃과 Minor GC vs Major/Full GC의 수집 범위](/assets/posts/gc-generational-heap-layout.svg)

- **Eden**: 새로 생성되는 객체가 가장 먼저 할당되는 곳입니다. 대부분의 `new`는 여기에 떨어집니다.
- **Survivor (S0, S1)**: Minor GC에서 살아남은 객체가 잠시 머무는 곳입니다. 두 개를 두고 번갈아 쓰는 이유는 잠시 뒤 Copying에서 설명합니다.
- **Old**: Young에서 충분히 오래 살아남아 "이제 안 죽겠구나" 판정을 받은 객체가 옮겨가는 곳입니다.

수집 작업도 범위에 따라 이름이 다릅니다.

| 구분 | 수집 범위 | 빈도 / 비용 |
|---|---|---|
| **Minor GC** | Young 세대만 | 잦음 / 짧은 STW |
| **Major GC** | Old 세대 | 드묾 / 긴 STW |
| **Full GC** | 힙 전체(Young + Old) | 가장 드묾 / 가장 긴 STW |

Minor GC가 자주 일어나도 부담이 적은 이유는 Young 영역이 작고, 그 안의 객체 대부분이 이미 죽어 있어서 실제로 옮길 생존 객체가 거의 없기 때문입니다.

## Minor GC는 왜 Copying을 쓰는가

Young 세대 수집에는 [지난 글](/posts/gc-mark-sweep-compact/)에서 본 **Copying** 알고리즘이 쓰입니다. 약한 세대 가설과 Copying의 특성이 정확히 맞아떨어지기 때문입니다.

Copying의 비용은 **죽은 객체 수가 아니라 살아남은 객체 수에 비례**합니다. 살아 있는 객체만 다른 공간으로 복사하고, 원래 공간은 통째로 비워버리기 때문입니다. 죽은 객체는 따로 처리할 필요조차 없습니다. Young 세대는 약한 세대 가설에 따라 생존 객체 비율이 극히 낮으므로(보통 한 자릿수 %), 복사할 양이 적어 매우 빠릅니다.

게다가 Copying은 객체를 한쪽으로 차곡차곡 복사하므로 **단편화가 발생하지 않고**, 새 할당은 단순히 포인터를 밀어 올리는 bump-the-pointer 방식으로 처리됩니다. 빠른 할당과 빠른 수집을 동시에 얻는 셈입니다.

Survivor 공간이 두 개(S0, S1)인 것도 Copying 때문입니다. Minor GC가 일어나면 Eden과 현재 사용 중인 Survivor(예: S0)의 생존 객체를 비어 있는 다른 Survivor(S1)로 모두 복사합니다. 복사가 끝나면 Eden과 S0는 통째로 비워지고, 다음 번엔 S0와 S1의 역할이 뒤바뀝니다. 항상 Survivor 하나는 비어 있어야 복사 대상으로 쓸 수 있으므로 두 개가 필요합니다.

## 객체의 나이와 승격(Promotion)

복사가 일어날 때마다 살아남은 객체의 **나이(age)** 카운터가 1씩 증가합니다. 나이는 "이 객체가 Minor GC를 몇 번 견뎌냈는가"를 뜻합니다. 그리고 이 나이가 임계값에 도달하면 객체는 Young을 졸업하고 Old로 옮겨집니다. 이것을 **승격(promotion)** 또는 **tenuring**이라고 부릅니다.

![Eden 할당 후 Survivor 사이 복사로 나이가 증가하고, 임계값 도달 시 Old로 승격되는 과정과 Card Table을 통한 교차 세대 참조 추적](/assets/posts/gc-generational-promotion.svg)

임계값은 `-XX:MaxTenuringThreshold` 로 정해지며, HotSpot의 기본값은 15입니다(나이는 객체 헤더에 4비트로 저장되어 최대 15까지 표현됩니다). 다만 실제 승격 나이는 고정된 것이 아니라, Survivor 점유율을 보고 JVM이 동적으로 조절하기도 합니다(`-XX:TargetSurvivorRatio`).

핵심은 이렇습니다. **여러 번의 Minor GC를 견뎌낸 객체는 약한 세대 가설에 따라 앞으로도 오래 살 가능성이 높으므로, 더 이상 Young에서 반복해서 복사하지 말고 Old로 보내자**는 것입니다. 오래 살 객체를 계속 Survivor 사이에서 복사하는 것은 낭비이기 때문입니다.

다음은 이 동작과 관련된 주요 JVM 플래그입니다.

```bash
# Young 세대 크기를 256MB로 고정
-Xmn256m

# Eden : Survivor 비율 = 8 : 1 : 1 (Survivor 하나당 1)
-XX:SurvivorRatio=8

# 객체가 15번의 Minor GC를 견디면 Old로 승격
-XX:MaxTenuringThreshold=15

# Survivor 동적 승격 임계값 계산 시 목표 점유율(%)
-XX:TargetSurvivorRatio=50

# 객체 나이 분포 로그 출력 (튜닝 시 유용)
-Xlog:gc+age=trace
```

`-XX:SurvivorRatio=8` 이면 Young 영역이 Eden 8, S0 1, S1 1의 비율로 나뉩니다. Survivor 하나가 Young의 1/10밖에 안 되는 작은 공간이라는 점을 기억해 두면, 뒤에 나올 survivor overflow 문제가 이해됩니다.

## Old 세대는 Mark-Compact류

Old 세대에는 Copying을 쓰지 않습니다. Old에 도달한 객체는 생존 비율이 높아서, "살아남은 것만 복사한다"는 Copying의 장점이 오히려 단점이 됩니다. 복사할 양이 많을 뿐 아니라, 반쪽을 비워두는 Copying 구조상 Old 같은 큰 영역에서는 메모리 절반을 항상 노는 공간으로 낭비하게 됩니다.

그래서 Old는 보통 **Mark-Sweep-Compact** 계열로 수집합니다. 도달 가능한 객체를 표시(Mark)하고, 죽은 객체를 회수(Sweep)한 뒤, 살아남은 객체를 한쪽으로 모아 단편화를 없애는 압축(Compact)을 수행합니다. Copying처럼 여분의 공간이 필요 없고, 생존 객체가 많아도 메모리를 알뜰하게 씁니다. 대신 압축 과정에서 객체를 옮기고 참조를 갱신하는 비용이 크기 때문에, Old를 건드리는 Major/Full GC의 STW는 Minor GC보다 훨씬 깁니다.

이렇게 **영역의 생존 특성에 맞춰 알고리즘을 다르게 쓰는 것**이 세대별 GC의 본질입니다. 일찍 죽는 Young엔 Copying, 오래 사는 Old엔 Mark-Compact를 배치하는 식입니다.

## 왜 세대 구분이 처리량을 높이는가

세대별 GC가 처리량(throughput, 전체 시간 중 애플리케이션이 실제로 일한 비율)을 끌어올리는 이유는 명확합니다.

첫째, **자주 하는 일을 싸게 만듭니다.** 가장 빈번한 수집인 Minor GC가 작은 Young 영역만, 그것도 생존 객체만 복사하는 Copying으로 끝나므로 한 번의 STW가 매우 짧습니다.

둘째, **비싼 일을 드물게 만듭니다.** 오래 사는 객체를 Old로 격리해 두면, 매 수집마다 이들을 반복해서 검사할 필요가 없습니다. 죽지 않을 객체를 매번 표시하고 복사하는 헛수고를 줄이는 것입니다. 비싼 Major/Full GC는 Old가 꽉 찰 때까지 미뤄집니다.

결국 "수집할 가치가 높은 영역(쓰레기가 가득한 Young)을 골라 자주 청소하고, 청소해 봐야 건질 게 없는 영역(생존자가 많은 Old)은 어쩔 수 없을 때만 건드린다"는 전략이 전체 GC 비용을 크게 낮춥니다.

## 교차 세대 참조와 Card Table

여기서 한 가지 문제가 생깁니다. Minor GC는 Young만 수집하지만, 어떤 객체가 살아 있는지 판정하려면 **그 객체를 가리키는 모든 참조**를 알아야 합니다. 그런데 Old에 있는 객체가 Young의 객체를 참조하는 경우가 있습니다. 이런 **교차 세대 참조(cross-generational reference, Old→Young)** 까지 빠짐없이 찾으려면 원칙적으로 Old 전체를 스캔해야 하는데, 그러면 "Young만 본다"는 Minor GC의 장점이 무너집니다.

이 문제를 해결하는 자료구조가 **Card Table(카드 테이블)** 입니다. Old 영역을 일정한 크기(HotSpot 기준 512바이트)의 **카드**로 잘게 나누고, 각 카드마다 1바이트짜리 표시를 둡니다. Old의 객체가 Young을 가리키는 참조를 새로 쓸 때, JVM은 **write barrier**라는 작은 코드 조각을 통해 해당 카드를 "더티(dirty)"로 표시합니다.

```java
// 참조 필드에 쓰기가 일어나면
oldObj.field = youngObj;
// JVM이 내부적으로 write barrier를 끼워 넣어
// oldObj가 속한 카드를 dirty로 마킹한다.
```

그러면 Minor GC는 Old 전체가 아니라 **더티로 표시된 카드만** 스캔해서 교차 세대 참조를 GC Root처럼 취급하면 됩니다. 이렇게 추적된 참조 집합을 **Remembered Set**이라 부르고, Card Table은 그 구현 방식 중 하나입니다(G1 같은 컬렉터는 Region 단위의 Remembered Set을 따로 둡니다). 약간의 쓰기 오버헤드(write barrier)를 내는 대신, Minor GC가 Old를 통째로 훑는 비용을 없애는 트레이드오프입니다.

## 흔한 함정 — Premature Promotion과 Survivor Overflow

세대별 GC도 튜닝을 잘못하면 오히려 성능이 나빠집니다. 대표적인 두 가지 함정이 있습니다.

**Premature promotion(조기 승격).** 아직 죽을 운명이었던 객체가 임계값에 도달하기도 전에 Old로 넘어가 버리는 현상입니다. 주로 Survivor 공간이 너무 작거나 객체 할당이 폭발적일 때 발생합니다. 조기 승격된 객체들은 Old에서 곧 죽지만, Young의 빠른 Copying이 아니라 비싼 Major GC로만 회수됩니다. 결과적으로 Old가 빨리 차고 Full GC가 잦아집니다.

**Survivor overflow(서바이버 넘침).** Minor GC에서 살아남은 객체가 Survivor 공간 하나에 다 들어가지 못하는 경우입니다. 앞서 봤듯 Survivor는 Young의 1/10 정도로 작기 때문에, 한 번의 GC에서 생존자가 예상보다 많으면 넘쳐버립니다. 들어가지 못한 객체는 나이와 무관하게 즉시 Old로 승격되는데, 이것이 바로 premature promotion의 흔한 원인이기도 합니다.

두 문제 모두 **Young/Survivor 크기와 승격 임계값의 균형**이 핵심입니다. `-Xmn`으로 Young을 키우거나 `-XX:SurvivorRatio`를 낮춰 Survivor를 넉넉히 확보하면 객체가 Young에서 충분히 머물다 자연사할 시간을 벌 수 있습니다. 다만 Young을 너무 키우면 Old가 줄어 Major GC가 잦아지므로, `-Xlog:gc+age=trace`로 실제 나이 분포를 보면서 조정하는 것이 정석입니다.

## 정리

세대별 GC는 "대부분의 객체는 일찍 죽는다"는 약한 세대 가설을 힙 구조로 옮긴 설계입니다. 일찍 죽는 Young은 작게 나눠 Copying으로 자주 빠르게 청소하고, 오래 사는 Old는 Mark-Compact로 어쩌다 한 번 정리합니다. 그 사이를 잇는 것이 나이 기반 승격과 Card Table을 통한 교차 세대 참조 추적입니다. 이 세 가지 — 세대 분할, 영역별 알고리즘, 교차 참조 추적 — 가 맞물려 적은 비용으로 높은 처리량을 만들어냅니다. 다음 글에서는 이 세대 구조를 가장 단순하게 구현한 실제 컬렉터, **Serial GC**를 살펴봅니다.

---

**지난 글:** [GC 기본 알고리즘 — Mark-Sweep, Mark-Compact, Copying](/posts/gc-mark-sweep-compact/)

**다음 글:** [Serial GC — 가장 단순한 단일 스레드 수집기](/posts/gc-serial/)

<br>
읽어주셔서 감사합니다. 😊
