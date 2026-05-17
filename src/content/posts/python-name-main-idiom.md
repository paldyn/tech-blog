---
title: "if __name__ == \"__main__\" 이디엄 완전 정복"
description: "Python __name__ 변수의 의미, if __name__ == '__main__' 가드의 동작 원리, __main__.py를 활용한 패키지 진입점 설계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["python", "__name__", "__main__", "진입점", "__main__.py", "스크립트"]
featured: false
draft: false
---

[지난 글](/posts/python-importlib-dynamic/)에서 동적 임포트를 살펴봤습니다. 이번에는 Python 코드를 처음 배울 때부터 보지만 막상 깊이 설명하기 어려운 `if __name__ == "__main__":` 이디엄을 해부합니다. 왜 필요한지, 어떻게 활용하는지, 그리고 패키지 수준 진입점인 `__main__.py`까지 정리합니다.

## __name__이란

모든 Python 모듈은 `__name__`이라는 특수 속성을 갖습니다. 그 값은 실행 방식에 따라 달라집니다.

| 실행 방식 | `__name__` 값 |
|---|---|
| `python script.py` | `"__main__"` |
| `import script` | `"script"` (파일 이름) |
| `python -m pkg.script` | `"__main__"` |

Python은 진입점으로 지정된 파일(직접 실행되는 파일)의 `__name__`을 `"__main__"`으로 설정합니다. 임포트되는 파일은 자신의 모듈 이름(파일명에서 `.py` 제거)이 됩니다.

![__name__ == "__main__" 개요](/assets/posts/python-name-main-idiom-overview.svg)

## 이디엄의 역할

```python
# utils.py
def helper(x):
    return x * 2

def main():
    print(helper(21))

if __name__ == "__main__":
    main()
```

이렇게 작성하면:

- `python utils.py`로 직접 실행하면 `main()`이 호출됩니다.
- `from utils import helper`로 임포트하면 `main()`은 호출되지 않습니다.

가드 없이 최상위에 `main()`을 두면 임포트할 때도 실행되어 의도치 않은 동작이나 느린 임포트, 에러를 유발합니다.

## 언제 main()을 함수로 분리해야 하나

단순 스크립트라면 가드 안에 직접 코드를 쓸 수도 있지만, `main()` 함수로 분리하는 것이 낫습니다.

```python
# 단순 버전 (괜찮지만 테스트 어려움)
if __name__ == "__main__":
    result = some_computation()
    print(result)

# 권장 버전 (테스트 가능)
def main():
    result = some_computation()
    print(result)

if __name__ == "__main__":
    main()
```

`main()`을 함수로 만들면 다른 파일에서 `from utils import main`으로 임포트해 테스트할 수 있습니다.

## __main__.py: 패키지 진입점

디렉터리(패키지) 형태의 프로그램을 `python -m myapp`으로 실행하고 싶다면 `__main__.py`를 패키지 루트에 두면 됩니다.

![__main__.py 패턴](/assets/posts/python-name-main-idiom-main-py.svg)

```
myapp/
  __init__.py
  __main__.py   ← python -m myapp 시 실행됨
  core.py
  cli.py
```

```python
# myapp/__main__.py
import sys
from .cli import run_cli

if __name__ == "__main__":
    sys.exit(run_cli())
```

```bash
python -m myapp           # __main__.py 실행
python -m myapp --help    # 인수 전달
```

pip로 배포하는 CLI 도구는 대부분 이 구조를 씁니다. `pip install` 후 `myapp` 명령어로 실행되는 것도 내부적으로 이 진입점을 호출합니다.

## 멀티프로세싱 주의사항

`multiprocessing` 모듈을 사용할 때는 반드시 이디엄이 있어야 합니다. Windows에서는 새 프로세스를 만들 때 부모 스크립트를 임포트하므로, 가드 없이 최상위에 프로세스 생성 코드가 있으면 무한 재귀가 발생합니다.

```python
# 반드시 이렇게 작성
from multiprocessing import Pool

def worker(x):
    return x * x

if __name__ == "__main__":  # 없으면 Windows에서 무한 생성
    with Pool(4) as p:
        print(p.map(worker, range(10)))
```

## console_scripts 엔트리포인트

`pyproject.toml`에서 CLI 명령어를 등록할 때 `main()` 함수가 진입점이 됩니다.

```toml
# pyproject.toml
[project.scripts]
myapp = "myapp.cli:main"
```

이 경우 `__main__.py`의 `if __name__ == "__main__":` 가드와 독립적으로 `myapp.cli.main`이 직접 호출됩니다.

```python
# myapp/cli.py
def main():
    print("CLI entry point")

if __name__ == "__main__":  # python -m myapp.cli 지원용
    main()
```

---

**지난 글:** [importlib로 동적 임포트](/posts/python-importlib-dynamic/)

**다음 글:** [모듈 캐싱과 sys.modules](/posts/python-module-caching/)

<br>
읽어주셔서 감사합니다. 😊
