---
title: "Shenandoah GC — Brooks 포인터와 동시 압축"
description: "Shenandoah는 Red Hat이 개발한 초저지연 수집기로, ZGC와 같은 목표를 다른 방식으로 풉니다. forwarding(Brooks) 포인터와 load/store 배리어로 객체 이동(compaction)까지 애플리케이션과 동시에 수행해, 정지 시간을 힙 크기와 무관하게 유지합니다. region 기반 구조, 페이즈 동작, 배리어 비용으로 인한 처리량 손해, 그리고 ZGC와의 비교를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "GC", "Shenandoah", "Concurrent Compaction", "Brooks Pointer", "초저지연"]
featured: false
draft: false
---

[지난 글](/posts/gc-zgc/)에서 ZGC가 컬러드 포인터(colored pointer)와 load barrier로 객체 이동까지 동시에 처리해 정지 시간을 힙 크기와 무관하게 만드는 모습을 봤습니다. 그런데 같은 "초저지연 + 동시 압축"이라는 목표를, 전혀 다른 메커니즘으로 푸는 수집기가 하나 더 있습니다. Red Hat이 개발한 **Shenandoah GC**입니다.

Shenandoah는 ZGC와 같은 시대에, 같은 문제의식 — "힙이 아무리 커져도 정지 시간은 짧게" — 을 공유합니다. 하지만 포인터에 메타데이터를 심는 ZGC와 달리, Shenandoah는 **객체마다 forwarding 포인터를 두고 배리어로 접근을 리다이렉트**하는 방식을 택했습니다. 이번 글은 그 핵심 장치인 Brooks 포인터와, 압축까지 동시에 수행하는 페이즈 구조를 들여다봅니다.

## 같은 목표, 다른 길

전통적인 Mark-Compact 수집기의 가장 큰 비용은 **압축(compaction)** 입니다. 살아 있는 객체를 한쪽으로 모아 단편화를 없애는 작업인데, 객체를 옮기면 그 객체를 가리키던 모든 참조도 새 주소로 고쳐야 합니다. 이 "이동 + 참조 갱신"을 일관되게 하려면 전 스레드를 멈춰야(STW) 했고, 힙이 클수록 멈춤도 길어졌습니다.

Shenandoah의 발상은 명쾌합니다. **압축을 STW가 아니라 애플리케이션과 동시에(concurrent) 수행**하자는 것입니다. 앱이 도는 도중에 객체를 옮기면, 앱은 옛 주소를 들고 있는데 객체는 이미 다른 곳으로 가버리는 모순이 생깁니다. Shenandoah는 이 모순을 forwarding 포인터와 배리어로 해결합니다.

그 결과 정지 시간은 **힙 크기와 무관**해집니다. 200MB 힙이든 200GB 힙이든, STW 구간은 루트를 스캔하는 등의 짧은 작업뿐이고 무거운 객체 이동은 동시 단계에서 일어나기 때문입니다.

## forwarding(Brooks) 포인터

Shenandoah의 심장은 **forwarding 포인터**입니다. 초기 설계에서는 모든 객체 앞에 추가 워드(word)를 하나 붙였습니다. 이 아이디어를 처음 제안한 Rodney Brooks의 이름을 따 **Brooks 포인터**라고도 부릅니다.

![forwarding(Brooks) 포인터로 동시 이동을 구현하는 방식](/assets/posts/gc-shenandoah-forwarding-pointer.svg)

동작은 이렇습니다.

- 평소에 객체의 forwarding 포인터는 **자기 자신**을 가리킵니다.
- 동시 대피(evacuation) 단계에서 객체를 To-space로 복사하면, **옛 복사본(From-copy)의 forwarding 포인터를 새 복사본(To-copy)으로** 바꿉니다.
- 이제 어떤 스레드가 옛 주소로 객체에 접근하더라도, **forwarding 포인터를 한 번 따라가면** 항상 최신 복사본에 도달합니다.

여기서 배리어가 등장합니다. 애플리케이션이 객체 필드를 읽거나 쓸 때마다, 컴파일러가 삽입한 **load/store 배리어**가 먼저 forwarding 포인터를 확인하고 접근을 새 복사본으로 리다이렉트합니다. 덕분에 앱은 객체가 이동했다는 사실을 신경 쓸 필요 없이, 항상 올바른(살아 있는) 복사본을 보게 됩니다.

> 참고: 별도 forwarding 워드는 객체마다 메모리 오버헤드를 더했습니다. 그래서 **현대 Shenandoah(JDK 13+)는 이 포인터를 객체 헤더(mark word) 안으로 옮겨** 추가 워드 없이 같은 효과를 냅니다. 개념은 동일하되 저장 위치만 달라진 것입니다.

## region 기반 힙

Shenandoah는 G1·ZGC와 마찬가지로 힙을 동일한 크기의 **region(리전)** 으로 나눠 관리합니다. 전체 힙을 한꺼번에 다루는 대신, 죽은 객체가 많아 회수 효율이 높은 region을 골라 그곳의 살아 있는 객체만 다른 region으로 대피시킵니다.

region 단위로 작업하면 한 주기에 처리할 양을 조절할 수 있고, 빈 region을 통째로 회수해 재사용하기 쉽습니다. 동시 압축과 결합하면, "쓰레기가 많은 region을 골라 → 살아 있는 객체를 동시에 옮기고 → 빈 region을 회수"하는 흐름이 앱을 거의 멈추지 않고 이어집니다.

## 수집 페이즈

Shenandoah의 한 주기는 여러 페이즈로 이루어지며, 그중 STW는 **아주 짧은 세 지점**뿐입니다. 무거운 작업 — 마킹, 대피(압축), 참조 갱신 — 은 모두 동시에 돕니다.

![Shenandoah의 수집 페이즈 타임라인 — 압축까지 동시 수행](/assets/posts/gc-shenandoah-phases.svg)

| 페이즈 | STW 여부 | 하는 일 |
|---|---|---|
| Init Mark | **STW (아주 짧음)** | GC Roots 스캔, 동시 마킹 준비 |
| Concurrent Mark | 동시 | 객체 그래프 전체를 앱과 함께 탐색 |
| Final Mark | **STW (아주 짧음)** | 동시 마킹 마무리, 대피 대상 region 선정 |
| Concurrent Evacuation | 동시 | **살아 있는 객체를 동시에 이동(compaction)** |
| Init Update Refs | **STW (아주 짧음)** | 참조 갱신 단계 시작 준비 |
| Concurrent Update References | 동시 | 옛 참조를 새 위치로 동시 정정 |
| Final Update Refs | **STW (아주 짧음)** | 루트 참조 갱신, From-region 회수 |

핵심은 **Concurrent Evacuation** 입니다. 전통적 Mark-Compact가 객체 이동을 STW에서 하던 것과 달리, Shenandoah는 forwarding 포인터 + 배리어 덕분에 **압축을 동시 단계에서** 처리합니다. 앱은 이동 중에도 배리어를 통해 늘 올바른 복사본에 접근하므로, 객체가 옮겨지는 동안에도 멈추지 않고 계속 실행됩니다. 이것이 Shenandoah의 정지 시간이 힙 크기와 무관한 이유입니다.

이어지는 Update References 단계는 옛 주소를 가리키던 힙 전체의 참조를 새 위치로 정정합니다. 이 갱신이 끝나면 더 이상 forwarding 포인터를 따라갈 필요가 없어지고, 옛 복사본이 있던 From-region을 통째로 회수합니다.

## concurrent의 대가 — 배리어 비용

동시 수집에는 늘 대가가 따릅니다. Shenandoah의 대가는 주로 **배리어 비용**입니다. 객체 필드에 접근할 때마다 forwarding 포인터를 확인하는 load/store 배리어가 끼어들기 때문에, GC가 돌지 않을 때도 약간의 상시 오버헤드가 있습니다.

그래서 Shenandoah는 처리량(throughput) 면에서 Parallel GC 같은 STW 수집기보다 다소 손해를 봅니다. 멈춤을 줄이는 대신 처리량을 약간 양보하는, 지연 시간 우선 수집기의 전형적인 트레이드오프입니다. 다만 Red Hat은 배리어를 점차 가볍게 다듬어 왔고(예: 헤더 내 forwarding으로 전환), 응답 시간이 중요한 서비스에서는 이 정도 손해가 충분히 받아들일 만한 수준입니다.

## 사용법

Shenandoah는 다음 플래그로 활성화합니다.

```text
-XX:+UseShenandoahGC
-Xms8g -Xmx8g                 # 힙 고정 권장(초저지연 일관성)
-Xlog:gc                      # GC 로그 출력
```

GC 로그에서는 STW 페이즈가 짧은 pause로, 무거운 작업이 concurrent 줄로 보입니다.

```text
[gc] Pause Init Mark 0.521ms
[gc] Concurrent marking 142.300ms
[gc] Pause Final Mark 0.733ms
[gc] Concurrent evacuation 88.110ms
[gc] Pause Final Update Refs 0.402ms
```

`Pause` 줄(STW)은 모두 1ms 안팎으로 짧고, 마킹·대피 같은 무거운 작업은 `Concurrent` 줄로 앱과 동시에 진행되는 것을 볼 수 있습니다.

도입 시점도 짚어 둘 만합니다. Shenandoah는 **JDK 12에서 실험적으로 도입**되었고 **JDK 15에서 production 기능**이 되었습니다. 다만 주의할 점이 있습니다. Shenandoah는 OpenJDK 본류에 있지만, **배포 빌드에 따라 포함 여부가 다릅니다.** Red Hat·Adoptium(Temurin) 등 대부분의 OpenJDK 빌드에는 들어 있지만, **Oracle JDK에는 포함되어 있지 않습니다.** 따라서 `UseShenandoahGC`가 동작하지 않는다면, 우선 사용 중인 JDK 빌드가 Shenandoah를 포함하는지 확인해야 합니다.

## ZGC vs Shenandoah

ZGC와 Shenandoah는 목표가 거의 같습니다. 둘 다 region 기반이고, 둘 다 **압축까지 동시에 수행**하며, 둘 다 정지 시간을 힙 크기와 무관하게 유지합니다. 결정적 차이는 "이동한 객체를 어떻게 따라가는가"라는 메커니즘에 있습니다.

| 항목 | ZGC | Shenandoah |
|---|---|---|
| 개발 | Oracle | Red Hat |
| 목표 | 초저지연, 정지 시간 ∝ 힙 무관 | 초저지연, 정지 시간 ∝ 힙 무관 |
| 동시 압축 | **O (concurrent compaction)** | **O (concurrent compaction)** |
| 핵심 메커니즘 | **컬러드 포인터(colored pointer)** | **forwarding(Brooks) 포인터** |
| 배리어 | load barrier 중심 | load/store 배리어 |
| 구조 | region 기반 | region 기반 |
| 상시 비용 | 배리어 + 포인터 메타데이터 | 배리어(헤더 내 forwarding) |
| 플래그 | `-XX:+UseZGC` | `-XX:+UseShenandoahGC` |
| 빌드 포함 | OpenJDK 본류(Oracle JDK 포함) | OpenJDK 본류(단, Oracle JDK 미포함) |

요약하면, **목표와 결과(동시 압축·힙 무관 정지)는 같고 구현 철학이 다릅니다.** ZGC는 포인터 비트에 색을 칠해 객체 상태를 추적하고, Shenandoah는 객체 곁에 길잡이(forwarding 포인터)를 두어 이동을 따라갑니다.

## 정리

- Shenandoah는 **Red Hat이 개발한 초저지연 수집기**로, ZGC와 같은 목표를 다른 방식으로 푼다
- **forwarding(Brooks) 포인터 + load/store 배리어**로 객체 이동(compaction)까지 애플리케이션과 동시에 수행한다
- 덕분에 **정지 시간이 힙 크기와 무관**하고, STW는 루트 스캔 등 짧은 구간만 남는다
- 힙을 **region**으로 나눠 관리하며, 페이즈는 Init/Concurrent/Final Mark → **Concurrent Evacuation** → Update References로 이어진다
- **배리어 비용** 때문에 처리량은 약간 손해 보는, 지연 시간 우선의 트레이드오프다
- 활성화는 `-XX:+UseShenandoahGC`, **JDK 12 도입·JDK 15 production**, 단 **빌드에 따라 포함 여부가 다르며 Oracle JDK엔 미포함**이다
- ZGC와 Shenandoah는 둘 다 concurrent compaction을 하지만, ZGC는 **컬러드 포인터**, Shenandoah는 **forwarding 포인터**라는 메커니즘 차이가 있다

다음 글에서는 지금까지 살펴본 여러 수집기 중 무엇을 언제 고를지, 그리고 힙을 어떻게 잡을지를 다루는 **GC 튜닝** 전략을 정리합니다.

---

**지난 글:** [ZGC — 컬러드 포인터와 초저지연 수집](/posts/gc-zgc/)

**다음 글:** [GC 튜닝 — 수집기 선택과 힙 사이징 전략](/posts/gc-tuning/)

<br>
읽어주셔서 감사합니다. 😊
