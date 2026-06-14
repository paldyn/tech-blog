---
title: "Serial GC — 가장 단순한 단일 스레드 수집기"
description: "HotSpot에서 가장 단순한 가비지 컬렉터인 Serial GC를 정리합니다. 단일 스레드로 mark·copy·compact를 수행하는 DefNew(Young)와 Tenured(Old)의 구조, 전 과정 STW, 장단점, 그리고 -XX:+UseSerialGC를 언제 써야 하는지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "Serial GC", "DefNew", "Tenured", "Stop-The-World"]
featured: false
draft: false
---

[지난 글](/posts/gc-generational/)에서 약한 세대 가설과 Young/Old 세대 구조, Minor/Major GC의 구분을 정리했습니다. 이번 글은 그 세대 구조 위에서 동작하는 가장 단순한 수집기인 **Serial GC**를 다룹니다. 이름 그대로 모든 GC 작업을 단 하나의 스레드가 직렬(serial)로 처리하는 수집기로, HotSpot GC 계보의 출발점이자 다른 수집기를 이해하는 기준점입니다.

## Serial GC의 핵심 — 스레드 하나로 전부

Serial GC의 정의는 한 문장으로 끝납니다. **GC 작업을 단일 스레드가 직렬로 수행한다.** Minor GC든 Full GC든, mark(생존 표시)·copy(복사)·compact(압축) 어느 단계든 항상 하나의 GC 스레드만 일합니다. 그리고 그 스레드가 일하는 동안 애플리케이션 스레드는 전부 멈춥니다(Stop-The-World).

여기서 흔한 오해 하나를 짚고 넘어가야 합니다. "단일 스레드 GC라서 STW가 발생한다"가 아닙니다. STW는 거의 모든 stop-the-world 계열 수집기의 공통 비용이고, Serial GC의 특징은 **그 STW 구간을 단 하나의 GC 스레드가 채운다**는 점입니다. 코어가 여러 개여도 GC는 한 스레드만 씁니다.

![Serial GC가 단일 GC 스레드로 STW 구간을 직렬 처리하는 타임라인. Parallel GC와 대비](/assets/posts/gc-serial-single-thread.svg)

위 그림에서 보듯이, 애플리케이션 스레드(App T1~T3)가 모두 멈춘 STW 구간을 GC 스레드 **하나**가 mark에서 copy/compact까지 순서대로 처리합니다. 다음 글에서 다룰 Parallel GC가 같은 구간을 여러 스레드로 나눠 멈춤 시간을 줄이는 것과 정확히 대비됩니다.

## 구조 — DefNew(Young)와 Tenured(Old)

Serial GC도 세대별 GC입니다. 힙을 Young과 Old로 나누고 각 세대마다 다른 알고리즘을 씁니다. HotSpot 내부에서 Young 영역의 Serial 수집기는 **DefNew**, Old 영역의 수집기는 **Tenured**라는 이름으로 불립니다.

![Serial GC 구조 — DefNew는 단일 스레드 복사 수집기, Tenured는 단일 스레드 Mark-Sweep-Compact](/assets/posts/gc-serial-young-old.svg)

### Young 세대 — DefNew (복사 수집)

Young 세대는 Eden과 두 개의 Survivor(S0, S1)로 구성되고, **복사(copying) 알고리즘**을 단일 스레드로 수행합니다.

- 새 객체는 Eden에 할당됩니다.
- Eden이 차면 Minor GC가 발생하고, 살아남은 객체만 Survivor로 **복사**합니다.
- 복사 후 원래 영역은 통째로 비워지므로 **단편화가 생기지 않습니다.**
- 객체가 일정 나이(age)를 넘기면 Old로 **승격(promotion)**됩니다.

대부분의 객체가 금방 죽는다는 약한 세대 가설 덕분에, 복사해야 할 생존 객체는 보통 소수입니다. 그래서 Young 영역의 복사 수집은 단일 스레드라도 빠르게 끝납니다.

### Old 세대 — Tenured (Mark-Sweep-Compact)

Old 세대는 오래 살아남은 객체들이 모이는 곳이라 복사보다 압축이 유리합니다. Tenured는 **Mark-Sweep-Compact**를 단일 스레드로 수행합니다.

| 단계 | 하는 일 |
|---|---|
| Mark | GC Roots에서 도달 가능한 객체를 생존으로 표시 |
| Sweep | 표시되지 않은 객체(쓰레기)를 회수 |
| Compact | 생존 객체를 한쪽으로 모아 압축, 빈 공간을 합침 |

Compact 단계가 핵심입니다. 생존 객체를 한쪽으로 밀어 모으기 때문에 **단편화가 제거되고**, 이후 객체 할당이 단순한 포인터 이동(bump-the-pointer)으로 빨라집니다. 다만 힙 전체를 훑고 객체를 옮기는 작업이라 Old가 클수록 이 STW가 길어집니다.

## 장점과 단점

Serial GC의 장점과 단점은 동전의 양면입니다. 모두 "단일 스레드 + 단순함"에서 나옵니다.

**장점**

- **구현이 단순하다.** 스레드 간 동기화나 작업 분배 로직이 필요 없습니다.
- **메모리·CPU 오버헤드가 최소다.** 여러 GC 스레드를 위한 자료구조나 조율 비용이 없습니다.
- **작은 힙에서는 오히려 효율적이다.** 힙이 작으면 GC 작업량 자체가 적어서, 스레드를 여러 개 띄우고 조율하는 비용이 이득보다 큽니다. 이럴 때는 단일 스레드가 더 빠르게 끝납니다.

**단점**

- **힙이 커지면 STW가 길어진다.** 작업을 나눠 줄 동료 스레드가 없으니, 힙이 커진 만큼 멈춤 시간이 그대로 늘어납니다. 큰 힙·낮은 지연을 요구하는 서버에는 부적합합니다.

## 언제 쓰나

Serial GC가 잘 맞는 환경은 분명합니다.

- **작은 힙**(대략 수백 MB 이하)
- **단일 CPU**(코어 1개) 환경 — 병렬 수집의 이점이 어차피 없음
- **클라이언트(client class) 머신**의 기본값 — CLI 도구, 데스크톱 앱처럼 짧게 살고 지연에 둔감한 프로그램
- **CPU 1개로 제한된 컨테이너** — 클라우드/쿠버네티스에서 흔한 작은 사이드카·배치 워크로드

명시적으로 켜려면 다음 플래그를 씁니다.

```bash
# Serial GC 활성화 (Young=DefNew, Old=Tenured)
java -XX:+UseSerialGC -Xms256m -Xmx256m -jar app.jar

# 어떤 GC가 선택됐는지 확인
java -XX:+UseSerialGC -Xlog:gc -jar app.jar
# [0.123s][info][gc] Using Serial
```

동작을 모니터링할 때는 `jstat`으로 세대별 사용량과 GC 횟수를 볼 수 있습니다.

```bash
# 1초 간격으로 GC 통계 출력 (S0/S1/Eden/Old 사용률, YGC/FGC 횟수·시간)
jstat -gcutil <pid> 1000
#   S0     S1     E      O      M     CCS    YGC   YGCT    FGC   FGCT
#  0.00  98.41  62.10  41.30  95.2  90.1     12    0.084     1   0.231
```

여기서 `YGC`(Young GC 횟수)와 `FGC`(Full GC 횟수)가 늘어나는 속도, `YGCT`/`FGCT`(누적 시간)를 보면 STW가 얼마나 누적되는지 가늠할 수 있습니다.

## JVM ergonomics가 알아서 고른다

직접 플래그를 지정하지 않아도, JVM은 실행 환경을 보고 적당한 GC를 자동으로 고릅니다. 이를 **ergonomics**라고 합니다. 사용 가능한 CPU 수와 힙 크기를 기준으로 판단하는데, 대략 "**CPU 1개이거나 힙이 작은**" 환경이면 Serial GC가 선택될 수 있습니다. 멀티코어에 충분한 메모리가 있으면 G1 GC 같은 다른 수집기가 기본값이 됩니다.

이 점이 컨테이너 환경에서 특히 중요합니다. CPU를 1개로 제한한 컨테이너에서는 ergonomics가 Serial GC를 고를 수 있으므로, 의도와 다른 GC가 선택되는 상황을 피하려면 GC 플래그를 명시적으로 지정하는 편이 안전합니다.

## 정리

Serial GC는 **단일 스레드로 전 과정을 STW로 처리하는 가장 단순한 수집기**입니다. Young은 DefNew의 복사 수집으로 단편화 없이 빠르게, Old는 Tenured의 Mark-Sweep-Compact로 단편화를 제거하며 회수합니다. 단순함 덕분에 오버헤드가 최소이고 작은 힙에서는 오히려 효율적이지만, 힙이 커지면 단일 스레드 STW가 길어진다는 한계가 분명합니다. 그래서 작은 힙·단일 CPU·클라이언트 앱·1코어 컨테이너가 주 무대이고, 그 너머에서는 멈춤을 나눠 처리하는 수집기가 필요합니다.

다음 글에서는 같은 STW를 **여러 스레드로 나눠** 처리량을 끌어올리는 Parallel GC를 살펴보겠습니다.

---

**지난 글:** [세대별 GC — 약한 세대 가설과 Minor/Major GC](/posts/gc-generational/)

**다음 글:** [Parallel GC — 처리량을 위한 병렬 수집기](/posts/gc-parallel/)

<br>
읽어주셔서 감사합니다. 😊
