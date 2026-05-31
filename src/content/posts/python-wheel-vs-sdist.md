---
title: "wheel vs sdist: 두 가지 배포 아티팩트"
description: "소스 배포물 sdist와 빌드 완료물 wheel의 구조·설치 경로·플랫폼 태그 차이를, 왜 둘 다 배포하는지까지 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["wheel", "sdist", "패키징", "배포", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-setup-py-vs-pyproject/)에서 `python -m build`로 패키지를 빌드하면 `dist/`에 결과물이 생긴다고 했다. 그런데 그 폴더를 열어 보면 `.tar.gz`와 `.whl`, 두 종류의 파일이 들어 있다. 같은 패키지를 왜 두 가지로 만들까. 이번 글은 이 둘, 즉 **sdist**(소스 배포물)와 **wheel**(빌드된 배포물)의 차이와 각자의 역할을 다룬다.

## 두 형식의 본질

비유하자면 sdist는 "조리법과 재료"이고, wheel은 "데워서 바로 먹는 완제품"이다.

![sdist vs wheel](/assets/posts/python-wheel-vs-sdist-structure.svg)

**sdist**(`.tar.gz`)는 소스 코드와 빌드 설정(`pyproject.toml` 등)을 그대로 담은 압축 파일이다. 설치하려면 받는 쪽에서 빌드 과정을 거쳐야 한다. **wheel**(`.whl`)은 이미 빌드를 마친 결과물이라, 압축만 풀어 적절한 위치에 배치하면 설치가 끝난다.

## 설치 경로의 차이

이 차이가 실제 설치 속도와 안정성을 가른다.

![설치 경로의 차이](/assets/posts/python-wheel-vs-sdist-install.svg)

wheel이 있으면 pip는 다운로드 후 압축을 풀어 파일을 배치하기만 하면 된다. 빌드 단계가 없으니 빠르고, 빌드 도구나 컴파일러가 필요 없다. 반면 sdist만 있으면 pip는 받은 소스를 그 자리에서 빌드해야 하므로, 빌드 백엔드가 동작해야 하고 C 확장이 있다면 컴파일러까지 갖춰져 있어야 한다. 그래서 wheel을 함께 제공하는 것이 강하게 권장된다.

```bash
python -m build
# dist/myapp-0.1.0.tar.gz   (sdist)
# dist/myapp-0.1.0-py3-none-any.whl   (wheel)
```

## wheel의 플랫폼 태그

wheel 파일 이름에는 호환성 정보를 담은 **태그**가 들어 있다. `myapp-0.1.0-py3-none-any.whl`을 보면 끝에 `py3-none-any`가 붙어 있는데, 이는 각각 파이썬 태그·ABI 태그·플랫폼 태그다.

```text
myapp-0.1.0-py3-none-any.whl
            └─┬─┘ └┬─┘ └┬┘
          파이썬  ABI  플랫폼
```

`py3-none-any`는 "파이썬 3, 특정 ABI 무관, 모든 플랫폼"이라는 뜻으로, 순수 파이썬 패키지의 전형이다. 이런 휠은 어떤 운영체제에서도 그대로 설치된다.

반면 C 확장을 포함한 패키지는 플랫폼마다 컴파일 결과가 다르므로, `cp311-cp311-manylinux_2_17_x86_64.whl`처럼 구체적인 태그가 붙는다. pip는 설치 시 현재 환경에 맞는 태그의 휠을 골라 받는다. NumPy 같은 패키지가 OS·파이썬 버전별로 여러 휠을 제공하는 이유가 이것이다.

## 그래서 무엇을 배포해야 하나

결론은 **둘 다 배포한다**이다. wheel은 빠르고 안정적인 설치를 위해, sdist는 휠이 제공되지 않는 환경(예: 특이한 플랫폼이나 파이썬 버전)에서 소스로부터 빌드할 수 있는 안전망으로 함께 올린다. 앞서 본 빌드 명령은 기본적으로 둘 다 만들어 준다.

```bash
python -m build          # sdist + wheel 모두 생성 (기본)
python -m build --wheel  # wheel만
python -m build --sdist  # sdist만
```

순수 파이썬 패키지라면 휠 하나로 대부분의 환경을 덮을 수 있지만, sdist를 함께 올리는 비용이 거의 없으므로 둘 다 제공하는 게 관례다.

정리하면, sdist는 소스 그 자체이고 wheel은 빌드된 완제품이다. 사용자는 거의 항상 wheel로 빠르게 설치하고, 휠이 없을 때만 sdist로 빌드한다. 이제 이렇게 만든 두 배포물을 실제로 세상에 공개하는 단계, 즉 PyPI 업로드를 다음 글에서 다룬다.

---

**지난 글:** [setup.py vs pyproject.toml: 패키징 설정의 세대 교체](/posts/python-setup-py-vs-pyproject/)

**다음 글:** [PyPI 배포: 내 패키지를 세상에 공개하기](/posts/python-pypi-publishing/)

<br>
읽어주셔서 감사합니다. 😊
