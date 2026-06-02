---
title: "memory_profiler: 줄 단위로 메모리 보기"
description: "memory_profiler로 함수의 각 줄이 메모리를 얼마나 쓰는지 측정하는 법. @profile 데코레이터와 Mem usage·Increment 컬럼 읽기, mprof로 시간에 따른 메모리 추이까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["memory_profiler", "메모리", "프로파일링", "성능", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-cprofile/)에서 `cProfile`로 "시간이 어디서 새는지"를 측정했다. 그런데 느림만큼 자주 우리를 괴롭히는 또 다른 문제가 있다. 메모리다. 리스트 하나가 수백 MB로 부풀어 프로세스가 죽거나, 서버 메모리가 야금야금 차오르는 상황 말이다. `cProfile`은 시간을 재지 메모리를 재지 않는다. 이럴 때 필요한 것이 줄 단위로 메모리 사용을 보여 주는 `memory_profiler`다.

## 세 단계로 시작한다

`memory_profiler`는 표준 라이브러리는 아니지만 설치와 사용이 단순하다. 설치하고, 측정할 함수에 데코레이터를 붙이고, 전용 방식으로 실행하면 끝이다.

![세 단계로 쓰기](/assets/posts/python-memory-profiler-usage.svg)

```bash
pip install memory_profiler
```

```python
# build.py
@profile                      # 별도 import 없이 이 이름을 인식한다
def build():
    data = [0] * 10**8        # 큰 리스트
    return sum(data)

build()
```

`@profile`은 `memory_profiler`로 실행할 때 자동으로 인식되는 특별한 이름이라, 평소에는 import할 필요가 없다. 다만 이 데코레이터가 붙은 채로 일반 실행하면 `profile`이 정의되지 않았다는 오류가 나므로, 측정이 끝나면 떼는 것이 보통이다.

## 출력 읽기: Increment에 집중

전용 명령으로 실행하면, 함수의 각 줄 옆에 그 줄이 실행된 뒤의 메모리 사용량과 증가량이 나란히 찍힌다.

```bash
python -m memory_profiler build.py
```

![줄 단위 메모리 측정](/assets/posts/python-memory-profiler-output.svg)

봐야 할 컬럼은 **Increment**다. `Mem usage`는 그 줄 직후의 전체 메모리이고, `Increment`는 그 줄에서 늘어난 양이다. 메모리를 폭발시키는 범인은 `Increment`가 갑자기 큰 줄이다. 위 출력에서 `data = [0] * 10**8` 한 줄이 762 MiB를 더 잡아먹은 것이 한눈에 보인다. 어느 함수가 아니라 **어느 줄**이 문제인지 정확히 짚어 주는 것이 이 도구의 가치다.

## 시간에 따른 추이: mprof

특정 함수 안이 아니라 프로그램 전체가 시간이 흐르며 메모리를 어떻게 쓰는지 보고 싶을 때는 `mprof`를 쓴다. 메모리 누수처럼 "조금씩 계속 차오르는" 패턴을 잡는 데 유용하다.

```bash
mprof run app.py      # 실행하며 메모리 추이를 기록
mprof plot            # 시간-메모리 그래프를 그린다
```

`mprof run`은 프로그램을 돌리며 일정 간격으로 전체 메모리를 샘플링해 기록하고, `mprof plot`은 그것을 시간축 그래프로 그려 준다. 그래프가 톱니 모양으로 오르내리면 정상적인 할당과 해제, 우상향으로 꾸준히 오르기만 하면 누수를 의심한다.

## 주의할 점

`memory_profiler`는 편리하지만 공짜는 아니다. 줄마다 메모리를 측정하느라 코드 실행이 눈에 띄게 느려지므로, 운영 환경이 아니라 개발·분석 단계에서 의심 구간에만 붙이는 것이 맞다. 또한 측정값은 운영체제가 보고하는 프로세스 메모리(RSS) 기준이라, 파이썬이 내부적으로 잡아 둔 메모리 풀 때문에 해제한 객체가 곧바로 줄어들지 않을 수도 있다. 절대값보다는 **줄 사이의 상대적 증가량**을 보는 관점이 안전하다.

정리하면, 시간 병목은 `cProfile`로, 메모리 병목은 `memory_profiler`로 본다. 특히 `Increment`가 큰 줄을 찾는 것만으로도 "왜 이렇게 메모리를 먹지?"라는 막연함이 구체적인 한 줄로 좁혀진다. 다만 이 도구는 데코레이터를 붙여야 한다. 코드를 건드리지 않고 표준 라이브러리만으로 메모리 할당을 추적하고 싶다면, 다음 글의 `tracemalloc`이 답이다.

---

**지난 글:** [cProfile: 시간이 어디서 새는지 측정하기](/posts/python-cprofile/)

**다음 글:** [tracemalloc: 메모리 할당을 추적하기](/posts/python-tracemalloc/)

<br>
읽어주셔서 감사합니다. 😊
