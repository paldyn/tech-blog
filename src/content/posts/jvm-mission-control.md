---
title: "JDK Mission Control — JFR 기록 분석"
description: "JDK Mission Control(JMC)은 JFR 기록(.jfr)을 펼쳐 분석하는 GUI 도구입니다. Automated Analysis로 문제를 빠르게 짚고, 플레임 그래프로 CPU 핫스팟을, 할당 뷰로 GC 압력의 출처를, 락 뷰로 경합을 추적하는 실전 분석 흐름을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "JMC", "Mission Control", "JFR", "플레임 그래프", "성능 분석", "프로파일링"]
featured: false
draft: false
---

[지난 글](/posts/jvm-flight-recorder/)에서 JFR로 저오버헤드 기록을 떠 `.jfr` 파일을 손에 넣었습니다. 그런데 `.jfr`은 바이너리라 그 자체로는 읽을 수 없습니다. 이 기록을 펼쳐 사람이 이해할 수 있는 그래프와 표로 보여 주는 도구가 **JDK Mission Control(JMC)** 입니다. JFR이 블랙박스의 "기록 장치"라면, JMC는 그 기록을 재생하고 분석하는 "재생 장치"입니다. 이번 글은 JMC로 `.jfr`을 열어 CPU 핫스팟·GC 압력·락 경합을 추적하는 실전 흐름을 정리합니다.

## JMC란 — JFR 기록의 분석 워크벤치

JMC는 OpenJDK 진영에서 제공하는 무료 GUI 도구입니다(별도 다운로드). `.jfr` 파일을 열면 수백 종의 이벤트를 자동으로 분류해 여러 뷰로 보여 줍니다. 핵심은 "이미 기록된 데이터를 *해석*하는 도구"라는 점입니다 — 기록 자체는 JFR이 끝냈고, JMC는 그 위에서 질문을 던집니다.

![JMC가 .jfr을 펼쳐 보여주는 주요 분석 뷰](/assets/posts/jvm-mission-control-views.svg)

처음 `.jfr`을 열면 압도될 수 있는데, 분석 순서는 정해져 있습니다. **Automated Analysis Results**부터 보는 것입니다. JMC가 내장 규칙으로 기록을 훑어 "GC pause가 길다", "특정 락 경합이 심하다", "할당률이 높다" 같은 항목에 점수와 설명을 매겨 줍니다. 여기서 빨간 점수가 붙은 항목이 곧 들여다볼 출발점입니다. 그다음 해당 영역의 상세 뷰로 내려갑니다.

## 플레임 그래프 — CPU를 어디서 쓰는가

성능 분석에서 가장 자주 보는 것이 **Method Profiling**, 즉 플레임 그래프입니다. JFR이 주기적으로 떠 둔 메서드 샘플을 콜 스택별로 쌓아 시각화한 것입니다.

![플레임 그래프 읽는 법](/assets/posts/jvm-mission-control-flamegraph.svg)

읽는 법은 단순합니다. **가로 너비 = 그 메서드가 샘플에 잡힌 횟수**(= 대략 CPU 시간), **세로 = 콜 스택의 깊이**입니다. 위 그림에서 `handleRequest → parseJson → regexMatch`로 이어지는 넓은 기둥이 CPU 시간의 대부분을 잡아먹는 핫 경로입니다. 가장 위에서 넓은 `regexMatch()`가 실제로 CPU를 태우는 잎(leaf) 메서드 — 최적화 1순위입니다. 반대로 `logging()`처럼 좁은 바는 신경 쓸 필요가 없습니다. 추측 없이 "여기를 고치면 효과가 크다"를 가리켜 주는 것이 플레임 그래프의 힘입니다.

## 할당과 락 — GC 압력과 경합의 출처

CPU 다음으로 자주 보는 두 가지가 메모리 할당과 락입니다.

- **Memory(할당) 뷰**: "어떤 코드가 어떤 객체를 얼마나 만드는가"를 콜 스택과 함께 보여 줍니다. GC가 자주 도는 근본 원인은 대개 과도한 단기 객체 할당인데, 이 뷰가 그 출처를 정확히 가리킵니다. 매 요청마다 만드는 임시 리스트, 불필요한 박싱, 로그 문자열 조립 등이 흔한 범인입니다.
- **Lock Instances 뷰**: 어떤 모니터 락에서 스레드들이 **누적으로 얼마나 오래** 막혔는지를 보여 줍니다. 단발 스레드 덤프로는 우연히 안 잡히던 간헐적 경합도, JFR은 기간 내 모든 경합을 누적하므로 드러납니다. 경합이 심한 락을 찾아 임계 구역을 줄이거나 락 분할·동시성 자료구조로 바꾸는 근거가 됩니다.

이 모든 분석의 기반은 앞 글에서 만든 `.jfr` 파일 하나입니다. 분석을 위해 추가로 코드를 계측할 필요가 없다는 점이 JFR+JMC 조합의 핵심 가치입니다.

```bash
# 분석할 .jfr을 떠서 JMC로 연다 (운영 → 로컬로 복사 후 열기)
jcmd <pid> JFR.dump name=diag filename=diag.jfr
# JMC 실행 후 File > Open File 로 diag.jfr 열기
# CLI에서 빠르게 요약만 보고 싶다면:
jfr summary diag.jfr
```

> JMC는 라이브 연결(JMX) 모드로 실행 중인 JVM에 붙어 실시간 지표를 보는 기능도 있지만, 운영에서는 **JFR로 떠 둔 `.jfr`을 로컬에서 여는 오프라인 분석**이 더 안전하고 일반적입니다. 운영 서버에 GUI를 띄우지 않아도 되니까요.

## 정리

- JMC는 JFR 기록(`.jfr`)을 펼쳐 분석하는 무료 GUI 워크벤치다. JFR이 "기록", JMC가 "분석" 역할.
- 분석은 **Automated Analysis Results**부터 — JMC가 규칙으로 문제 후보에 점수를 매겨 출발점을 짚어 준다.
- **플레임 그래프**는 가로=CPU 시간, 세로=콜 스택 깊이. 가장 위에서 넓은 메서드가 최적화 1순위다.
- **할당 뷰**는 GC 압력의 출처를, **락 뷰**는 누적 경합이 심한 락을 가리킨다 — 추가 계측 없이.
- 운영에서는 `.jfr`을 떠 로컬에서 여는 오프라인 분석이 안전하다.
- 여기까지가 JVM 진단 도구 묶음이었다. 다음 글부터는 주제를 바꿔 Java 모듈 시스템(JPMS)을 다룬다.

---

**지난 글:** [JDK Flight Recorder — 저비용 상시 프로파일링](/posts/jvm-flight-recorder/)

**다음 글:** [Java 모듈 시스템 개요 — JPMS란 무엇인가](/posts/java-modules-overview/)

<br>
읽어주셔서 감사합니다. 😊
