---
title: "셔뱅(Shebang)과 스크립트 실행 권한"
description: "Python 스크립트 첫 줄의 셔뱅(#!) 라인이 무엇인지, chmod +x와 함께 스크립트를 직접 실행하는 방법, 가상환경과의 관계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "shebang", "셔뱅", "스크립트", "chmod", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-modules-import-basics/)에서 모듈과 import를 살펴봤다. 이번에는 Python 스크립트 파일의 첫 줄에 종종 보이는 `#!/usr/bin/env python3` — **셔뱅(shebang)** 라인이 무엇인지, 왜 쓰는지, 어떻게 활용하는지를 다룬다.

## 셔뱅이란

셔뱅(shebang, hashbang)은 Unix/Linux 계열 운영체제에서 스크립트 파일의 첫 줄에 적는 특수한 주석이다. `#!` (hash + bang) 으로 시작하기 때문에 이 이름이 붙었다.

```bash
#!/usr/bin/env python3
```

Python 입장에서 `#`으로 시작하는 줄은 주석이라 무시된다. 그러나 운영체제 커널은 이 줄을 읽어 **어떤 인터프리터로 파일을 실행할지** 결정한다.

## 왜 필요한가

일반적으로 Python 스크립트를 실행하려면 인터프리터를 명시해야 한다.

```bash
python3 hello.py
```

셔뱅과 실행 권한을 함께 설정하면 인터프리터 이름 없이 직접 실행할 수 있다.

```bash
./hello.py
```

명령줄 도구(CLI tool)처럼 사용자가 직접 실행하는 스크립트에 특히 유용하다.

## 셔뱅 작성법

### 권장: `env` 사용

```bash
#!/usr/bin/env python3
```

`env`는 현재 환경의 `PATH`에서 `python3`를 탐색해 실행한다. 시스템마다 Python 설치 위치가 달라도 올바르게 동작한다.

### 비권장: 경로 하드코딩

```bash
#!/usr/bin/python3
```

특정 경로에 Python이 없으면 실행되지 않는다. 이식성이 낮아 권장하지 않는다.

## 실행 권한 부여

셔뱅만 있다고 `./hello.py`가 동작하지 않는다. 파일에 **실행 권한**이 있어야 한다.

```bash
chmod +x hello.py
./hello.py
```

`chmod +x`는 파일의 실행(execute) 권한 비트를 설정한다. `ls -l`로 확인하면 `-rwxr-xr-x` 처럼 `x`가 보인다.

```bash
ls -l hello.py
# -rwxr-xr-x  1 user  staff  47 May 10 hello.py
```

![셔뱅(Shebang) 라인 사용법](/assets/posts/python-shebang-execution-example.svg)

## 완전한 예시

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys

def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "World"
    print(f"Hello, {name}!")

if __name__ == "__main__":
    main()
```

```bash
chmod +x greet.py
./greet.py 파이썬
# → Hello, 파이썬!
```

`sys.argv`는 명령줄 인수 목록이다. `sys.argv[0]`은 스크립트 파일명, `sys.argv[1]`부터 사용자가 전달한 인수다.

## 가상환경과 셔뱅

가상환경(virtual environment)을 활성화하면 `env python3`가 가상환경의 Python을 가리킨다. 따라서 `#!/usr/bin/env python3`를 사용하면 활성화된 가상환경의 Python으로 스크립트가 실행된다.

```bash
python3 -m venv .venv
source .venv/bin/activate
which python3          # /project/.venv/bin/python3
./hello.py             # 가상환경 Python으로 실행
```

패키지 배포 시 `pyproject.toml`의 `[project.scripts]`에 진입점을 등록하면, `pip install` 후 자동으로 셔뱅이 설정된 실행 파일이 생성된다.

![가상환경과 셔뱅 / Windows 실행](/assets/posts/python-shebang-execution-venv.svg)

## Windows에서의 실행

Windows에서는 셔뱅 라인이 기본적으로 무시된다. 대신 Python Launcher(`py.exe`)를 사용하면 `#!` 라인을 부분적으로 인식할 수 있다.

```bat
py -3 hello.py
python hello.py
```

크로스 플랫폼 CLI 도구를 만들 때는 `entry_points`로 배포하는 방식이 Windows에서도 올바르게 동작한다.

## 정리

| 항목 | 내용 |
|------|------|
| 셔뱅 위치 | 파일 최상단 첫 줄 |
| 권장 형태 | `#!/usr/bin/env python3` |
| 실행 권한 | `chmod +x 파일명` |
| 용도 | CLI 도구, 직접 실행 스크립트 |
| Windows | py.exe가 부분 지원 |

---

**지난 글:** [모듈과 import: 코드를 나누고 재사용하는 방법](/posts/python-modules-import-basics/)

**다음 글:** [인코딩과 UTF-8: Python이 텍스트를 다루는 방식](/posts/python-encoding-utf8/)

<br>
읽어주셔서 감사합니다. 😊
