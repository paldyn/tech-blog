---
title: "pickle의 보안 위험: 신뢰할 수 없는 데이터를 풀지 마라"
description: "pickle은 데이터가 아니라 코드를 실행할 수 있는 직렬화 형식입니다. 어떻게 임의 코드 실행으로 이어지는지, 그리고 언제 pickle 대신 json을 써야 하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["pickle", "직렬화", "보안", "역직렬화", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-bcrypt-passwords/)에서 비밀번호를 안전하게 다루는 법을 봤다면, 이번에는 파이썬에서 가장 흔히 간과되는 보안 함정 하나를 짚는다. 바로 `pickle`이다. 객체를 파일이나 네트워크로 주고받을 때 편하다는 이유로 자주 쓰이지만, 출처를 신뢰할 수 없는 데이터를 `pickle`로 풀면 그 자체로 원격 코드 실행(RCE) 취약점이 된다.

## pickle은 "데이터"가 아니라 "프로그램"이다

JSON 같은 형식은 순수한 데이터만 담는다. 숫자, 문자열, 리스트, 객체의 트리일 뿐, 그 안에 실행 명령은 없다. 반면 pickle은 다르다. pickle의 바이트 스트림은 사실상 파이썬 객체를 **재구성하기 위한 작은 명령어 프로그램**이다. 역직렬화 과정에서 "이 클래스의 인스턴스를 만들고, 이 함수를 이 인자로 호출해 상태를 복원하라" 같은 지시를 그대로 수행한다.

이 복원 동작은 객체의 `__reduce__` 메서드로 정의되는데, 공격자가 이 부분을 조작하면 임의의 함수 호출을 심을 수 있다. 즉 `pickle.loads`를 호출하는 순간, 데이터를 읽는 게 아니라 공격자가 지정한 코드가 실행된다.

![pickle 역직렬화의 코드 실행 경로](/assets/posts/python-pickle-security-attack.svg)

## 공격이 얼마나 쉬운가

악성 pickle을 만드는 건 놀라울 만큼 간단하다. `__reduce__`가 "역직렬화 시 무엇을 호출할지" 튜플로 돌려주기만 하면 된다.

```python
import pickle
import os

class Exploit:
    def __reduce__(self):
        # 역직렬화될 때 os.system("...")이 호출된다
        return (os.system, ("echo PWNED",))

payload = pickle.dumps(Exploit())

# 피해자 쪽: 신뢰할 수 없는 payload를 그냥 풀면
pickle.loads(payload)   # ← 여기서 명령이 실행됨
```

피해자 코드에는 `Exploit` 클래스가 없어도 된다. `os.system` 같은 기본 제공 함수만으로도 충분히 위험하다. 실제 공격에서는 리버스 셸을 띄우거나 파일을 탈취하는 코드가 들어간다. 이 때문에 캐시 파일을 pickle로 저장하는 서비스가 그 파일 경로를 공격자가 덮어쓸 수 있다면, 그것만으로 서버가 장악될 수 있다.

## 어디까지 위험한가 — 신뢰 경계로 판단

오해하지 말아야 할 것은, pickle 자체가 "쓰면 안 되는 나쁜 것"은 아니라는 점이다. 문제는 **데이터의 출처**다. 내가 만들어 내가 읽는 데이터 — 예컨대 같은 프로세스 안의 캐시, 내가 통제하는 디스크의 임시 파일, `multiprocessing`이 내부적으로 주고받는 객체 — 에는 pickle이 빠르고 편리하다.

위험한 것은 **신뢰 경계를 넘어온** 데이터다. 사용자가 업로드한 파일, 네트워크로 받은 메시지, 외부 API의 응답, 다른 시스템이 쓴 캐시처럼 내가 내용을 보장할 수 없는 바이트를 `pickle.loads`에 넣는 순간 문제가 된다.

![pickle과 json의 역할 구분](/assets/posts/python-pickle-security-alternatives.svg)

## 안전한 대안

외부에서 받은 데이터에는 코드 실행 경로가 없는 형식을 쓴다. 순수 데이터라면 `json`이 가장 무난하다.

```python
import json

# 신뢰할 수 없는 입력 — json은 데이터만 파싱한다
data = json.loads(untrusted_bytes)   # 코드 실행 없음

# 스키마 검증까지 하고 싶다면 pydantic 등을 함께
from pydantic import BaseModel

class Order(BaseModel):
    id: int
    amount: float

order = Order.model_validate_json(untrusted_bytes)
```

JSON으로 표현하기 어려운 복잡한 객체를 외부와 주고받아야 한다면, 스키마 기반 직렬화(protobuf, MessagePack 등)나 명시적으로 허용한 타입만 복원하도록 제한한 커스텀 직렬화를 쓴다. 정 pickle을 외부 입력에 써야 한다면 `hmac`으로 서명해 위변조를 검증하는 방법도 있지만, 가능하면 형식 자체를 바꾸는 편이 안전하다.

핵심 원칙은 한 문장으로 요약된다. **"신뢰할 수 없는 데이터는 절대 unpickle하지 않는다."** 출처가 확실한 내부 데이터에만 pickle을 쓰고, 외부에서 들어오는 모든 것에는 데이터만 다루는 형식을 쓰자. 다음 글에서는 같은 결의 위험 — 문자열을 코드로 실행하는 `eval`과 `exec`의 함정을 살펴본다.

---

**지난 글:** [bcrypt로 비밀번호 안전하게 저장하기](/posts/python-bcrypt-passwords/)

**다음 글:** [eval과 exec의 위험성](/posts/python-eval-exec-risk/)

<br>
읽어주셔서 감사합니다. 😊
