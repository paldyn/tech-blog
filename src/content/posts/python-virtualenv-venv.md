---
title: "venv: 프로젝트마다 격리된 가상환경 만들기"
description: "venv로 프로젝트별 의존성을 격리해 버전 충돌을 없애는 법을, 생성·활성화·동작 원리와 흔한 함정까지 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["venv", "가상환경", "격리", "의존성", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pip-basics/)에서 pip로 패키지를 설치할 때 시스템 전역에는 설치하지 말라고 했다. 그 이유와 해법이 이번 글의 주제다. 프로젝트가 둘만 돼도 서로 다른 버전의 같은 라이브러리가 필요해지는 일이 금방 생기는데, 모두 한곳에 설치하면 충돌이 불가피하다. 파이썬 표준 라이브러리에 들어 있는 `venv`는 프로젝트마다 독립된 설치 공간을 만들어 이 문제를 깔끔하게 해결한다.

## 왜 격리가 필요한가

가상환경의 가치는 충돌 상황을 떠올리면 분명해진다. 프로젝트 A는 Django 3.2에서, 프로젝트 B는 Django 5.0에서 동작한다고 하자. 둘 다 시스템 전역에 설치하려 하면, Django는 한 환경에 한 버전만 존재할 수 있으므로 둘 중 하나는 반드시 깨진다.

![전역 설치 vs 가상환경 격리](/assets/posts/python-virtualenv-venv-isolation.svg)

가상환경은 프로젝트마다 **별도의 `site-packages`를 가진 작은 파이썬 환경**을 만든다. A의 환경에는 Django 3.2를, B의 환경에는 5.0을 설치해도 서로를 전혀 건드리지 않는다. 시스템 파이썬도 그대로 보존된다.

## 만들고 활성화하기

`venv`는 모듈로 실행한다. 보통 프로젝트 폴더 안에 `.venv`라는 이름으로 만든다.

```bash
python -m venv .venv
```

이 명령은 `.venv` 디렉터리에 인터프리터 사본과 빈 `site-packages`, 그리고 활성화 스크립트를 만들어 둔다. 이제 **활성화**를 하면, 그 셸 세션에서 `python`과 `pip`가 이 환경을 가리키도록 `PATH`가 바뀐다.

![venv 사용 흐름](/assets/posts/python-virtualenv-venv-lifecycle.svg)

```bash
# macOS / Linux
source .venv/bin/activate

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
```

활성화되면 프롬프트 앞에 `(.venv)` 같은 표시가 붙는다. 이 상태에서 설치하는 패키지는 모두 이 환경 안으로만 들어간다.

```bash
pip install requests
python app.py
```

작업이 끝나면 `deactivate` 한 줄로 원래 셸로 돌아온다.

## 활성화는 사실 편의일 뿐이다

활성화가 마법처럼 느껴지지만, 본질은 단순히 실행 경로를 바꾸는 것이다. 그래서 활성화를 건너뛰고 환경 안의 인터프리터를 직접 가리켜 실행해도 결과는 같다. CI 스크립트나 Makefile처럼 셸을 활성화하기 번거로운 곳에서 이 방식이 유용하다.

```bash
.venv/bin/python -m pip install requests
.venv/bin/python app.py
```

핵심은 "어떤 파이썬으로 실행하느냐"가 곧 "어떤 환경을 쓰느냐"라는 점이다. `.venv/bin/python`을 쓰면 그 환경이, 시스템 `python`을 쓰면 전역 환경이 선택된다.

## 함정과 운영 요령

**`.venv`는 저장소에 올리지 않는다.** 가상환경 폴더에는 플랫폼에 종속된 바이너리와 사본이 들어 있어, 다른 사람의 OS에서는 그대로 동작하지 않는다. 대신 `.gitignore`에 `.venv/`를 추가하고, 환경을 재현하는 정보는 `requirements.txt`(또는 lock 파일)로 공유한다. 받은 사람은 가상환경을 새로 만들고 그 목록으로 복원하면 된다.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**활성화한 셸과 안 한 셸을 헷갈리지 말 것.** 패키지가 "분명히 깔았는데 import가 안 된다"는 문제의 상당수는, 설치할 때와 실행할 때의 환경이 달랐던 경우다. 지금 어떤 파이썬을 쓰는지 확신이 안 서면 다음으로 확인한다.

```bash
which python      # 경로가 .venv 안을 가리키는지
python -c "import sys; print(sys.prefix)"
```

`sys.prefix`가 `.venv` 경로를 가리키면 가상환경 안에 들어와 있는 것이다.

venv는 표준 라이브러리에 포함돼 추가 설치가 필요 없고, 어떤 환경에서도 동작한다는 게 가장 큰 장점이다. 다만 패키지 설치·잠금·배포까지 묶어서 다루지는 못한다. 그 빈자리를 채우려고 등장한 상위 도구들을 다음 글부터 차례로 살펴본다. 그 시작은 Poetry다.

---

**지난 글:** [pip 기초: 패키지를 설치하고 관리하기](/posts/python-pip-basics/)

**다음 글:** [Poetry: 의존성·환경·패키징을 한 도구로](/posts/python-poetry-overview/)

<br>
읽어주셔서 감사합니다. 😊
