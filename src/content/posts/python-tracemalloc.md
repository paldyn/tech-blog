---
title: "tracemalloc: 메모리 할당을 추적하기"
description: "표준 라이브러리 tracemalloc으로 메모리 할당 위치를 추적하는 법. start와 take_snapshot, 두 스냅샷의 compare_to로 누수를 찾는 흐름, statistics로 상위 할당 지점 보기까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["tracemalloc", "메모리", "메모리누수", "프로파일링", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-memory-profiler/)에서 `memory_profiler`로 함수의 각 줄이 메모리를 얼마나 쓰는지 보았다. 다만 그 도구는 외부 패키지이고 `@profile` 데코레이터를 붙여야 했다. 만약 "이미 돌고 있는 코드의 어느 지점이 메모리를 붙잡고 있는가"를 추가 설치 없이, 그것도 할당이 일어난 정확한 소스 위치까지 알고 싶다면? 표준 라이브러리에 그 답이 있다. 파이썬 3.4부터 내장된 `tracemalloc`이다.

## 할당의 출처를 기억한다

`tracemalloc`의 특별한 점은 단순히 "지금 메모리를 얼마 쓰는가"가 아니라, **각 메모리 블록이 어느 소스 줄에서 할당되었는지**를 추적한다는 것이다. 그래서 "메모리는 늘었는데 어디서 늘었는지 모르겠다"는 가장 답답한 상황에 직접 답을 준다.

```python
import tracemalloc

tracemalloc.start()           # 이 시점부터 할당을 추적

data = [bytes(1024) for _ in range(10000)]   # 약 10 MB

current, peak = tracemalloc.get_traced_memory()
print(f"현재 {current / 1e6:.1f} MB, 최대 {peak / 1e6:.1f} MB")
tracemalloc.stop()
```

`start()`를 부른 순간부터 모든 할당이 출처와 함께 기록된다. `get_traced_memory()`는 현재와 최대 사용량을 한 번에 알려 줘, 피크가 언제 어디서 찍혔는지 가늠하게 해 준다.

## 상위 할당 지점 보기

추적이 켜진 상태에서 스냅샷을 찍으면, 어느 소스 위치가 메모리를 가장 많이 잡고 있는지 순위로 볼 수 있다.

![상위 할당 지점 보기](/assets/posts/python-tracemalloc-topstats.svg)

```python
snap = tracemalloc.take_snapshot()
for stat in snap.statistics("lineno")[:3]:
    print(stat)
# cache.py:21: size=120 MiB, count=300000
# models.py:9:  size=42 MiB, count=90000
```

`statistics("lineno")`는 할당을 소스 줄 단위로 묶어 크기순으로 정렬해 준다. 상위 몇 줄만 봐도 "이 캐시가 120 MB를 들고 있구나" 하는 사실이 파일명과 줄 번호까지 드러난다. `cProfile`이 시간 병목을 함수 이름으로 짚어 준 것처럼, `tracemalloc`은 메모리 점유를 소스 위치로 짚어 준다.

## 누수는 두 스냅샷의 차이로 잡는다

`tracemalloc`이 진가를 발휘하는 순간은 메모리 누수 추적이다. 한 시점의 스냅샷만으로는 "원래 그만큼 쓰는 건지, 새는 건지" 구분하기 어렵다. 그래서 **두 시점의 스냅샷을 비교**한다.

![스냅샷을 비교한다](/assets/posts/python-tracemalloc-snapshot.svg)

```python
import tracemalloc
tracemalloc.start()

snap_a = tracemalloc.take_snapshot()     # 의심 코드 전
do_suspicious_work()                     # 반복 처리 등
snap_b = tracemalloc.take_snapshot()     # 의심 코드 후

for stat in snap_b.compare_to(snap_a, "lineno")[:5]:
    print(stat)
# orders.py:33: size=+88 MiB, count=+200000   ← 이 줄에서 누적
```

`compare_to`는 두 스냅샷 사이에서 **늘어난 양**을 기준으로 정렬해 준다. `+88 MiB`처럼 양수로 크게 찍히는 줄이, 작업을 반복할수록 메모리를 계속 붙잡고 놓지 않는 누수 지점이다. 같은 작업을 여러 번 돌린 뒤 비교했을 때 특정 줄의 증가량이 계속 커진다면, 거기서 객체가 어딘가(전역 리스트, 캐시, 닫지 않은 자원)에 쌓이고 있다는 신호다.

## 실전 팁

기본적으로 `tracemalloc`은 할당된 마지막 한 프레임만 기억한다. 할당까지 이어진 호출 경로 전체를 보고 싶다면 `tracemalloc.start(25)`처럼 추적할 프레임 수를 늘려 시작하면 된다. 그러면 `snap.statistics("traceback")`으로 그 위치에 이르기까지의 호출 스택을 통째로 볼 수 있다.

```python
tracemalloc.start(25)        # 호출 경로를 최대 25프레임까지 기억
```

`tracemalloc`은 추적 자체에 메모리와 시간 오버헤드가 있으니, 항상 켜 두기보다 누수를 의심하는 구간에서만 켜는 것이 좋다. 그래도 외부 의존성 없이 표준 라이브러리만으로, 할당 위치를 소스 줄 단위까지 짚어 준다는 점은 강력하다. 지금까지의 도구들은 모두 측정 대상 코드 안에 무언가를 심어야 했다. 다음 글에서는 발상을 뒤집어, 이미 돌고 있는 프로세스를 바깥에서 들여다보는 `py-spy`를 만난다.

---

**지난 글:** [memory_profiler: 줄 단위로 메모리 보기](/posts/python-memory-profiler/)

**다음 글:** [py-spy: 코드 수정 없는 샘플링 프로파일러](/posts/python-py-spy/)

<br>
읽어주셔서 감사합니다. 😊
