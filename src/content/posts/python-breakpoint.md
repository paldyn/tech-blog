---
title: "breakpoint(): 디버거를 부르는 표준 한 줄"
description: "파이썬 3.7의 내장 함수 breakpoint()와 PYTHONBREAKPOINT 환경변수로 디버거를 호출하고, 교체하고, 한꺼번에 끄는 법을 정리합니다. set_trace와 무엇이 다른지도 짚습니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["breakpoint", "디버깅", "PYTHONBREAKPOINT", "pdb", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pdb-basics/)에서 `pdb`로 코드를 멈춰 세우고 한 줄씩 따라가는 법을 익혔다. 그때 등장한 `breakpoint()`는 사실 단순한 호출문 이상의 의미를 가진다. 파이썬 3.7에서 도입된 이 내장 함수는 "디버거를 부르는 표준 방법"이라는 약속을 언어 차원에서 정한 것이다. 어떤 디버거를 쓸지, 운영에서 어떻게 꺼 둘지를 코드를 고치지 않고도 바깥에서 결정할 수 있게 해 준다. 오늘은 이 한 줄에 담긴 유연함을 들여다본다.

## 왜 set_trace를 대체했나

예전에는 멈추고 싶은 곳에 `import pdb; pdb.set_trace()`를 적었다. 두 줄이라 손이 더 가고, `pdb`라는 특정 디버거에 코드가 묶였다. 다른 디버거를 쓰려면 `import ipdb; ipdb.set_trace()`처럼 import 줄까지 바꿔야 했다.

![옛 방식과 새 방식](/assets/posts/python-breakpoint-vs-settrace.svg)

`breakpoint()`는 import도 필요 없는 내장 함수이고, 어떤 디버거를 실제로 띄울지는 호출 시점에 환경이 결정한다. 코드에는 "여기서 멈춰라"라는 의도만 남고, "무엇으로 멈출지"는 분리된다. 이 분리가 핵심이다.

```python
def parse(line):
    fields = line.split(",")
    breakpoint()          # import 없이 한 줄
    return [f.strip() for f in fields]
```

## PYTHONBREAKPOINT가 디버거를 고른다

`breakpoint()`는 내부적으로 `sys.breakpointhook()`을 호출하고, 이 훅의 기본 동작은 `PYTHONBREAKPOINT` 환경변수를 읽는 것이다. 값이 없으면 기본값으로 `pdb.set_trace`를 부른다. 이 한 단계의 간접 호출 덕분에 동작을 바깥에서 갈아 끼울 수 있다.

![breakpoint와 PYTHONBREAKPOINT](/assets/posts/python-breakpoint-flow.svg)

가장 실용적인 활용은 **운영 배포에서 디버거를 통째로 끄는 것**이다. 실수로 `breakpoint()`가 코드에 남아 운영 서버에서 프로세스가 멈춰 버리는 사고를 막을 수 있다.

```bash
# 디버거를 ipdb로 교체
PYTHONBREAKPOINT=ipdb.set_trace python app.py

# 모든 breakpoint()를 무시 (운영에서 안전장치)
PYTHONBREAKPOINT=0 python app.py
```

`PYTHONBREAKPOINT=0`으로 두면 코드에 `breakpoint()`가 남아 있어도 아무 일도 일어나지 않고 그냥 지나간다. 값으로는 `모듈경로.함수이름` 형식의 임의 호출 대상을 줄 수 있어서, 디버거뿐 아니라 원하는 동작을 끼워 넣는 것도 가능하다.

## 훅을 직접 바꾸기

환경변수 없이 코드 안에서 동작을 바꾸고 싶다면 `sys.breakpointhook`을 직접 교체하면 된다. 예를 들어 디버거 대신 현재 스택을 로그로 남기게 만들 수도 있다.

```python
import sys, traceback

def log_only():
    traceback.print_stack()      # 멈추지 말고 스택만 남겨라

sys.breakpointhook = log_only
breakpoint()                     # 이제 log_only가 불린다
```

이렇게 하면 `breakpoint()`가 "디버거 진입"이라는 의미에서 벗어나, 팀이 정한 임의의 진단 동작을 부르는 표준 진입점이 된다. 코드 곳곳에 흩어진 진단 지점을 한 곳에서 통제할 수 있다는 뜻이다.

## 정리하면

`breakpoint()`는 단순히 `set_trace`의 짧은 별칭이 아니다. "멈추라는 의도"와 "멈추는 방법"을 분리해, 디버거를 교체하고(환경변수), 끄고(`PYTHONBREAKPOINT=0`), 동작을 갈아 끼우는(`sys.breakpointhook`) 자유를 준다. 일상 디버깅에서는 그냥 `breakpoint()` 한 줄이면 충분하고, 필요할 때 환경변수 하나로 그 의미를 바꿀 수 있다는 점만 기억하면 된다. 다음 글에서는 한발 물러서서, 많은 사람이 여전히 의존하는 `print` 디버깅이 왜 자주 우리를 배신하는지 그 함정을 짚어 본다.

---

**지난 글:** [pdb 기초: 파이썬 내장 디버거 시작하기](/posts/python-pdb-basics/)

**다음 글:** [print 디버깅의 함정과 졸업](/posts/python-print-debugging-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
