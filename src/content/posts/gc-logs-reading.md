---
title: "GC 로그 읽기 — Unified Logging으로 진단하기"
description: "JDK 9의 Unified Logging(-Xlog)으로 GC 로그를 켜고, 한 줄을 해부해 GC id·원인·힙 변화·pause 시간을 읽으며, 처리량·p99 pause·allocation/promotion rate·Full GC 빈도로 흔한 문제 패턴을 진단하는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "GC 로그", "Unified Logging", "-Xlog", "GCViewer", "GCeasy"]
featured: false
draft: false
---

[지난 글](/posts/gc-tuning/)에서 수집기를 고르고 힙을 사이징하는 전략을 다뤘습니다. 그런데 튜닝의 출발점은 언제나 "지금 내 애플리케이션의 GC가 실제로 어떻게 동작하고 있는가"를 아는 것입니다. 그 답은 추측이 아니라 **GC 로그** 안에 있습니다. 이번 글은 JDK 9부터 표준이 된 Unified Logging으로 로그를 켜고, 한 줄을 해부해 읽고, 핵심 지표로 문제 패턴을 진단하는 실전 절차를 정리합니다.

## 왜 GC 로그인가

GC는 애플리케이션을 멈추고(Stop-The-World) 메모리를 정리합니다. 이 멈춤이 길거나 잦으면 응답 지연·타임아웃·처리량 저하로 직결됩니다. 문제는 이 모든 일이 JVM 내부에서 조용히 일어난다는 점입니다. APM 대시보드의 "GC 시간 5%"라는 한 줄로는 *왜* 그런지 알 수 없습니다.

GC 로그는 모든 수집 이벤트를 시각으로 기록한 1차 사료입니다. 어떤 GC가, 언제, 왜 일어났고, 힙을 얼마나 회수했으며, 몇 ms 동안 멈췄는지가 줄마다 남습니다. 운영 환경에서 GC 로그는 거의 비용이 없으므로 **항상 켜두는 것**이 원칙입니다.

## Unified Logging — 구버전 로그와의 차이

JDK 8까지는 GC 로그를 `-XX:+PrintGCDetails`, `-XX:+PrintGCDateStamps`, `-Xloggc:gc.log` 같은 플래그를 조합해서 켰습니다. 수집기마다 출력 포맷이 제각각이라 파싱 도구도 수집기별로 달라야 했습니다.

JDK 9부터는 **Unified Logging(JEP 158/271)**으로 통일됐습니다. 모든 JVM 로그가 `-Xlog` 하나로 일원화되고, `[tags]`·level·데코레이터(시각·uptime 등)를 일관된 포맷으로 출력합니다. GC 로그도 그 일부일 뿐입니다.

| 구분 | JDK 8 이하 | JDK 9+ (Unified) |
|---|---|---|
| 활성화 플래그 | `-XX:+PrintGCDetails` 등 다수 | `-Xlog:gc*` 하나 |
| 출력 포맷 | 수집기별로 상이 | `[time][level][tags]` 통일 |
| 데코레이터 | 플래그별로 따로 | `:time,uptime,level,tags`로 선택 |
| 로그 로테이션 | `-XX:+UseGCLogFileRotation` 등 | `filecount`·`filesize` 옵션 |
| deprecated 여부 | JDK 9에서 다수 deprecate | 표준 |

> 구버전 플래그는 JDK 9에서도 일부 동작하지만 deprecated 경고가 뜹니다. 새로 설정한다면 무조건 `-Xlog`를 쓰는 게 맞습니다.

## 로그 켜기

가장 자주 쓰는 형태는 다음과 같습니다. `gc*`는 `gc`로 시작하는 모든 태그를, `:file=`은 출력 파일을, 그 뒤 콜론 구간은 데코레이터를, 마지막 구간은 로테이션을 지정합니다.

```bash
# 운영 환경 표준 설정 (G1 기준)
java -Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=10,filesize=50M \
     -XX:+UseG1GC -Xms2g -Xmx2g -jar app.jar
```

각 구간의 의미:

- `gc*` — selector. `gc`만 쓰면 요약 라인만, `gc*`는 단계(phase)·heap·humongous 등 상세 태그까지 포함합니다.
- `file=gc.log` — output. 생략하면 stdout으로 나갑니다.
- `time,uptime,level,tags` — decorator. 절대 시각·기동 후 경과시간·로그 레벨·태그를 각 줄 앞에 붙입니다.
- `filecount=10,filesize=50M` — rotation. 50MB마다 새 파일로 넘기고 최대 10개를 순환 보관합니다. 운영 환경에서 디스크가 차는 걸 막는 필수 옵션입니다.

## 로그 한 줄 해부

가장 중요한 능력은 도구 없이도 한 줄을 직접 읽는 것입니다. G1의 young 수집 한 줄을 예로 봅시다.

```text
[2026-06-14T09:12:03.418+0900][0.523s][info][gc] GC(7) Pause Young (Normal) (G1 Evacuation Pause) 512M->76M(1024M) 4.382ms
```

세그먼트별로 끊어 읽으면 이렇게 됩니다.

| 세그먼트 | 예시 값 | 의미 |
|---|---|---|
| 시각 / uptime | `09:12:03.418` / `0.523s` | 언제 일어났나, 기동 후 경과 |
| level / tags | `info` / `gc` | 로그 레벨과 태그 |
| GC id | `GC(7)` | 이 수집 사이클의 일련번호 |
| phase / cause | `Pause Young` / `G1 Evacuation Pause` | 어떤 수집이, 왜 |
| before->after(heap) | `512M->76M(1024M)` | 수집 전 -> 후 (전체 힙 용량) |
| pause | `4.382ms` | 멈춘 시간 |

![GC 로그 한 줄 해부](/assets/posts/gc-logs-anatomy.svg)

`512M->76M`는 이 GC가 약 436M를 회수했다는 뜻이고, `(1024M)`는 현재 힙 총용량입니다. 한 줄만으로도 "회수가 잘 됐는지, 멈춤이 짧은지"를 판단할 수 있습니다.

## young GC vs Full GC

Unified Logging에서는 phase 텍스트만 봐도 둘이 바로 구분됩니다.

- **young 수집** — `Pause Young (...)`. 신생 객체가 모인 young 영역만 정리. 보통 빈번하고 짧습니다(수 ms).
- **Full GC** — `Pause Full (...)`. 힙 전체를 정리. 드물어야 정상이고, 길고(수백 ms~초) 비쌉니다.

```text
[1.204s][info][gc] GC(8)  Pause Young (Normal) (G1 Evacuation Pause) 612M->88M(1024M) 5.1ms
[1.880s][info][gc] GC(9)  Pause Young (Concurrent Start) (G1 Humongous Allocation) 760M->120M(1024M) 7.9ms
[3.402s][info][gc] GC(14) Pause Full (G1 Compaction Pause) 980M->410M(1024M) 612.4ms
```

위에서 `GC(14)`의 `Pause Full`과 612ms 멈춤은 즉시 경계 대상입니다. young 수집은 한 자릿수 ms인데 Full GC만 수백 ms로 튀고 있고, after 힙(`410M`)이 평소보다 높게 남았기 때문입니다.

## 봐야 할 핵심 지표

로그를 줄 단위가 아니라 *집계*로 보면 애플리케이션의 GC 건강 상태가 드러납니다.

![GC 로그 분석 파이프라인](/assets/posts/gc-logs-pipeline.svg)

| 지표 | 보는 법 | 위험 신호 |
|---|---|---|
| 처리량(Throughput) | 전체 시간 중 앱이 실행된 비율 | 95% 미만 |
| pause 분포 p99 | 평균이 아닌 꼬리 지연·최댓값 | SLA 초과하는 tail |
| allocation rate | 초당 할당량(MB/s) | 높을수록 young GC 빈발 |
| promotion rate | old로 승격되는 양 | 과도하면 premature promotion |
| Full GC 빈도 | 단위 시간당 Full GC 횟수 | 주기적·증가 추세 |
| humongous allocation | G1에서 region 절반 초과 객체 | 잦으면 단편화·Full GC 유발 |

핵심 원칙은 **단일 시점이 아니라 시간축 추세로 보라**는 것입니다. 특히 매 GC 직후의 *after 힙*이 우상향하면(회수해도 남는 양이 계속 늘면) 메모리 누수의 가장 강한 신호입니다.

## 흔한 문제 패턴 진단

로그에서 자주 만나는 세 가지 증상과 해석입니다.

### 잦은 Full GC

Full GC가 주기적으로, 또는 점점 자주 일어나면 둘 중 하나입니다.

- **메모리 누수** — after 힙이 매 Full GC마다 우상향. 회수해도 살아 있는 객체가 계속 늘어남. 힙 덤프(`jmap`)와 누수 의심 객체 분석이 다음 단계입니다.
- **힙 부족** — after 힙은 안정적인데 워크로드 대비 `-Xmx`가 작아 금방 다시 참. 힙을 키우거나 할당량을 줄여야 합니다.

after 힙의 추세 하나로 둘을 구분할 수 있다는 점이 중요합니다.

### 긴 pause

특정 GC만 pause가 튀는 경우입니다. `gc*`에 포함된 phase 로그(`[gc,phases]`)를 보면 어느 단계가 오래 걸렸는지 알 수 있습니다. Full GC의 compaction, G1의 humongous allocation으로 인한 mixed/full 전환 등이 흔한 원인입니다.

### premature promotion

young에서 충분히 죽었어야 할 객체가 너무 일찍 old로 승격되는 현상입니다. 로그에서 **young 수집인데도 promotion(승격)량이 크고, 그 결과 Full GC가 잦아지는** 패턴으로 나타납니다. young(또는 G1 eden) 영역이 너무 작거나, 객체 수명이 tenuring threshold보다 긴 것이 원인입니다. young 영역을 키우거나 할당 패턴을 손봐야 합니다.

## 분석 도구

수백 MB짜리 로그를 눈으로 다 읽을 수는 없습니다. 위 지표를 자동으로 그래프·통계로 뽑아주는 도구를 씁니다.

- **GCViewer** — 오픈소스 데스크톱 도구. 로그를 로컬에서 열어 throughput·pause·힙 추세 그래프를 봅니다. 사내 보안상 로그 반출이 어려울 때 적합합니다.
- **GCeasy.io** — 웹 기반. 로그를 업로드하면 처리량·p99 pause·allocation/promotion rate·문제 패턴 진단까지 리포트로 자동 산출합니다. 빠른 1차 진단에 유용합니다.

두 도구 모두 Unified Logging 포맷을 인식하므로, 앞서 켠 `gc.log`를 그대로 넣으면 됩니다.

## JFR 연계

더 깊은 진단이 필요하면 **JFR(Java Flight Recorder)**를 함께 켜는 것이 정석입니다. `-XX:+FlightRecorder`로 기록하면 GC 이벤트뿐 아니라 **어떤 코드 경로가 얼마나 객체를 할당했는지(allocation profiling)**까지 추적되어, "allocation rate가 높다"에서 "이 메서드가 범인이다"로 한 단계 더 좁힐 수 있습니다.

## 정리

- JDK 9+에서는 `-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=10,filesize=50M`로 로그를 켜고 항상 보존한다.
- 한 줄은 GC id · phase/cause · before->after(heap) · pause로 끊어 읽고, `Pause Young`과 `Pause Full`로 수집 종류를 구분한다.
- 처리량·p99 pause·allocation/promotion rate·Full GC 빈도·humongous를 **시간축 추세**로 본다. after 힙의 우상향이 가장 위험하다.
- 잦은 Full GC는 after 추세로 누수와 힙 부족을 가르고, 긴 pause는 phase 로그로, premature promotion은 young 승격량으로 진단한다.
- GCViewer/GCeasy로 집계하고, 더 깊이 파려면 JFR로 할당 출처를 추적한다.

---

**지난 글:** [GC 튜닝 — 수집기 선택과 힙 사이징 전략](/posts/gc-tuning/)

<br>
읽어주셔서 감사합니다. 😊
