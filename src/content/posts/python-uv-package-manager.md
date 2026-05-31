---
title: "uv: Rust로 다시 쓴 초고속 패키지 매니저"
description: "uv가 Rust 기반 설계와 전역 캐시로 설치를 극적으로 빠르게 만드는 원리와, pip·venv·pip-tools를 하나로 통합하는 사용법까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["uv", "패키지관리", "속도", "Rust", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pdm/)에서 PDM이 표준을 따르면서 빠른 해결을 제공한다고 했다. 그런데 "빠르다"는 축만 놓고 보면 한 단계를 더 멀리 가져간 도구가 있다. `uv`다. Rust로 작성돼 설치와 의존성 해결이 기존 도구 대비 수십 배 빠르게 느껴질 정도이고, 동시에 pip·venv·pip-tools가 하던 일을 하나의 명령 체계로 통합한다. 최근 파이썬 패키징에서 가장 많이 회자되는 도구다.

## 왜 그렇게 빠른가

속도의 비결은 크게 두 가지다. 첫째, 의존성 해결과 다운로드를 **Rust로 구현하고 병렬화**했다. 여러 패키지를 동시에 내려받고, 버전 충돌을 계산하는 해결기 자체가 빠르다. 둘째, **전역 캐시**를 적극적으로 활용한다. 한 번 받은 패키지는 시스템 전역 캐시에 두고, 다른 프로젝트에서 같은 버전이 필요하면 다시 받지 않고 하드링크로 연결한다.

![uv: Rust로 다시 쓴 속도](/assets/posts/python-uv-speed.svg)

특히 가상환경을 자주 새로 만드는 CI 환경이나, 여러 프로젝트가 비슷한 의존성을 공유하는 상황에서 이 캐시 효과가 크게 체감된다.

## 여러 도구를 하나로

uv는 단순히 빠른 pip가 아니다. 그동안 별도 도구로 하던 일들을 하나의 CLI로 묶는다.

![여러 도구를 uv 하나로](/assets/posts/python-uv-unified.svg)

가상환경 생성, 패키지 설치, 의존성 잠금, 심지어 파이썬 자체 버전 설치까지 `uv` 명령 하나로 처리할 수 있다. 도구를 여럿 익히고 조합하던 부담이 줄어든다는 게 실무에서 큰 장점이다.

## pip 호환 방식으로 쓰기

기존 워크플로를 거의 그대로 두고 속도만 얻고 싶다면, `uv pip` 인터페이스가 가장 진입 장벽이 낮다. 명령 형태가 pip와 사실상 동일하다.

```bash
uv venv                       # .venv 가상환경 생성
uv pip install requests       # pip와 같은 사용감, 훨씬 빠름
uv pip install -r requirements.txt
uv pip freeze > requirements.txt
```

`uv venv`로 환경을 만들고 `uv pip install`로 설치하는 흐름은, 앞서 배운 venv + pip 조합을 그대로 빠르게 대체한다.

## 프로젝트 방식으로 쓰기

Poetry·PDM처럼 `pyproject.toml`과 lock을 중심으로 프로젝트를 관리하는 방식도 지원한다.

```bash
uv init myapp           # 프로젝트 초기화
cd myapp
uv add requests         # 의존성 추가 + uv.lock 갱신 + 설치
uv run python app.py    # 프로젝트 환경에서 실행
uv sync                 # uv.lock 기준으로 환경 동기화
```

`uv add`/`uv sync`/`uv run`의 역할은 앞서 본 다른 도구들과 같다. 의존성을 `pyproject.toml`에 표준 형식으로 적고, `uv.lock`으로 정확한 버전을 고정하며, 환경 안에서 명령을 실행한다. 익숙한 개념 위에 속도만 더해진 셈이다.

## 도입 시 고려할 점

uv는 빠르고 통합적이지만, 비교적 새로운 도구라는 점은 염두에 둘 만하다. 생태계와 사양은 안정화되어 가는 중이며, 팀 표준으로 채택할 때는 CI·배포 파이프라인과의 호환을 한 번 확인하는 것이 좋다. 다행히 `uv pip`가 기존 pip 명령과 거의 호환되므로, 전면 전환 없이 "느린 설치 단계만 uv로 바꾸는" 점진적 도입이 가능하다.

```bash
# CI에서 흔한 패턴 — 캐시 덕분에 반복 빌드가 특히 빠르다
uv venv
uv pip install -r requirements.txt
```

정리하면, pip는 기본기, venv는 격리, Poetry·PDM은 통합, 그리고 uv는 거기에 속도를 더한 도구다. 무엇을 쓰든 핵심 개념(범위 선언과 lock 고정)은 같으니, 팀과 프로젝트 상황에 맞춰 고르면 된다. 다음 글부터는 이 도구들이 공통으로 읽고 쓰는 설정 파일, `pyproject.toml` 자체를 정면으로 들여다본다.

---

**지난 글:** [PDM: 표준을 따르는 현대적 패키지 관리자](/posts/python-pdm/)

**다음 글:** [pyproject.toml: 프로젝트 설정의 단일 표준](/posts/python-pyproject-toml/)

<br>
읽어주셔서 감사합니다. 😊
