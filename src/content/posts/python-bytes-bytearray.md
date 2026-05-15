---
title: "bytes와 bytearray: 이진 데이터를 다루는 두 가지 방법"
description: "Python의 bytes(불변)와 bytearray(가변) 타입을 비교하고, 인코딩/디코딩, hex 변환, int 변환 등 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "bytes", "bytearray", "인코딩", "이진데이터", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-string-methods/)에서 문자열 메서드를 살펴봤다. 이번에는 문자열과 비슷하게 생겼지만 완전히 다른 영역인 **이진(binary) 데이터** 타입을 다룬다. Python에는 이진 시퀀스를 다루는 두 타입이 있다. 불변인 `bytes`와 가변인 `bytearray`다.

## bytes — 불변 이진 시퀀스

`bytes`는 0~255 범위의 정수 시퀀스다. 한 번 만들면 내용을 바꿀 수 없다.

```python
b = b"hello"          # 리터럴
b2 = bytes([72, 101, 108, 108, 111])  # int 리스트로 생성
b3 = bytes(5)         # 5바이트짜리 0으로 채운 bytes

b[0]   # 72  (int 반환, 문자열과 다름!)
b[1:4] # b'ell'  (슬라이스는 bytes 반환)
```

인덱스로 접근하면 `int`가 나온다는 점이 `str`과 다르다.

## bytearray — 가변 이진 시퀀스

`bytearray`는 `bytes`와 동일한 인터페이스를 갖지만 내용을 바꿀 수 있다.

```python
ba = bytearray(b"hello")
ba[0] = 72      # 'H' = 72 으로 변경
ba.append(33)   # '!' 추가
ba.extend(b" world")
print(bytes(ba))  # b'Hello! world'
```

`list`처럼 `append`, `extend`, `insert`, `pop` 메서드가 있다.

![bytes와 bytearray 비교](/assets/posts/python-bytes-bytearray-overview.svg)

## str ↔ bytes 변환

네트워크나 파일 I/O에서 가장 많이 하는 작업이다.

```python
# str → bytes
s = "안녕, Python!"
b = s.encode("utf-8")   # bytes
b_latin = s.encode("utf-8", errors="replace")  # 변환 불가 문자는 ?

# bytes → str
s2 = b.decode("utf-8")

# 오류 처리 옵션
b.decode("ascii", errors="ignore")   # 변환 불가 바이트 무시
b.decode("ascii", errors="replace")  # ? 로 대체
```

`encode()`/`decode()` 모두 두 번째 인자 `errors`를 받는다. 기본값은 `"strict"`(오류 시 예외 발생)다.

![인코딩·디코딩 패턴](/assets/posts/python-bytes-bytearray-encoding.svg)

## hex, int 변환

```python
b = b"Hi"
b.hex()               # '4869'
bytes.fromhex("4869") # b'Hi'

# 정수 ↔ bytes
n = (1024).to_bytes(2, "big")   # b'\x04\x00'
m = int.from_bytes(n, "big")    # 1024

# little-endian
(1024).to_bytes(2, "little")    # b'\x00\x04'
```

## 언제 무엇을 쓸까

| 상황 | 선택 |
|------|------|
| 파일 읽기·네트워크 수신 | `bytes` |
| 이진 버퍼를 조각조각 수정 | `bytearray` |
| dict 키로 사용 | `bytes` (해시 가능) |
| 대용량 이진 데이터 제자리 수정 | `bytearray` (복사 없이 변경) |

`bytes`는 해시 가능하므로 `dict` 키나 `set` 원소로 쓸 수 있다. `bytearray`는 가변이므로 해시 불가다.

## memoryview

`bytes`나 `bytearray`를 복사 없이 슬라이스하려면 `memoryview`를 쓴다.

```python
data = bytearray(b"Hello, World!")
view = memoryview(data)
view[0:5]  # <memory at ...>
bytes(view[0:5])  # b'Hello'  (복사 없이 참조)
```

대용량 이진 데이터를 처리할 때 불필요한 복사를 줄일 수 있다.

---

**지난 글:** [문자열 메서드: split, join, replace와 친구들](/posts/python-string-methods/)

**다음 글:** [None: Python의 '없음'을 나타내는 단 하나의 값](/posts/python-none/)

<br>
읽어주셔서 감사합니다. 😊
