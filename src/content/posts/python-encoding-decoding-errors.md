---
title: "인코딩·디코딩 에러 다루기"
description: "UnicodeDecodeError와 UnicodeEncodeError가 왜 나는지 str과 bytes의 관계로 이해하고, 올바른 코덱 지정과 errors 인자로 해결하는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["인코딩", "유니코드", "bytes", "디버깅", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-circular-import-fix/)에서 모듈 로딩이 꼬이는 버그를 봤다면, 이번에는 문자열을 다룰 때 가장 자주 터지는 에러 — `UnicodeDecodeError`와 `UnicodeEncodeError` — 를 다룬다. 한글, 이모지, 외국어가 섞인 데이터를 읽고 쓸 때, 혹은 다른 시스템이 만든 파일을 열 때 흔히 마주친다. 원인을 알면 대부분 한 줄로 해결된다.

## str과 bytes는 다른 것이다

모든 혼란의 출발점은 두 타입을 구분하는 데 있다. `str`은 **사람이 읽는 텍스트** — 추상적인 문자(코드 포인트)의 나열이다. `bytes`는 **이진 데이터** — 0~255 사이 숫자들의 나열이다. 파일, 네트워크, 디스크는 모두 바이트만 다룬다. 따라서 텍스트를 저장하거나 전송하려면 반드시 바이트로 바꿔야 하고, 그 변환 규칙이 바로 **인코딩**(코덱)이다.

`str`에서 `bytes`로 가는 것이 `encode`, 반대가 `decode`다. UTF-8은 오늘날 사실상 표준 코덱으로, 모든 유니코드 문자를 1~4바이트로 표현한다.

![str과 bytes의 변환](/assets/posts/python-encoding-decoding-errors-flow.svg)

위 그림의 핵심은 마지막 줄이다. UTF-8로 인코딩한 바이트를 `ascii`로 디코딩하려 하면, ASCII는 한글을 모르기 때문에 `UnicodeDecodeError`가 난다. **에러의 거의 모든 원인은 "인코딩할 때와 디코딩할 때 코덱이 다르다"는 것**이다.

## 두 에러의 차이

- **`UnicodeDecodeError`**: 바이트 → 문자로 **읽을 때** 발생. 해당 코덱으로 해석할 수 없는 바이트 시퀀스를 만났다는 뜻. 보통 파일을 잘못된 인코딩으로 열 때 난다.
- **`UnicodeEncodeError`**: 문자 → 바이트로 **쓸 때** 발생. 그 코덱으로 표현할 수 없는 문자를 만났다는 뜻. 예컨대 한글을 `ascii`나 `latin-1`로 인코딩하려 할 때 난다.

```python
text = "카페 ☕"

# EncodeError — ascii로는 한글을 표현 못 함
text.encode("ascii")        # UnicodeEncodeError

# DecodeError — utf-8 바이트를 cp949로 잘못 해석
data = text.encode("utf-8")
data.decode("cp949")        # 깨진 글자 또는 에러
```

## 해결 1: 올바른 코덱을 명시한다

가장 근본적인 해결은 데이터의 실제 인코딩을 알아내 그대로 지정하는 것이다. 파일을 열 때는 `encoding`을 명시하는 습관이 중요하다. 명시하지 않으면 운영체제 기본값(`locale.getencoding()`)을 따르는데, 이게 윈도우에서는 `cp949`, 리눅스에서는 `utf-8`이라 같은 코드가 환경마다 다르게 동작하는 버그의 원인이 된다.

```python
# 항상 encoding을 명시 — 환경에 의존하지 않는다
with open("data.txt", encoding="utf-8") as f:
    text = f.read()

# 인코딩을 모를 때는 추정 도구의 도움을 받는다
import chardet
raw = open("unknown.txt", "rb").read()
guess = chardet.detect(raw)        # {'encoding': 'EUC-KR', ...}
text = raw.decode(guess["encoding"])
```

## 해결 2: errors 인자로 깨진 부분을 다룬다

데이터에 정말로 깨진 바이트가 섞여 있어 어떤 코덱으로도 깔끔히 안 되는 경우가 있다. 로그 수집처럼 "조금 손실되더라도 멈추면 안 되는" 상황에서는 `errors` 인자로 처리 방식을 고를 수 있다.

![errors 인자 옵션](/assets/posts/python-encoding-decoding-errors-options.svg)

```python
data = b"caf\xe9"   # latin-1의 é, utf-8로는 깨진 바이트

data.decode("utf-8")                       # UnicodeDecodeError
data.decode("utf-8", errors="ignore")      # 'caf'  (버림)
data.decode("utf-8", errors="replace")     # 'caf�' (◆로 치환)
data.decode("utf-8", errors="backslashreplace")  # 'caf\\xe9'
```

다만 `ignore`와 `replace`는 데이터를 손상시킨다는 점을 기억해야 한다. 기본값인 `strict`(예외 발생)로 두고, 진짜 데이터가 깨진 게 맞는지 먼저 확인한 뒤에만 완화하는 것이 안전하다. 에러를 숨기려고 무심코 `errors="ignore"`를 붙이면, 한글이 통째로 사라지는 더 큰 버그를 만들 수 있다.

## 정리

인코딩 에러의 본질은 "텍스트(str)와 바이트(bytes)는 다른 것이며, 둘 사이를 오갈 때 같은 코덱을 써야 한다"는 한 문장으로 요약된다. 파일을 열 때는 항상 `encoding`을 명시해 환경 의존성을 없애고, 내부에서는 가능한 한 UTF-8로 통일하며, `errors` 옵션은 데이터 손실을 감수할 수 있을 때만 신중히 쓰자. 다음 글에서는 함수 정의에서 가장 악명 높은 함정 — 가변 기본 인자를 다룬다.

---

**지난 글:** [순환 임포트 해결하기](/posts/python-circular-import-fix/)

**다음 글:** [가변 기본 인자의 함정](/posts/python-mutable-default-bug/)

<br>
읽어주셔서 감사합니다. 😊
