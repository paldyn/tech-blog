---
title: "PyPI 배포: 내 패키지를 세상에 공개하기"
description: "build로 배포물을 만들고 twine으로 TestPyPI를 거쳐 PyPI에 올리는 전 과정과, API 토큰·이름 충돌 등 실전 주의점까지 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["PyPI", "twine", "배포", "패키징", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-wheel-vs-sdist/)에서 wheel과 sdist 두 배포물을 만들었다. 이제 이것을 세상에 공개할 차례다. `pip install 내패키지`로 누구나 설치할 수 있게 하려면 **PyPI**(pypi.org)에 업로드해야 한다. 이번 글은 빌드부터 업로드까지의 전 과정을, 처음 배포하는 사람이 실수하기 쉬운 지점과 함께 정리한다.

## 전체 흐름

배포는 세 단계로 요약된다. 빌드 도구로 배포물을 만들고, `twine`으로 그것을 검증한 뒤, PyPI에 업로드한다. 그리고 그 사이에 **TestPyPI**라는 연습용 저장소를 한 번 거치는 것이 안전한 관례다.

![PyPI 배포 흐름](/assets/posts/python-pypi-publishing-flow.svg)

TestPyPI(test.pypi.org)는 PyPI와 똑같이 동작하는 별도 저장소로, 실수로 잘못된 패키지를 정식 공개하는 일을 막아 준다. 메타데이터가 제대로 보이는지, 설치가 되는지 여기서 먼저 확인하고 진짜 PyPI로 올리면 된다.

## 준비: 계정과 토큰

먼저 PyPI(그리고 TestPyPI)에 계정을 만들고, 업로드 인증에 쓸 **API 토큰**을 발급받는다. 비밀번호 대신 토큰을 쓰는 것이 표준이며, 토큰은 계정 설정에서 만들 수 있다. 발급한 토큰은 보통 `~/.pypirc`에 저장하거나 환경 변수로 전달한다.

```ini
# ~/.pypirc
[pypi]
  username = __token__
  password = pypi-AgEI...토큰값...

[testpypi]
  username = __token__
  password = pypi-AgEI...테스트토큰값...
```

`username`은 토큰을 쓸 때 항상 `__token__`이라는 고정 문자열이고, 실제 토큰은 `password` 자리에 넣는다.

## 빌드하고 검증하기

이제 배포물을 만들고 `twine`으로 점검한다. `twine check`는 패키지 메타데이터(설명, 분류자 등)가 PyPI에서 올바르게 렌더링될지 미리 확인해 준다.

![배포 명령](/assets/posts/python-pypi-publishing-commands.svg)

```bash
python -m build          # dist/ 에 wheel + sdist 생성
twine check dist/*       # 메타데이터 점검
```

`twine check`가 통과하지 못하면, 대개 `pyproject.toml`의 설명이나 README 형식에 문제가 있는 것이다. 여기서 잡으면 업로드 후 당황할 일이 없다.

## TestPyPI로 리허설

먼저 연습용 저장소에 올려 본다. `-r testpypi`로 대상을 지정한다.

```bash
twine upload -r testpypi dist/*
```

업로드가 끝나면 TestPyPI에서 실제로 설치까지 해 본다. 이때 의존성은 TestPyPI에 없을 수 있으므로, 의존성은 정식 PyPI에서 받도록 인덱스를 함께 지정하는 게 요령이다.

```bash
pip install -i https://test.pypi.org/simple/ \
  --extra-index-url https://pypi.org/simple/ myapp
```

설치와 임포트가 정상이라면 준비가 끝난 것이다.

## 정식 배포

이제 진짜 PyPI에 올린다. 대상을 지정하지 않으면 기본이 PyPI다.

```bash
twine upload dist/*
```

업로드가 성공하면 곧바로 `pip install myapp`으로 전 세계 누구나 설치할 수 있다.

## 실전에서 조심할 점

**이름은 선착순이고 전역적으로 유일하다.** 원하는 패키지 이름이 이미 PyPI에 있으면 쓸 수 없으니, 배포 전에 pypi.org에서 검색해 비어 있는지 확인한다.

**같은 버전은 다시 올릴 수 없다.** PyPI는 한 번 게시한 버전 파일의 덮어쓰기를 허용하지 않는다. 업로드 후 문제를 발견했다면, 파일을 교체하는 게 아니라 **버전 번호를 올려** 새로 배포해야 한다. 그래서 작은 수정이라도 `0.1.0` → `0.1.1`처럼 버전을 증가시키는 습관이 중요하다.

**민감 정보가 패키지에 섞이지 않게 한다.** 빌드 전에 `dist/` 안에 들어갈 파일을 점검하고, 토큰·`.env` 같은 비밀이 포함되지 않았는지 확인한다.

마지막으로, 이 모든 과정을 매번 손으로 하지 않고 **GitHub Actions 같은 CI에서 태그를 달면 자동 배포**되게 구성하는 것이 실무의 정석이다. PyPI의 신뢰 게시(Trusted Publishing)를 쓰면 토큰을 저장소에 두지 않고도 안전하게 자동 배포할 수 있다.

이제 패키지를 만들고 공개하는 한 사이클을 모두 돌았다. 다음 글에서는 이렇게 배포한 패키지를 쓰는 쪽의 관점으로 돌아가, 의존성 버전을 어떻게 고정해야 빌드가 언제나 똑같이 재현되는지를 다룬다.

---

**지난 글:** [wheel vs sdist: 두 가지 배포 아티팩트](/posts/python-wheel-vs-sdist/)

**다음 글:** [버전 고정과 lock 파일: 재현 가능한 빌드](/posts/python-version-pinning/)

<br>
읽어주셔서 감사합니다. 😊
