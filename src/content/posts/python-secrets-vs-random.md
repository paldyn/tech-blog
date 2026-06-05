---
title: "secrets vs random: 보안에 안전한 난수 만들기"
description: "토큰과 비밀번호 재설정 링크에 random 모듈을 쓰면 안 되는 이유, 그리고 암호학적으로 안전한 난수를 제공하는 secrets 모듈의 올바른 사용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["secrets", "random", "보안", "난수", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-sqlalchemy-orm/)에서 데이터베이스를 다루는 도구들을 한 바퀴 돌아봤다면, 이번 묶음에서는 실무에서 자주 마주치는 보안 함정과 흔한 버그들을 차근차근 살펴본다. 그 첫 주제는 의외로 많은 개발자가 무심코 잘못 쓰는 난수다. 회원가입 인증 코드, 비밀번호 재설정 링크, API 키처럼 "남이 맞히면 안 되는 값"을 만들 때 `random` 모듈을 쓰는 코드를 종종 보는데, 이는 심각한 보안 취약점이 된다.

## random은 왜 보안에 부적합한가

`random` 모듈은 메르센 트위스터(Mersenne Twister)라는 의사난수 생성기(PRNG)를 쓴다. 이름 그대로 "의사(pseudo)" 난수다. 겉보기에는 무작위 같지만, 실제로는 내부 상태로부터 결정론적으로 계산된 값일 뿐이다. 같은 시드(seed)를 주면 항상 같은 수열이 나온다. 이 성질은 시뮬레이션이나 테스트에서 결과를 재현할 때는 큰 장점이지만, 보안 관점에서는 치명적이다.

문제는 메르센 트위스터의 내부 상태가 624개의 출력값만 관찰하면 완전히 복원된다는 점이다. 즉 공격자가 충분한 출력을 수집하면 이후에 나올 "난수"를 그대로 예측할 수 있다. 비밀번호 재설정 토큰이 이런 식으로 만들어졌다면, 공격자는 다른 사용자의 재설정 링크를 예측해 계정을 탈취할 수 있다.

![random과 secrets의 용도 차이](/assets/posts/python-secrets-vs-random-comparison.svg)

## secrets: 암호학적으로 안전한 난수

Python 3.6부터 표준 라이브러리에 들어온 `secrets` 모듈이 바로 이 문제를 위한 것이다. 내부적으로 운영체제가 제공하는 암호학적 난수 소스(`os.urandom`, 리눅스의 `/dev/urandom` 등)를 사용한다. 이 소스는 하드웨어 이벤트 등에서 모은 엔트로피를 기반으로 하며, 출력을 관찰해도 다음 값을 예측할 수 없도록 설계됐다.

```python
import secrets

# URL에 안전한 토큰 (재설정 링크, 세션 토큰)
reset_token = secrets.token_urlsafe(32)

# 16진수 문자열 토큰
api_key = secrets.token_hex(16)

# 0 이상 n 미만의 안전한 정수 (편향 없음)
otp = secrets.randbelow(1000000)

# 시퀀스에서 안전하게 하나 고르기
import string
alphabet = string.ascii_letters + string.digits
password = "".join(secrets.choice(alphabet) for _ in range(12))
```

`token_urlsafe(n)`은 약 `n`바이트의 엔트로피를 가진, URL과 쿠키에 그대로 넣어도 되는 문자열을 만든다. `token_hex`는 16진수, `token_bytes`는 원시 바이트를 돌려준다. 비밀번호 같은 임의 문자열이 필요하면 `secrets.choice`를 반복하면 된다.

![보안 토큰은 secrets로 생성](/assets/posts/python-secrets-vs-random-code.svg)

## 판단 기준은 단 하나

언제 무엇을 쓸지 고민할 필요는 없다. 기준은 간단하다. **"이 값을 제3자가 예측하면 보안 사고가 나는가?"** 이 질문에 "그렇다"면 무조건 `secrets`다. 인증 토큰, 비밀번호, 암호화 키, 세션 ID, CSRF 토큰, 일회용 비밀번호(OTP)가 모두 여기 속한다.

반대로 결과의 예측 가능성이 문제가 되지 않는 곳 — 게임의 주사위, 몬테카를로 시뮬레이션, 데이터 샘플링, A/B 테스트 그룹 배정 — 에서는 `random`이 더 빠르고 시드로 재현까지 되니 적합하다.

## 토큰 비교도 안전하게

난수를 안전하게 만들었더라도, 그 값을 비교하는 단계에서 새는 경우가 있다. 일반적인 `==` 비교는 문자열이 다른 지점에서 즉시 멈추기 때문에, 응답 시간의 미세한 차이로 토큰을 한 글자씩 알아내는 타이밍 공격이 이론적으로 가능하다. `secrets`는 이를 막는 상수 시간 비교 함수도 제공한다.

```python
import secrets

def verify(provided: str, expected: str) -> bool:
    # 길이·내용에 따라 시간이 달라지지 않는 비교
    return secrets.compare_digest(provided, expected)
```

`compare_digest`는 비교에 걸리는 시간이 입력에 의존하지 않도록 구현되어 있어, 토큰이나 HMAC 값을 검증할 때 `==` 대신 쓰는 것이 안전하다.

정리하면, 보안과 관련된 무작위 값은 예외 없이 `secrets`로 만들고 `compare_digest`로 비교한다. `random`은 편하고 빠르지만 "예측 가능"이라는 본질을 잊으면 안 된다. 이 한 줄의 선택이 계정 탈취 같은 사고의 갈림길이 된다. 다음 글에서는 이렇게 만든 비밀번호를 실제로 저장할 때 쓰는 해싱 — bcrypt를 살펴본다.

---

**지난 글:** [SQLAlchemy ORM: 파이썬으로 SQL 다루기](/posts/python-sqlalchemy-orm/)

**다음 글:** [bcrypt로 비밀번호 안전하게 저장하기](/posts/python-bcrypt-passwords/)

<br>
읽어주셔서 감사합니다. 😊
