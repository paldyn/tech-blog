---
title: "pip 기초: 패키지를 설치하고 관리하기"
description: "pip로 패키지를 설치·제거·조회하고 requirements.txt로 환경을 재현하는 기본기를, 동작 원리와 흔한 함정까지 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["pip", "패키지관리", "requirements", "의존성", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-self-class/)에서 타입 힌트 시리즈를 마무리했다. 이번 글부터는 코드를 작성하는 일에서 한 걸음 물러나, 그 코드가 의존하는 외부 라이브러리를 어떻게 가져오고 관리하는지를 다룬다. 그 출발점이 `pip`다. 파이썬을 설치하면 함께 따라오는 표준 패키지 설치 도구로, `import requests` 한 줄을 가능하게 만드는 모든 일이 사실 pip에서 시작된다.

## pip가 하는 일

pip는 파이썬 패키지 인덱스인 **PyPI**(Python Package Index, pypi.org)에서 패키지를 내려받아 현재 파이썬 환경에 설치한다. 단순히 파일을 복사하는 게 아니라, 패키지의 메타데이터를 읽어 **그 패키지가 필요로 하는 다른 패키지(의존성)까지 함께 해결**한 뒤 한꺼번에 배치한다. 예를 들어 `requests` 하나를 설치하면 내부적으로 쓰는 `urllib3`, `certifi` 같은 것들이 자동으로 따라온다.

![pip install의 흐름](/assets/posts/python-pip-basics-install-flow.svg)

설치된 패키지는 환경의 `site-packages` 디렉터리에 들어가고, 그때부터 그 환경의 인터프리터에서 `import`로 불러 쓸 수 있게 된다.

## 설치와 제거

가장 기본은 이름만 적어 최신 버전을 설치하는 것이다.

```bash
pip install requests
```

특정 버전이 필요하면 버전 지정자를 붙인다. 따옴표는 셸이 `>` `<` 같은 기호를 리디렉션으로 오해하지 않게 하려고 감싸는 것이다.

```bash
pip install "requests==2.31.0"
pip install "requests>=2.28,<3.0"
```

제거는 `uninstall`이다. 다만 그 패키지 때문에 끌려 들어온 의존성까지 알아서 지워 주지는 않는다는 점을 기억하자.

```bash
pip uninstall requests
```

## 설치 목록을 고정하고 재현하기

협업이나 배포에서 가장 중요한 건 "내 컴퓨터에서 되던 게 다른 곳에서도 똑같이 되는 것"이다. 그러려면 어떤 패키지가 어떤 버전으로 깔려 있는지를 파일로 남겨야 한다. `pip freeze`가 현재 환경의 설치 목록을 그대로 출력해 준다.

![자주 쓰는 pip 명령](/assets/posts/python-pip-basics-commands.svg)

```bash
pip freeze > requirements.txt
```

이렇게 만든 `requirements.txt`를 저장소에 함께 올려 두면, 다른 사람은 `-r` 옵션으로 같은 환경을 그대로 복원할 수 있다.

```bash
pip install -r requirements.txt
```

`requirements.txt`는 그냥 텍스트 파일이라 직접 손으로 작성해도 된다. 한 줄에 패키지 하나씩, 버전 지정자를 붙여 적는다.

```text
requests>=2.31
rich~=13.7
httpx
```

## 조회와 점검

무엇이 설치돼 있는지, 특정 패키지의 정보가 무엇인지 확인하는 명령도 자주 쓴다.

```bash
pip list                # 설치된 패키지 전체
pip show requests       # 버전·위치·의존성 등 상세 정보
pip install --upgrade requests   # 최신으로 갱신
```

`pip show`의 출력에는 그 패키지가 의존하는 항목(`Requires`)과 그 패키지에 의존하는 항목(`Required-by`)이 함께 나와서, 무언가를 지워도 되는지 판단할 때 유용하다.

## 흔히 빠지는 함정

첫째, **시스템 전역에 무턱대고 설치하지 말 것**. 운영체제가 관리하는 파이썬에 직접 설치하면 시스템 도구와 버전이 충돌할 수 있다. 그래서 거의 모든 경우 프로젝트별 가상환경 안에서 pip를 쓰는 것이 정석이며, 이는 다음 글의 주제다.

둘째, `pip`와 `python`이 가리키는 환경이 어긋나는 문제다. 여러 파이썬이 깔린 시스템에서 `pip install` 한 패키지가 정작 `python` 실행 시에는 안 보이는 일이 흔하다. 이럴 땐 명령을 인터프리터에 직접 붙여 실행하면 확실하다.

```bash
python -m pip install requests
```

`python -m pip` 형태는 "지금 이 python으로" pip를 돌리라는 뜻이라, 설치 대상 환경이 명확해진다. 헷갈릴 때의 안전한 습관으로 익혀 두면 좋다.

셋째, `pip freeze`로 만든 목록은 전이 의존성까지 전부 박제하기 때문에 사람이 읽기엔 장황하다. 직접 관리하는 "내가 진짜 원하는 패키지" 목록과, 잠금용으로 동결한 목록을 구분하는 전략은 뒤에서 lock 파일을 다룰 때 더 깊이 살펴본다.

pip는 가장 낮은 층의 도구지만, Poetry·PDM·uv 같은 상위 도구들도 결국 이 위에서 같은 일을 더 편하게 해 줄 뿐이다. 그래서 pip의 동작을 이해하고 있으면 어떤 도구를 쓰든 문제가 생겼을 때 원인을 짚어낼 수 있다.

---

**지난 글:** [Self 타입: 메서드 체이닝과 자기 참조](/posts/python-typing-self-class/)

**다음 글:** [venv: 프로젝트마다 격리된 가상환경 만들기](/posts/python-virtualenv-venv/)

<br>
읽어주셔서 감사합니다. 😊
