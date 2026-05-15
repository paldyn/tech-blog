---
title: "스크립트 vs REPL: Python 실행 방식의 차이"
description: "Python을 실행하는 두 가지 방식, 스크립트 파일과 REPL(대화형 셸)의 차이를 비교합니다. 각각 언제 어떻게 사용하는지 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "REPL", "스크립트", "실행방식", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-input-print/)에서 `print()`와 `input()` 함수를 살펴봤다. 이번에는 Python 코드를 실제로 실행하는 두 가지 방식—**스크립트 파일**과 **REPL(대화형 셸)**—을 비교한다. 두 모드의 차이를 이해하면 상황에 따라 올바른 도구를 선택할 수 있다.

## Python 인터프리터는 두 가지 얼굴이 있다

터미널에서 `python3`를 인수 없이 실행하면 대화형 셸(REPL)이 시작된다. `.py` 파일을 인수로 전달하면 스크립트 모드로 실행된다.

```bash
python3           # REPL 시작 → >>> 프롬프트
python3 hello.py  # 스크립트 실행
```

## REPL — Read-Eval-Print Loop

REPL이란 이름 그대로 **읽고(Read)** → **평가하고(Eval)** → **출력하고(Print)** → **반복(Loop)**하는 방식이다. `>>>` 프롬프트가 표시되면 코드를 한 줄씩 입력할 수 있다.

```python
>>> 1 + 2
3
>>> name = "파이썬"
>>> name
'파이썬'
>>> len(name)
3
```

REPL에서 핵심적인 특징은 **표현식을 입력하면 그 값이 자동으로 출력된다**는 점이다. `print()`를 호출하지 않아도 된다. 변수 이름만 입력해도 값을 확인할 수 있다.

### 유용한 REPL 기능

**마지막 결과 `_`**: 직전에 출력된 결과가 `_` 변수에 자동으로 저장된다.

```python
>>> 3 * 7
21
>>> _ + 1
22
```

**내장 도움말**: `help()`와 `dir()`으로 함수와 객체를 탐색할 수 있다.

```python
>>> help(str.split)    # split() 사용법 확인
>>> dir([])            # 리스트 메서드 목록 확인
```

**종료**: `exit()`, `quit()`, 또는 Ctrl+D(Unix) / Ctrl+Z+Enter(Windows)로 종료한다.

## 스크립트 모드 — 파일 실행

코드를 `.py` 파일에 저장하고 `python3 파일명.py`로 실행하는 방식이다. 스크립트 모드에서는 **표현식의 값이 자동으로 출력되지 않는다**. `print()`를 명시적으로 호출해야 화면에 표시된다.

```python
# hello.py
x = 1 + 2      # 화면에 아무것도 출력되지 않음
print(x)       # 이래야 3이 출력됨
```

스크립트에서는 함수, 클래스, 복잡한 로직을 구조화할 수 있고, 같은 코드를 반복해서 실행할 수 있다.

### `if __name__ == "__main__"` 관용구

스크립트를 직접 실행할 때만 특정 코드를 실행하고, 다른 파일에서 임포트할 때는 실행하지 않으려면 이 관용구를 사용한다.

```python
# greet.py
def greet(name):
    return f"안녕, {name}!"

if __name__ == "__main__":
    msg = greet("파이썬")
    print(msg)
```

`python3 greet.py`로 실행하면 `__name__`이 `"__main__"`이 되어 `if` 블록이 실행된다. 다른 파일에서 `import greet`로 가져오면 `__name__`이 `"greet"`가 되어 블록이 실행되지 않는다.

![스크립트 모드 vs REPL 모드](/assets/posts/python-script-vs-repl-comparison.svg)

## -c 옵션 — 명령줄에서 한 줄 실행

파일을 만들지 않고 셸에서 짧은 Python 코드를 실행하려면 `-c` 옵션을 사용한다.

```bash
python3 -c "print(1 + 1)"
python3 -c "import sys; print(sys.version)"
```

셸 스크립트에서 Python 기능을 호출할 때 유용하다.

## 고급 REPL 도구

기본 REPL보다 강력한 기능을 원한다면 **IPython**이나 **Jupyter Notebook**을 사용한다.

| 도구 | 특징 |
|------|------|
| IPython | 자동완성, 구문 강조, 매직 명령어(`%timeit` 등) |
| Jupyter Notebook | 셀 단위 실행, 시각화 인라인 표시 |
| bpython | 즉시 자동완성, 함수 시그니처 표시 |

```bash
pip install ipython
ipython
```

![Python 실행 방식 선택 가이드](/assets/posts/python-script-vs-repl-modes.svg)

## 두 모드의 핵심 차이 정리

| 항목 | REPL | 스크립트 |
|------|------|----------|
| 표현식 자동 출력 | O | X (print 필요) |
| 실행 지속성 | 종료 시 소멸 | 파일로 저장 |
| 적합한 상황 | 탐색·실험·학습 | 반복 실행·배포 |
| 멀티라인 입력 | `...` 프롬프트 | 그대로 |

처음 Python을 배울 때는 REPL에서 실험하고, 코드가 동작하면 스크립트 파일로 옮기는 방식이 가장 효율적이다. 두 모드를 자유롭게 오가는 것이 Python 개발의 기본 흐름이다.

---

**지난 글:** [input()과 print(): 표준 입출력 완전 정리](/posts/python-input-print/)

**다음 글:** [모듈과 import: 코드를 나누고 재사용하는 방법](/posts/python-modules-import-basics/)

<br>
읽어주셔서 감사합니다. 😊
