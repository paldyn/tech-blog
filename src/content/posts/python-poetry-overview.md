---
title: "Poetry: 의존성·환경·패키징을 한 도구로"
description: "Poetry로 의존성 해결과 lock, 가상환경, 빌드·배포를 하나의 워크플로로 묶는 법을, 핵심 명령과 동작 방식까지 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Poetry", "의존성", "lock", "패키징", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-virtualenv-venv/)에서 venv로 환경을 격리하고 requirements.txt로 의존성을 공유하는 법을 봤다. 잘 동작하지만, 환경 만들기·의존성 설치·버전 잠금·패키지 빌드가 모두 따로 노는 게 불편하다. Poetry는 이 흩어진 작업들을 **하나의 명령 체계와 하나의 설정 파일**로 묶어 준다. 의존성 관리에 익숙해진 파이썬 사용자들이 가장 먼저 손에 익히는 통합 도구 중 하나다.

## 한 도구로 묶인다는 것

Poetry는 프로젝트 정보를 `pyproject.toml`에 적고, 그것을 바탕으로 의존성 해결·가상환경·빌드까지 일관되게 처리한다.

![Poetry 하나로 묶이는 작업](/assets/posts/python-poetry-overview-one-tool.svg)

특히 중요한 건 **의존성 해결과 잠금**이다. `pyproject.toml`에는 "requests 2.31 이상"처럼 범위를 적지만, Poetry는 그 범위를 만족하는 정확한 버전 조합을 계산해 `poetry.lock`에 박아 둔다. 이 lock 파일 덕분에 누가 언제 설치하든 완전히 같은 버전이 깔린다.

## 시작과 의존성 추가

새 프로젝트는 `new`로 골격을 만들거나, 기존 폴더에서는 `init`으로 `pyproject.toml`만 생성한다.

```bash
poetry new myapp        # src 구조까지 갖춘 새 프로젝트
cd myapp
poetry add requests     # 의존성 추가 + lock 갱신 + 설치
```

`poetry add`는 한 명령으로 세 가지를 한다. `pyproject.toml`에 의존성을 적고, 호환되는 버전을 해결해 `poetry.lock`에 기록하고, 가상환경에 설치까지 한다. 개발용으로만 필요한 도구는 그룹을 나눠 추가한다.

```bash
poetry add --group dev pytest ruff
```

![Poetry 기본 명령](/assets/posts/python-poetry-overview-workflow.svg)

## 환경 재현과 실행

`pyproject.toml`과 `poetry.lock`을 받은 사람은 `install` 한 번으로 동일한 환경을 만든다. lock 파일이 있으면 그 안에 박힌 정확한 버전을, 없으면 범위를 새로 해결한 뒤 lock을 만든다.

```bash
poetry install
```

Poetry는 기본적으로 프로젝트 전용 가상환경을 자동으로 만들어 관리하므로, venv를 직접 만들고 활성화할 필요가 없다. 환경 안에서 명령을 실행할 땐 `run`을 앞에 붙이거나, 셸을 그 환경으로 열어 작업한다.

```bash
poetry run pytest
poetry run python app.py
```

의존성을 최신으로 올리고 싶을 때는 `update`를 쓴다. 이때 `pyproject.toml`에 적힌 범위는 그대로 존중하면서 그 안에서 더 최신 버전으로 lock을 갱신한다.

```bash
poetry update          # 범위 내에서 최신화 + lock 갱신
```

## 빌드와 배포까지

Poetry의 또 다른 강점은 패키징을 같은 도구로 끝낼 수 있다는 점이다. 배포물(wheel·sdist)을 만들고 PyPI에 올리는 일이 명령 두 개로 정리된다.

```bash
poetry build           # dist/ 에 wheel + sdist 생성
poetry publish         # PyPI 업로드
```

이 빌드·배포 단계의 세부(wheel과 sdist의 차이, PyPI 업로드)는 뒤의 글에서 도구에 종속되지 않은 일반론으로 더 깊이 다룬다.

## 무엇을 커밋하고, 무엇을 주의할까

`pyproject.toml`과 `poetry.lock`은 **둘 다 저장소에 커밋**한다. 전자는 "무엇을 원하는지", 후자는 "정확히 무엇이 설치됐는지"를 담으며, lock을 함께 올려야 협업자와 CI가 동일한 환경을 재현한다. 반대로 가상환경 폴더 자체는 커밋하지 않는다.

주의할 점도 있다. 의존성이 많은 큰 프로젝트에서 Poetry의 해결 과정이 느릴 수 있고, 이 약점을 정조준해 더 빠른 도구들이 나왔다. 다음 글에서 다룰 PDM, 그리고 그 뒤의 uv가 그런 대안이다. 하지만 "선언은 범위로, 잠금은 lock으로, 실행은 도구가 환경 안에서"라는 큰 그림은 어느 도구를 쓰든 같다. Poetry로 그 흐름을 한 번 익혀 두면 나머지는 명령 이름만 바꿔 끼우면 된다.

---

**지난 글:** [venv: 프로젝트마다 격리된 가상환경 만들기](/posts/python-virtualenv-venv/)

**다음 글:** [PDM: 표준을 따르는 현대적 패키지 관리자](/posts/python-pdm/)

<br>
읽어주셔서 감사합니다. 😊
