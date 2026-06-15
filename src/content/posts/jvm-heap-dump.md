---
title: "힙 덤프 — 메모리 누수를 잡는 스냅샷 분석"
description: "힙 덤프는 특정 시점 힙 전체의 사진입니다. jcmd·jmap·HeapDumpOnOOM으로 .hprof를 뜨고, Eclipse MAT에서 shallow/retained heap과 dominator tree, leak suspect, GC root 경로로 어떤 객체가 왜 회수되지 않는지를 추적하는 실전 절차를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "힙 덤프", "Heap Dump", "메모리 누수", "MAT", "retained heap", "jmap"]
featured: false
draft: false
---

[지난 글](/posts/jvm-out-of-memory/)에서 `Java heap space` OOM이 단순 힙 부족인지 메모리 누수인지를 GC 로그의 after-힙 추세로 가른다고 했습니다. 추세가 우상향이라 누수가 의심된다면, 다음 질문은 "그래서 **어떤 객체**가, **무엇 때문에** 회수되지 않고 쌓이는가"입니다. 이 질문에 답하는 도구가 **힙 덤프(heap dump)** 입니다. 힙 덤프는 특정 시점 힙 전체를 통째로 찍은 사진이라, 어떤 객체가 몇 개 있고 누가 누구를 참조하는지를 빠짐없이 담습니다. 이번 글은 힙 덤프를 뜨는 법과, 그 안에서 누수의 정체를 좁히는 분석 절차를 정리합니다.

## 힙 덤프란 무엇인가

힙 덤프는 그 순간 힙에 살아있는 **모든 객체와 참조 관계**를 직렬화한 파일(보통 `.hprof`)입니다. 각 객체의 클래스, 크기, 필드 값, 그리고 어떤 객체가 어떤 객체를 가리키는지가 전부 들어 있습니다. 즉 객체 그래프 전체의 스냅샷입니다. GC 로그가 "시간에 따른 힙 사용량의 추이"라면, 힙 덤프는 "한 시점의 힙 내부 구조"입니다. 누수 분석은 후자가 필요합니다 — 무엇이 쌓이는지는 구조를 봐야 알 수 있으니까요.

![힙 덤프 캡처에서 분석까지](/assets/posts/jvm-heap-dump-pipeline.svg)

## 덤프 뜨는 세 가지 방법

```bash
# 1) 운영 중 프로세스에서 직접 (권장: jcmd)
jcmd <pid> GC.heap_dump /var/dumps/app.hprof

# 2) jmap — live 옵션은 덤프 전 Full GC로 도달 가능한 객체만 남김
jmap -dump:live,format=b,file=/var/dumps/app.hprof <pid>

# 3) OOM 순간 자동 캡처 (운영에 항상 켜둘 것)
java -XX:+HeapDumpOnOutOfMemoryError \
     -XX:HeapDumpPath=/var/dumps -jar app.jar
```

세 방법 모두 결과물은 같은 `.hprof`입니다. 주의할 점이 둘 있습니다. 첫째, 덤프를 뜨는 동안 JVM은 사실상 멈추므로(safepoint) **운영 트래픽이 한가한 시점을 고르거나 사전 공지**가 필요합니다. 둘째, 덤프 파일 크기는 힙 크기에 비례하므로(수 GB가 흔함) 디스크 여유를 확인해야 합니다. `live` 옵션은 덤프 전에 GC를 한 번 돌려 도달 불가능 객체를 빼므로 파일이 작아지고 분석도 깔끔합니다.

## shallow heap과 retained heap

덤프를 열기 전에 반드시 알아야 할 두 개념이 있습니다. **shallow heap**은 객체 *자기 자신*이 차지하는 메모리입니다. **retained heap**은 그 객체를 지웠을 때 *함께 회수되는 모든 객체*의 크기 합입니다. 누수 분석에서 진짜 중요한 건 retained heap입니다.

![shallow heap과 retained heap의 차이](/assets/posts/jvm-heap-dump-retained.svg)

위 그림에서 객체 A의 shallow heap은 A 한 칸뿐이지만, A를 GC Root에서 끊으면 B·C·D가 전부 도달 불가능해지므로 A의 retained heap은 {A,B,C,D} 전체입니다. 반면 B의 retained heap은 {B}뿐입니다 — D는 C를 통해서도 도달 가능해서 B만 지워도 살아남기 때문입니다. **retained heap이 비정상적으로 큰 객체가 누수의 범인**일 가능성이 높습니다. 그 객체 하나가 거대한 그래프를 붙잡고 있다는 뜻이니까요.

## MAT로 분석하기 — 누수를 좁히는 순서

Eclipse MAT(Memory Analyzer Tool)는 사실상 표준입니다. 큰 덤프도 인덱싱해서 다룰 수 있고, 분석 흐름이 잘 정리되어 있습니다. 실전 순서는 대략 이렇습니다.

- **Leak Suspects 리포트**: MAT가 덤프를 열면 자동으로 retained heap이 비정상적으로 큰 후보를 짚어줍니다. 대부분 여기서 출발점이 잡힙니다.
- **Dominator Tree**: 객체를 retained heap 기준으로 정렬한 트리입니다. 맨 위에 있는 거대 객체가 무엇을 붙잡고 있는지 펼쳐 봅니다. 보통 `HashMap`, `ArrayList`, 캐시 객체가 상위에 보입니다.
- **Histogram**: 클래스별 인스턴스 개수와 총 크기입니다. "왜 `User` 객체가 200만 개나 있지?" 같은 의심이 여기서 시작됩니다.
- **Path to GC Roots**: 가장 결정적인 단계입니다. 의심 객체를 우클릭해 "GC Root까지의 경로"를 보면, *누가* 이 객체를 붙잡고 있어 회수되지 않는지가 드러납니다. 정적 필드의 컬렉션, 캐시, 스레드로컬, 리스너 목록이 흔한 종착지입니다.

전형적인 누수 패턴은 분명합니다. 정적 `Map`에 캐시를 쌓으면서 제거(eviction) 정책이 없거나, 이벤트 리스너를 등록만 하고 해제하지 않거나, `ThreadLocal`을 풀 스레드에서 `remove()` 없이 쓰는 경우입니다. Path to GC Roots가 이 중 어디로 이어지는지를 보면 코드의 어느 줄을 고쳐야 할지가 좁혀집니다.

> 두 시점의 덤프를 비교(diff)하면 더 강력합니다. 부하를 준 전/후로 덤프를 두 번 떠서 어떤 클래스의 인스턴스가 *늘어났는지*를 보면, 시간에 따라 누적되는 객체 — 즉 진짜 누수 — 가 단번에 드러납니다.

## 정리

- 힙 덤프는 특정 시점 힙의 **모든 객체와 참조 관계**를 담은 스냅샷(`.hprof`)이다. 누수의 "무엇/왜"는 이 구조를 봐야 풀린다.
- `jcmd ... GC.heap_dump`(권장)·`jmap -dump:live`·`-XX:+HeapDumpOnOutOfMemoryError`로 뜬다. 덤프 중 JVM이 멈추고 파일이 크다는 점에 주의한다.
- **shallow heap**은 객체 자신, **retained heap**은 그 객체와 함께 회수될 전체 크기. 누수 범인은 retained heap이 큰 객체다.
- MAT에서 Leak Suspects → Dominator Tree → Histogram → **Path to GC Roots** 순으로 좁힌다. 마지막 단계가 "누가 붙잡고 있나"를 알려준다.
- 두 시점 덤프를 비교하면 누적되는 객체가 명확히 드러난다.

---

**지난 글:** [OutOfMemoryError — 종류별 원인과 진단](/posts/jvm-out-of-memory/)

**다음 글:** [스레드 덤프 — 멈춘 스레드와 데드락 진단](/posts/jvm-thread-dump/)

<br>
읽어주셔서 감사합니다. 😊
