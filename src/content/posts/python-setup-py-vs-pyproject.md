---
title: "setup.py vs pyproject.toml: 패키징 설정의 세대 교체"
description: "명령형 setup.py에서 선언형 pyproject.toml로 넘어온 패키징 설정의 흐름과 그 이유, 마이그레이션 요령까지 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["setup.py", "pyproject", "패키징", "마이그레이션", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pyproject-toml/)에서 `pyproject.toml`의 구조를 살펴봤다. 그런데 오래된 프로젝트를 열면 여전히 `setup.py`가 보이고, 자료를 찾아보면 `setup.cfg`라는 것도 등장한다. 같은 일을 하는 파일이 왜 셋이나 있을까. 이번 글은 패키징 설정이 `setup.py`에서 `pyproject.toml`로 넘어온 과정을 정리하고, 둘의 본질적 차이가 무엇인지, 기존 프로젝트는 어떻게 옮기면 되는지를 다룬다.

## 세 세대의 흐름

파이썬 패키징 설정은 크게 세 단계를 거쳐 왔다.

![패키징 설정의 세대 교체](/assets/posts/python-setup-py-vs-pyproject-generations.svg)

`setup.py`는 가장 오래된 방식으로, **실행되는 파이썬 코드**다. `setup.cfg`는 그 값을 정적 INI 파일로 빼낸 과도기 형태이고, `pyproject.toml`은 표준 선언 형식으로 정착한 현재의 기본이다. 셋은 지금도 모두 동작하지만, 새 프로젝트라면 `pyproject.toml`이 표준이다.

## 핵심 차이: 명령형 vs 선언형

가장 중요한 차이는 "코드냐 데이터냐"다. `setup.py`는 패키징할 때 **실제로 실행되는 스크립트**다. `setup()` 함수에 인자를 넘기는 형태인데, 그 인자값을 코드로 계산할 수도 있다.

![명령형 vs 선언형](/assets/posts/python-setup-py-vs-pyproject-compare.svg)

```python
# setup.py — 실행되는 코드
from setuptools import setup

setup(
    name="myapp",
    version="0.1.0",
    install_requires=["requests>=2.31"],
)
```

이 유연함은 양날의 검이다. 버전을 코드로 동적 생성하거나 환경에 따라 분기할 수 있는 반면, **설정을 읽으려면 코드를 실행해야 한다**는 위험과 불편이 따른다. 도구가 의존성 목록을 알아내려고 임의의 파이썬 코드를 실행해야 한다면, 보안·재현성·정적 분석 모두에서 불리하다.

반면 `pyproject.toml`은 그냥 데이터다. 실행 없이 안전하게 읽을 수 있다.

```toml
# pyproject.toml — 선언적 데이터
[project]
name = "myapp"
version = "0.1.0"
dependencies = ["requests>=2.31"]
```

도구는 이 파일을 파싱만 하면 되므로, 코드 실행에 따르는 위험이 사라지고 어떤 도구든 일관되게 정보를 읽을 수 있다. 표준화가 가능해진 근본 이유가 여기에 있다.

## setup.py는 죽었나

아니다. `setup.py`는 여전히 유효하고, C 확장을 컴파일하는 등 **빌드 과정에 실제 로직이 필요한 경우**에는 오히려 적합하다. 다만 단순히 메타데이터를 적기 위한 용도라면, 이제는 `pyproject.toml`의 `[project]`로 충분하다. 실제로 `setuptools`를 백엔드로 쓰면서도 메타데이터는 `pyproject.toml`에 선언하는 조합이 흔하다.

```toml
[build-system]
requires = ["setuptools>=64"]
build-backend = "setuptools.build_meta"

[project]
name = "myapp"
version = "0.1.0"
dependencies = ["requests>=2.31"]
```

이렇게 하면 빌드는 익숙한 `setuptools`가 맡되, 설정은 선언형으로 깔끔하게 유지된다.

## 기존 프로젝트 옮기기

마이그레이션은 의외로 단순하다. `setup.py`나 `setup.cfg`에 흩어진 메타데이터를 `pyproject.toml`의 `[project]`로 옮기고, `[build-system]`에 백엔드를 명시하면 된다. 동적 로직이 없는 평범한 프로젝트라면 `setup.py`를 통째로 지워도 된다.

옮긴 뒤에는 빌드가 정상인지 확인한다.

```bash
python -m build
twine check dist/*
```

`build`로 결과물이 만들어지고 `twine check`가 통과하면, 메타데이터가 올바르게 옮겨진 것이다.

정리하면, 이 전환은 단순한 형식 변경이 아니라 "설정은 실행이 아니라 선언이어야 한다"는 사고의 전환이다. 코드를 실행하지 않고도 프로젝트의 모든 것을 읽을 수 있게 되면서, 도구 생태계 전체가 더 빠르고 안전하고 호환 가능해졌다. 다음 글에서는 이렇게 빌드된 결과물, 즉 wheel과 sdist라는 두 배포 형식의 차이를 살펴본다.

---

**지난 글:** [pyproject.toml: 프로젝트 설정의 단일 표준](/posts/python-pyproject-toml/)

**다음 글:** [wheel vs sdist: 두 가지 배포 아티팩트](/posts/python-wheel-vs-sdist/)

<br>
읽어주셔서 감사합니다. 😊
