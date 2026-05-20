---
title: "json 모듈: JSON 직렬화와 역직렬화"
description: "Python json 모듈의 핵심 사용법을 정리합니다. dumps/loads/dump/load, indent와 ensure_ascii, 타입 매핑, 커스텀 JSONEncoder와 default 함수, 큰 JSON 파일 스트리밍, 보안 주의사항까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "json", "직렬화", "역직렬화", "JSONEncoder", "표준라이브러리", "API"]
featured: false
draft: false
---

[지난 글](/posts/python-operator-module/)에서 `operator` 모듈로 연산자를 함수로 다루는 방법을 살펴봤습니다. 이번 글에서는 현대 Python 개발에서 빠질 수 없는 `json` 모듈을 다룹니다. REST API 응답을 파싱하거나 설정 파일을 읽고 쓸 때 매일 쓰는 기능이지만, 타입 변환 규칙과 커스텀 인코딩을 정확히 알아야 예상치 못한 오류를 피할 수 있습니다.

## 기본 함수 네 가지

```python
import json

# 문자열 → Python 객체
data = json.loads('{"name": "Alice", "age": 30}')
print(data)   # {'name': 'Alice', 'age': 30}

# Python 객체 → 문자열
text = json.dumps({'name': 'Alice', 'age': 30})
print(text)   # '{"name": "Alice", "age": 30}'

# 파일에 쓰기
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump({'name': 'Alice'}, f, indent=2, ensure_ascii=False)

# 파일에서 읽기
with open('data.json', encoding='utf-8') as f:
    loaded = json.load(f)
```

**dumps/loads**: 문자열(str)과 Python 객체 사이를 변환합니다.  
**dump/load**: 파일(file-like object)과 Python 객체 사이를 변환합니다.

![json 직렬화·역직렬화 흐름](/assets/posts/python-json-module-flow.svg)

## 주요 옵션

### indent — 보기 좋은 출력

```python
import json

data = {'users': [{'name': 'Alice', 'age': 30}, {'name': 'Bob', 'age': 25}]}

# 기본 — 한 줄
json.dumps(data)
# '{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}'

# 들여쓰기
print(json.dumps(data, indent=2))
# {
#   "users": [
#     {"name": "Alice", "age": 30},
#     {"name": "Bob", "age": 25}
#   ]
# }
```

### ensure_ascii — 유니코드 처리

```python
data = {'city': '서울'}

# 기본 (ensure_ascii=True) — 한글을 \uXXXX로 이스케이프
json.dumps(data)
# '{"city": "\\uc11c\\uc6b8"}'

# ensure_ascii=False — 원문 유지
json.dumps(data, ensure_ascii=False)
# '{"city": "서울"}'
```

파일에 저장하거나 사람이 읽을 JSON을 만들 때는 `ensure_ascii=False`와 `encoding='utf-8'`를 함께 사용하세요.

### sort_keys — 키 정렬

```python
data = {'b': 2, 'a': 1, 'c': 3}
json.dumps(data, sort_keys=True)
# '{"a": 1, "b": 2, "c": 3}'
```

출력 결과를 비교하거나 해시할 때 유용합니다.

## 커스텀 인코더

`datetime`, `set`, `Decimal` 등 기본 지원되지 않는 타입을 직렬화할 때 두 가지 방법을 씁니다.

### 방법 1: JSONEncoder 서브클래스

```python
import json
from datetime import datetime
from decimal import Decimal

class AppEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, set):
            return sorted(obj)   # 정렬해서 list로
        return super().default(obj)

data = {
    'created': datetime(2026, 5, 21, 10, 0),
    'price': Decimal('9.99'),
    'tags': {'python', 'backend'},
}
json.dumps(data, cls=AppEncoder, ensure_ascii=False)
# '{"created": "2026-05-21T10:00:00", "price": 9.99, "tags": ["backend", "python"]}'
```

### 방법 2: default 함수

간단한 경우 `default` 파라미터에 함수를 직접 전달할 수 있습니다.

```python
import json
from datetime import datetime

def serialize(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"직렬화 불가: {type(obj)}")

json.dumps({'at': datetime.now()}, default=serialize)
```

![json 코드 예제](/assets/posts/python-json-module-code.svg)

## 커스텀 디코더

역방향(JSON → Python)에서도 타입을 복원할 수 있습니다.

```python
import json
from datetime import datetime

def object_hook(dct):
    # ISO 8601 문자열을 datetime으로 복원
    if 'created' in dct:
        dct['created'] = datetime.fromisoformat(dct['created'])
    return dct

text = '{"name": "Alice", "created": "2026-05-21T10:00:00"}'
data = json.loads(text, object_hook=object_hook)
print(type(data['created']))   # <class 'datetime.datetime'>
```

## 예외 처리

```python
import json

try:
    data = json.loads('{ invalid json }')
except json.JSONDecodeError as e:
    print(f"파싱 오류: {e.msg} at line {e.lineno} col {e.colno}")
    # 파싱 오류: Expecting property name enclosed in double quotes at line 1 col 3
```

`JSONDecodeError`는 `ValueError`의 서브클래스이므로 `except ValueError`로도 잡을 수 있습니다.

## 큰 JSON 파일 처리

표준 `json` 모듈은 파일 전체를 메모리에 올립니다. 수 GB 파일이라면 `ijson` 같은 스트리밍 파서를 사용하세요.

```python
import ijson

with open('large.json', 'rb') as f:
    for item in ijson.items(f, 'data.item'):
        process(item)   # 항목마다 처리, 전체 로드 없음
```

## JSON Lines (JSONL)

한 줄에 JSON 객체 하나씩 있는 JSONL 형식은 대용량 로그나 스트리밍 데이터에서 자주 씁니다.

```python
import json

# 쓰기
with open('events.jsonl', 'w') as f:
    for event in events:
        f.write(json.dumps(event, ensure_ascii=False) + '\n')

# 읽기
with open('events.jsonl') as f:
    for line in f:
        obj = json.loads(line.strip())
        process(obj)
```

## 보안 주의: eval 미사용

`json.loads()`는 안전합니다. 절대로 `eval()`로 JSON을 파싱하지 마세요.

```python
# 절대 하지 말 것 — 코드 실행 가능
data = eval('{"key": __import__("os").system("rm -rf /")}')

# 안전한 방법
data = json.loads(text)
```

---

**지난 글:** [operator 모듈: 연산을 함수로 다루기](/posts/python-operator-module/)

**다음 글:** [csv 모듈: CSV 파일 읽기와 쓰기](/posts/python-csv-module/)

<br>
읽어주셔서 감사합니다. 😊
