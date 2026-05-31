---
title: "PDM: 표준을 따르는 현대적 패키지 관리자"
description: "PDM이 PEP 621 표준 메타데이터를 그대로 쓰면서 빠른 의존성 해결과 lock을 제공하는 방식을, 핵심 명령과 Poetry와의 차이까지 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["PDM", "PEP621", "의존성", "패키징", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-poetry-overview/)에서 Poetry로 의존성·환경·패키징을 한 도구로 묶는 흐름을 봤다. PDM은 그 흐름의 장점을 거의 그대로 가져오면서, 한 가지 철학을 더 분명히 한다. **독자적인 포맷을 만들지 않고 파이썬 표준을 그대로 따른다**는 것이다. 그래서 PDM으로 작성한 프로젝트 설정은 PDM이 아니어도 표준을 이해하는 다른 도구가 읽을 수 있다.

## 표준 메타데이터를 그대로 쓴다

PDM의 가장 큰 특징은 의존성과 프로젝트 정보를 **PEP 621 표준 형식**인 `[project]` 테이블에 적는다는 점이다. 이는 파이썬 패키징 생태계가 합의한 공식 메타데이터 형식이라, 특정 도구에 묶이지 않는다.

![PDM: 표준을 그대로 따른다](/assets/posts/python-pdm-standards.svg)

같은 일을 하더라도 Poetry는 한동안 `[tool.poetry]`라는 자체 영역을 썼던 반면, PDM은 처음부터 표준 `[project]`를 쓴다. 이 차이는 사소해 보여도, 나중에 도구를 바꾸거나 다른 도구와 섞어 쓸 때 이식성에서 큰 차이를 만든다.

## 시작과 기본 명령

`pdm init`으로 프로젝트를 초기화하면 대화형으로 파이썬 버전과 기본 정보를 묻고 `pyproject.toml`을 만들어 준다.

```bash
pdm init                # 대화형으로 pyproject.toml 생성
pdm add requests        # 의존성 추가 + pdm.lock 갱신 + 설치
pdm add -dG dev pytest  # 개발 의존성 그룹에 추가
```

`pdm add` 역시 의존성 기록·잠금·설치를 한 번에 처리한다. 설치된 환경은 `pdm.lock`으로 잠겨, 누가 설치하든 같은 버전 조합이 재현된다.

![PDM 기본 명령](/assets/posts/python-pdm-workflow.svg)

## 환경 재현과 실행

협업자는 받은 `pyproject.toml`과 `pdm.lock`으로 동일한 환경을 만든다.

```bash
pdm install                 # lock 기준으로 환경 동기화
pdm run python app.py       # 프로젝트 환경에서 실행
pdm update                  # 허용 범위 내에서 최신화 + lock 갱신
```

`pdm run`은 Poetry의 `poetry run`과 같은 역할로, 프로젝트가 관리하는 환경 안에서 명령을 실행한다. 자주 쓰는 명령은 `[tool.pdm.scripts]`에 별칭으로 등록해 `pdm run test`처럼 짧게 부를 수도 있다.

## __pypackages__ 라는 선택지

PDM은 가상환경을 쓰는 일반적인 방식 외에, **PEP 582**가 제안한 `__pypackages__` 방식도 지원한다. 이는 프로젝트 폴더 안의 `__pypackages__` 디렉터리에 의존성을 두고, 활성화 절차 없이 그 폴더 기준으로 패키지를 찾게 하는 방식이다. venv를 만들고 활성화하는 단계를 건너뛸 수 있다는 게 매력이지만, 표준 자체는 채택이 보류된 실험적 방식이라 팀에서 도입하기 전에 호환성을 확인하는 게 좋다. 익숙하지 않다면 기본인 가상환경 방식을 그대로 쓰면 된다.

## 언제 PDM을 고를까

PDM과 Poetry는 기능이 상당히 겹친다. 선택의 기준을 정리하면 이렇다. **표준 `[project]` 메타데이터를 우선하고 싶거나**, Poetry의 의존성 해결 속도에 답답함을 느꼈다면 PDM이 좋은 대안이다. PDM의 해결기는 비교적 빠른 편이고, 표준을 따르므로 나중에 빌드 백엔드나 다른 도구로 갈아탈 때 마찰이 적다.

```toml
# pyproject.toml — PDM은 표준 [project]를 그대로 사용
[project]
name = "myapp"
version = "0.1.0"
dependencies = ["requests>=2.31"]

[tool.pdm]
# PDM 전용 설정은 이 영역에만 둔다
```

다만 "가장 빠른 설치"라는 한 가지 축에서는, 다음 글에서 볼 uv가 또 한 단계를 더 가져갔다. PDM은 표준 친화성과 균형 잡힌 기능으로, uv는 압도적인 속도로 각자의 자리를 차지하고 있다. 무엇을 고르든, 의존성을 범위로 선언하고 lock으로 고정한다는 원칙은 동일하다는 점만 기억하면 도구 전환은 어렵지 않다.

---

**지난 글:** [Poetry: 의존성·환경·패키징을 한 도구로](/posts/python-poetry-overview/)

**다음 글:** [uv: Rust로 다시 쓴 초고속 패키지 매니저](/posts/python-uv-package-manager/)

<br>
읽어주셔서 감사합니다. 😊
