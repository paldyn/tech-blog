---
title: "cProfile: 시간이 어디서 새는지 측정하기"
description: "표준 라이브러리 cProfile로 함수별 실행 시간을 측정하는 법. ncalls·tottime·cumtime의 차이, sort_stats로 병목을 찾는 흐름, 측정 없이 추측하지 말라는 원칙까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["cProfile", "프로파일링", "성능", "최적화", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-logging-config/)에서 로거 계층과 `dictConfig`로 "무엇이 잘못됐나"를 기록하는 도구를 갖췄다. 이제 질문이 바뀐다. 코드가 동작은 하는데 느릴 때, 우리는 어디를 고쳐야 할까? 경험 많은 개발자조차 "여기가 느릴 거야"라는 직감은 자주 틀린다. 추측으로 엉뚱한 곳을 최적화하느라 시간을 버리는 대신, 측정부터 하는 것이 프로파일링의 첫 번째 규칙이다. 표준 라이브러리 `cProfile`은 추가 설치 없이 바로 그 측정을 해 준다.

## 측정 없이 추측하지 말 것

프로그래밍에는 오래된 격언이 있다. "성급한 최적화는 만악의 근원이다." 절반만 인용되곤 하는데, 진짜 핵심은 그다음이다. **시간의 97%를 차지하는 그 작은 부분을 찾아내려면 측정해야 한다.** `cProfile`은 프로그램이 도는 동안 모든 함수 호출의 횟수와 소요 시간을 모아, 어디서 시간이 새는지 숫자로 보여 준다.

가장 간단하게는 코드를 건드리지 않고 명령행에서 모듈로 실행한다.

```bash
python -m cProfile -s tottime app.py
```

`-s tottime`은 결과를 "함수 자체에서 쓴 시간" 기준으로 정렬하라는 뜻이다. 출력 맨 위에 뜨는 함수가 곧 최적화 후보다.

## 출력의 네 컬럼만 읽으면 된다

`cProfile`의 출력은 처음 보면 빽빽하지만, 실제로 봐야 할 컬럼은 넷뿐이다.

![cProfile 출력 읽는 법](/assets/posts/python-cprofile-columns.svg)

가장 중요한 구분은 **tottime과 cumtime**이다. `tottime`(total time)은 그 함수 **자체**가 쓴 시간으로, 하위 함수 호출에 든 시간은 빠진다. `cumtime`(cumulative time)은 그 함수가 부른 모든 하위 호출까지 **포함한** 누적 시간이다. 어떤 함수의 `cumtime`은 크지만 `tottime`이 작다면, 느린 건 그 함수가 아니라 그것이 호출한 안쪽 어딘가다. 반대로 `tottime`이 큰 함수가 진짜 일을 많이 하는, 손볼 곳이다.

```text
   ncalls  tottime  percall  cumtime  percall  filename:lineno(function)
     1000    2.100    0.002    2.450    0.002  app.py:42(parse)
     5000    0.300    0.000    0.350    0.000  util.py:8(clean)
```

`ncalls`(호출 횟수)도 함께 보면 단서가 두 배가 된다. `tottime`이 큰데 `ncalls`도 엄청나게 많다면, 함수 한 번이 느린 게 아니라 "너무 자주 부르는 것"이 문제일 수 있다. 그럴 땐 캐싱이나 호출 횟수 줄이기가 답이다.

## 측정에서 해석까지의 흐름

코드 안에서 특정 구간만 측정하고 싶다면 `cProfile.run`이나 `Profile` 객체를 직접 쓴다. 결과를 `pstats`로 받아 정렬하고 상위 몇 줄만 추려 보는 것이 전형적인 흐름이다.

![측정에서 해석까지](/assets/posts/python-cprofile-flow.svg)

```python
import cProfile, pstats

profiler = cProfile.Profile()
profiler.enable()
run_pipeline(data)              # 측정하고 싶은 구간
profiler.disable()

stats = pstats.Stats(profiler)
stats.sort_stats("tottime").print_stats(10)   # 상위 10개만
```

`enable()`과 `disable()` 사이의 코드만 측정되므로, 프로그램 전체가 아니라 의심되는 구간을 콕 집어 잴 수 있다. `print_stats(10)`처럼 개수를 주면 상위 N개만 보여 줘서, 수백 줄의 출력에 파묻히지 않는다.

## cProfile이 맞지 않는 경우

`cProfile`은 함수 호출 단위로 측정한다. 따라서 "어느 함수가 느린가"에는 강하지만, "한 함수 안에서 어느 줄이 느린가"는 알려 주지 않는다. 또한 모든 호출을 계측하기 때문에 약간의 오버헤드가 있어, 호출이 극도로 많은 코드에서는 측정 자체가 결과를 왜곡할 수 있다. 줄 단위 분석이 필요하면 별도 도구를, 운영 중인 프로세스를 건드리지 않고 보려면 샘플링 프로파일러를 쓴다. 이 둘은 다음 글들에서 차례로 다룬다.

핵심은 변하지 않는다. **고치기 전에 측정하라.** `cProfile`은 그 측정을 가장 적은 수고로 시작하게 해 준다. `tottime` 상위 몇 줄만 봐도, 막연했던 "느림"이 구체적인 함수 이름으로 바뀐다. 다음 글에서는 시간이 아니라 메모리로 눈을 돌려, 줄 단위로 메모리 사용을 들여다보는 `memory_profiler`를 살펴본다.

---

**지난 글:** [logging 설정: 로거 계층과 dictConfig](/posts/python-logging-config/)

**다음 글:** [memory_profiler: 줄 단위로 메모리 보기](/posts/python-memory-profiler/)

<br>
읽어주셔서 감사합니다. 😊
