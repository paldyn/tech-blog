---
title: "강력한 비밀번호 정책 설계하기"
description: "NIST SP 800-63B 기준으로 현대적인 비밀번호 정책을 설계하는 방법을 알아봅니다. 복잡도 규칙의 함정, 패스프레이즈, 유출 비밀번호 검사, Have I Been Pwned API 활용까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["비밀번호정책", "PasswordPolicy", "NIST", "HIBP", "패스프레이즈"]
featured: false
draft: false
---

[지난 글](/posts/websec-security-headers-overview/)에서 HTTP 보안 헤더로 브라우저 수준 방어를 추가하는 방법을 살펴봤다. 이번에는 가장 기본적인 보안 요소인 비밀번호 정책을 다룬다.

## 기존 복잡도 규칙의 문제

"대문자, 소문자, 숫자, 특수문자 포함" 규칙은 사용자를 `Password1!` 같은 예측 가능한 패턴으로 유도한다. NIST는 2017년 이 규칙을 사실상 권고하지 않는다고 발표했다.

![비밀번호 강도와 크래킹 시간](/assets/posts/websec-password-policies-strength.svg)

## NIST SP 800-63B 핵심 권고사항

### 길이가 복잡도보다 중요하다

```python
import math

def calculate_entropy(length: int, charset_size: int) -> float:
    return length * math.log2(charset_size)

# 8자리 혼합 (72개 문자): ~47비트
print(f"8자리 복잡: {calculate_entropy(8, 72):.1f}비트")
# 16자리 소문자만 (26개 문자): ~75비트
print(f"16자리 소문자: {calculate_entropy(16, 26):.1f}비트")
```

- 최소 12자 이상 권장 (NIST는 최소 8자, 서비스에 따라 더 높게)
- 최대 길이 제한 완화 (128자까지 허용)
- 주기적 변경 강제 금지

### 유출된 비밀번호 검사 (HIBP API)

k-익명성 방식으로 실제 비밀번호를 서버에 전송하지 않고 유출 여부를 확인한다.

```python
import hashlib
import httpx

async def is_pwned(password: str) -> bool:
    sha1 = hashlib.sha1(password.encode()).hexdigest().upper()
    prefix = sha1[:5]
    suffix = sha1[5:]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.pwnedpasswords.com/range/{prefix}"
        )

    hashes = {line.split(':')[0] for line in response.text.splitlines()}
    return suffix in hashes
```

![비밀번호 정책 검증 구현](/assets/posts/websec-password-policies-code.svg)

## 현대적 비밀번호 정책 구현

```python
from dataclasses import dataclass

@dataclass
class PasswordPolicy:
    min_length: int = 12
    max_length: int = 128
    check_hibp: bool = True

async def validate_password(password: str, policy: PasswordPolicy) -> list[str]:
    errors = []
    if len(password) < policy.min_length:
        errors.append(f"최소 {policy.min_length}자 이상이어야 합니다")
    if len(password) > policy.max_length:
        errors.append(f"최대 {policy.max_length}자 이하여야 합니다")
    if policy.check_hibp and not errors:
        if await is_pwned(password):
            errors.append("유출 사례에서 발견된 비밀번호입니다")
    return errors
```

패스워드 매니저 사용을 적극 권장하고, 붙여넣기를 막지 않으며, MFA와 조합하면 비밀번호 강도 요구를 약간 완화해도 충분하다.

---

**지난 글:** [HTTP 보안 헤더 총정리](/posts/websec-security-headers-overview/)

**다음 글:** [무차별 대입 공격 방어 전략](/posts/websec-brute-force-defense/)

<br>
읽어주셔서 감사합니다. 😊
