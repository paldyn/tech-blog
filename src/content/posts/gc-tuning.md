---
title: "GC 튜닝 — 수집기 선택과 힙 사이징 전략"
description: "GC 튜닝의 3대 원칙(측정 먼저·한 번에 하나씩·목표 명확히)부터 처리량/지연/footprint 트레이드오프, 수집기 선택 기준(Parallel·ZGC·G1·Serial), -Xms=-Xmx 힙 사이징과 young 비율·Metaspace, MaxGCPauseMillis·GCTimeRatio·ParallelGCThreads·ConcGCThreads 같은 목표지향 플래그, allocation rate를 줄이는 코드 최적화, 흔한 안티패턴, 그리고 container-aware(UseContainerSupport·MaxRAMPercentage) 설정까지 실전 절차로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "GC 튜닝", "수집기 선택", "힙 사이징", "MaxGCPauseMillis", "G1 GC", "ZGC", "container-aware"]
featured: false
draft: false
---

[지난 글](/posts/gc-shenandoah/)에서 우리는 Brooks 포인터로 동시 압축을 해내는 Shenandoah를 봤습니다. 여기까지 오면서 Serial부터 ZGC까지 수집기들의 내부 동작을 차례로 뜯어봤죠. 그런데 막상 운영 서버 앞에 앉으면 질문은 더 단순해집니다. "그래서 우리 서비스엔 뭘 쓰고, 힙은 얼마로 잡아야 하나요?" 이 글은 그 실전 질문에 답합니다. 수집기의 원리가 아니라 **선택과 설정의 전략**, 즉 GC 튜닝을 다룹니다.

## 튜닝에 앞서 — 세 가지 원칙

GC 튜닝에서 초보와 숙련자를 가르는 건 플래그 지식이 아니라 태도입니다. 다음 세 원칙을 어기면 아무리 좋은 플래그도 독이 됩니다.

**1. 측정이 먼저다.** GC 로그도 없이 플래그부터 바꾸는 것은 눈 감고 운전하는 것과 같습니다. 무엇이 문제인지(긴 멈춤? 잦은 Full GC? 높은 CPU?) 데이터로 확인하기 전엔 손대지 않습니다.

**2. 한 번에 하나씩 바꾼다.** 플래그 다섯 개를 동시에 바꾸고 좋아졌다면, 어느 것이 효과였는지 알 수 없습니다. 변경은 하나씩, 그리고 같은 부하로 비교합니다.

**3. 목표를 명확히 정한다.** "GC를 빠르게"는 목표가 아닙니다. GC 성능은 세 축의 트레이드오프이고, 셋을 동시에 최적화할 수는 없습니다.

| 목표 | 의미 | 대표 지표 | 강한 수집기 |
|---|---|---|---|
| 처리량 (Throughput) | 전체 시간 중 앱이 일한 비율 | GC 시간 비율 | Parallel |
| 지연 (Latency) | 한 번의 멈춤 길이 | p99/p999 pause | ZGC, Shenandoah |
| 메모리 (Footprint) | 같은 일에 드는 힙·CPU | RSS, 힙 크기 | Serial |

배치 잡은 처리량이, API 서버는 지연이, 사이드카·CLI는 footprint가 중요합니다. **무엇을 우선할지 먼저 정하고, 나머지는 양보한다** — 이것이 튜닝의 출발점입니다.

## 수집기 선택 기준

목표가 정해지면 수집기는 대체로 자동으로 따라옵니다. 아래 결정 흐름이 출발점입니다.

![목표에 따라 Parallel·ZGC·G1·Serial을 고르는 수집기 선택 결정 흐름](/assets/posts/gc-tuning-collector-selection.svg)

- **처리량 우선, 멈춤 길이 무관** → **Parallel GC** (`-XX:+UseParallelGC`). 야간 배치, 대용량 ETL처럼 응답성보다 총 처리량이 중요할 때 최선입니다.
- **지연 우선 + 큰 힙** → **ZGC** (`-XX:+UseZGC`, JDK 21+ 기본 Generational). 수십 GB~TB 힙에서도 멈춤이 1ms 안쪽입니다. 동급으로 Shenandoah도 후보입니다.
- **균형 / 잘 모르겠음** → **G1 GC** (`-XX:+UseG1GC`, JDK 9+ 기본값). 처리량과 지연을 절충하며, 대부분의 서버 워크로드에서 합리적인 첫 선택입니다.
- **작은 힙 / 단일코어** → **Serial GC** (`-XX:+UseSerialGC`). 컨테이너 1 vCPU, 힙 수백 MB 이하라면 동시 수집기의 오버헤드가 오히려 손해입니다.

핵심은 **확신이 없으면 G1으로 시작하라**는 것입니다. 그리고 측정 없이 ZGC/Shenandoah로 갈아타지 마십시오. 동시 수집은 멈춤을 줄이는 대신 CPU와 footprint를 더 씁니다 — 공짜 점심은 없습니다.

## 힙 사이징

수집기를 골랐다면 다음은 힙 크기입니다. 잘못된 힙 사이징은 어떤 수집기를 써도 성능을 망칩니다.

![Xms=Xmx, young/old 비율, Metaspace, 그리고 처리량/지연/footprint pick-two 트레이드오프 삼각형](/assets/posts/gc-tuning-heap-sizing.svg)

**-Xms = -Xmx (운영에선 동일하게).** 초기 힙(`-Xms`)과 최대 힙(`-Xmx`)을 다르게 두면 JVM이 런타임에 힙을 늘렸다 줄였다 합니다. 이 리사이즈는 Full GC를 유발하고 OS에서 메모리를 반환·재획득하는 비용을 만듭니다. 운영 환경에서는 둘을 같게 고정해 이 변동을 없앱니다.

**young vs old 비율.** young이 작으면 minor GC가 잦아지고, 너무 크면 한 번의 minor GC가 길어지거나 old가 부족해집니다. `-Xmn`으로 young 크기를 직접 지정하거나 `-XX:NewRatio`로 비율을 줍니다(`NewRatio=2` → young:old = 1:2). 단, G1은 region 기반이라 보통 `-Xmn`을 고정하지 않고 수집기에 맡깁니다.

**Metaspace.** 클래스 메타데이터는 힙이 아니라 네이티브 메모리(Metaspace)에 있습니다. 클래스가 많은 앱(스프링, 동적 프록시)은 `-XX:MetaspaceSize`로 초기값을 키워 초기 Full GC를 줄이고, `-XX:MaxMetaspaceSize`로 상한을 둬 누수 시 OOM을 빠르게 노출시킵니다.

| 플래그 | 역할 | 권장 |
|---|---|---|
| `-Xms` / `-Xmx` | 초기/최대 힙 | 운영에선 동일 |
| `-Xmn` | young 크기 직접 지정 | Parallel/Serial에서 유효 |
| `-XX:NewRatio` | old:young 비율 | 기본 2 |
| `-XX:MetaspaceSize` | Metaspace 초기 | 클래스 많으면 상향 |
| `-XX:MaxMetaspaceSize` | Metaspace 상한 | 누수 조기 발견용 |

## 목표지향 플래그

힙을 잡았으면 이제 목표를 수집기에게 직접 알려줍니다. 현대 수집기는 "이만큼 멈춰도 돼" 또는 "이만큼 일에 집중해"라는 힌트를 받아 스스로 조정합니다.

- **`-XX:MaxGCPauseMillis`** — 목표 멈춤 시간(soft goal). G1/ZGC가 이 목표를 맞추려 young 크기와 수집 빈도를 조절합니다. 너무 작게 잡으면 GC가 잦아져 처리량이 떨어지니, 실제 SLA에 맞춰 현실적으로 둡니다(예: 200).
- **`-XX:GCTimeRatio`** — 처리량 목표. `GCTimeRatio=N`이면 GC에 쓰는 시간을 전체의 `1/(1+N)` 이하로 유지하려 합니다(`N=19` → 5% 이하). 클수록 처리량을 강하게 요구합니다.
- **`-XX:ParallelGCThreads`** — STW 단계에서 일하는 GC 스레드 수. 기본은 코어 수 기반. 한 호스트에 여러 JVM이 떠 있으면 과다 산정되므로 명시적으로 낮춰줘야 할 때가 있습니다.
- **`-XX:ConcGCThreads`** — 동시(앱과 같이 도는) 단계의 스레드 수. 보통 `ParallelGCThreads`보다 작게 잡아 앱 스레드와 CPU를 나눠 씁니다.

`MaxGCPauseMillis`(지연 ↓)와 `GCTimeRatio`(처리량 ↑)는 서로 반대 방향으로 당기는 손잡이입니다. 둘 다 강하게 줄 수는 없습니다 — 결국 위 삼각형의 pick-two로 돌아옵니다.

## 코드 차원의 최적화 — allocation rate 줄이기

플래그 튜닝에는 천장이 있습니다. GC가 처리하는 일의 양 자체가 너무 많다면, 진짜 해법은 **객체를 덜 만드는 것**입니다. GC 비용은 곧 **allocation rate(초당 할당량)** 에 비례합니다. 같은 처리량이라도 가비지를 적게 만들면 GC가 덜 돕니다.

- **불필요한 객체 생성 제거** — 루프 안의 `new`, 박싱(`Integer` vs `int`), 임시 컬렉션을 줄입니다.
- **스트림/문자열 주의** — 거대 컬렉션에 대한 무분별한 `stream().map().collect()` 체인, `String` 연결 누적은 단명 객체를 폭발시킵니다. `StringBuilder`, 기본형 스트림을 활용합니다.
- **버퍼·객체 재사용** — 풀링이나 `ThreadLocal` 버퍼로 hot path의 재할당을 피합니다(단, 누수·복잡도와 균형).
- **자료구조 적정화** — 초기 용량을 미리 지정해 컬렉션 내부 배열의 반복 리사이즈(와 그 가비지)를 막습니다.

객체를 절반으로 줄이면 어떤 GC 플래그보다 큰 효과가 납니다. 튜닝의 상한선은 결국 코드가 정합니다.

## 흔한 안티패턴

- **과도한 힙.** "메모리 많으니까 -Xmx를 크게"는 함정입니다. 힙이 크면 Full GC 한 번의 멈춤이 그만큼 길어지고, OS 페이지·캐시 효율도 떨어집니다. 필요한 만큼만 줍니다.
- **GC 플래그 남발.** 블로그에서 본 플래그를 의미도 모르고 10개씩 붙이는 경우. 플래그끼리 충돌하거나 JVM의 ergonomics(자동 조정)를 망가뜨립니다. 모르는 플래그는 붙이지 않습니다.
- **단편적 튜닝.** GC 멈춤만 보다가 실제 병목이 DB·네트워크·락 경합인 경우. GC는 전체 성능의 한 조각일 뿐입니다. 시스템 전체를 보고 GC가 진짜 문제인지부터 확인합니다.

## 컨테이너 환경 (container-aware)

쿠버네티스·도커가 표준이 된 지금, 가장 흔한 사고는 **JVM이 컨테이너 한계가 아니라 호스트 전체를 보는 것**이었습니다. JDK 10+부터 `-XX:+UseContainerSupport`(기본 활성)로 cgroup의 CPU·메모리 한계를 인식합니다.

힙은 절대값(`-Xmx`) 대신 **`-XX:MaxRAMPercentage`** 로 비율 지정을 권합니다. 컨테이너 메모리 limit이 바뀌어도 힙이 자동으로 따라가기 때문입니다. 컨테이너 메모리의 100%를 힙에 주면 안 됩니다 — 스택, Metaspace, 다이렉트 버퍼, 코드 캐시 같은 **힙 밖 메모리**가 남을 공간을 둬야 OOMKilled를 피합니다(보통 70~80%).

```bash
# 운영용 G1 예시 (지연 균형 + 컨테이너 인식)
java -Xms4g -Xmx4g \
     -XX:+UseG1GC \
     -XX:MaxGCPauseMillis=200 \
     -XX:MetaspaceSize=256m \
     -XX:MaxMetaspaceSize=512m \
     -XX:+UseContainerSupport \
     -XX:MaxRAMPercentage=75 \
     -Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags:filecount=5,filesize=20m \
     -jar app.jar
```

컨테이너에서 메모리 limit이 정해져 있다면 `-Xms/-Xmx` 절대값 대신 아래처럼 비율로 줘서 limit 변경에 자동 대응할 수도 있습니다.

```bash
# 컨테이너 limit에 비례해 힙을 잡는 변형
java -XX:+UseG1GC \
     -XX:InitialRAMPercentage=75 \
     -XX:MaxRAMPercentage=75 \
     -XX:MaxGCPauseMillis=200 \
     -jar app.jar
```

## 실전 튜닝 절차

마지막으로 위 내용을 하나의 절차로 묶으면 다음과 같습니다.

1. **목표 정의** — 처리량/지연/footprint 중 무엇이 우선인지, 수치 목표(예: p99 < 200ms)를 정한다.
2. **현황 측정** — GC 로그(`-Xlog:gc*`)를 켜고, 현재의 멈춤 분포·GC 시간 비율·할당률을 수집한다.
3. **수집기 선택** — 목표에 맞는 수집기를 결정 흐름으로 고른다(확신 없으면 G1).
4. **힙 사이징** — `-Xms=-Xmx` 고정, 컨테이너면 `MaxRAMPercentage`로, Metaspace 상한 설정.
5. **목표 플래그 적용** — `MaxGCPauseMillis` 또는 `GCTimeRatio` 중 우선 목표 하나를 준다.
6. **한 번에 하나씩 검증** — 같은 부하로 before/after를 비교하고, 효과 없는 변경은 되돌린다.
7. **코드 최적화** — 플래그로 한계에 닿으면 allocation rate를 줄이는 코드 개선으로 넘어간다.

GC 튜닝은 마법이 아니라 측정 기반의 반복입니다. 그 측정의 핵심 도구가 바로 GC 로그이고, 다음 글에서 이 로그를 제대로 읽는 법을 다룹니다.

---

**지난 글:** [Shenandoah GC — Brooks 포인터와 동시 압축](/posts/gc-shenandoah/)

**다음 글:** [GC 로그 읽기 — Unified Logging으로 진단하기](/posts/gc-logs-reading/)

<br>
읽어주셔서 감사합니다. 😊
