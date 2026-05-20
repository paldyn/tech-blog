---
title: "pickle: Python 객체 직렬화"
description: "Python pickle 모듈의 사용법과 주의사항을 정리합니다. dumps/loads/dump/load, protocol 버전, 직렬화 가능·불가능 타입, __reduce__와 __getstate__/__setstate__ 커스터마이징, 보안 취약점, 대안 라이브러리를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "pickle", "직렬화", "객체저장", "ML모델", "보안", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-csv-module/)에서 `csv` 모듈로 표 형태의 데이터를 처리했습니다. 이번 글에서는 Python 객체를 그대로 바이트 스트림으로 저장하는 `pickle` 모듈을 다룹니다. ML 모델 저장, 프로세스 간 데이터 전달, 로컬 캐시 등 다양한 곳에서 쓰이지만 중요한 보안 제약도 함께 알아야 합니다.

## pickle이란?

`pickle`은 Python 객체를 바이트 스트림으로 직렬화(피클링)하고, 반대로 바이트 스트림에서 Python 객체를 복원(언피클링)하는 표준 모듈입니다. JSON과 달리 Python 전용 형식이어서 Python 클래스 인스턴스, NumPy 배열, scikit-learn 모델처럼 JSON으로 표현하기 어려운 객체를 그대로 저장할 수 있습니다.

![pickle 흐름](/assets/posts/python-pickle-flow.svg)

## 기본 사용법

```python
import pickle

# 메모리 ↔ 바이트
obj = {'name': 'Alice', 'scores': [95, 87, 92]}

blob = pickle.dumps(obj)
print(type(blob))   # <class 'bytes'>

restored = pickle.loads(blob)
print(restored == obj)   # True

# 파일 ↔ 객체
with open('data.pkl', 'wb') as f:
    pickle.dump(obj, f, protocol=pickle.HIGHEST_PROTOCOL)

with open('data.pkl', 'rb') as f:
    loaded = pickle.load(f)
```

파일 모드는 반드시 바이너리(`'wb'`, `'rb'`)를 사용해야 합니다.

## protocol 버전

```python
# protocol=0 — 텍스트 기반 (구 버전 호환)
# protocol=2 — Python 2.3+
# protocol=4 — Python 3.4+ (큰 객체 지원)
# protocol=5 — Python 3.8+ (out-of-band 데이터 지원)
# pickle.HIGHEST_PROTOCOL — 현재 Python의 최고 버전

import pickle
print(pickle.HIGHEST_PROTOCOL)   # Python 3.11에서는 5
```

저장한 파일을 이전 Python 버전에서 읽어야 한다면 호환되는 낮은 protocol 번호를 명시하세요.

## 직렬화 가능/불가능 타입

```python
import pickle

# 가능
pickle.dumps(42)              # int
pickle.dumps([1, 2, 3])       # list
pickle.dumps({'a': 1})        # dict
pickle.dumps((1, 2))          # tuple
pickle.dumps(lambda x: x)     # 제한적 지원 (3.8+)

# 불가능 — TypeError 발생
import socket
s = socket.socket()
pickle.dumps(s)   # TypeError: cannot pickle 'socket' object
```

파일 핸들, 소켓, 데이터베이스 연결처럼 OS 자원에 묶인 객체는 직렬화할 수 없습니다.

![pickle 코드 예제](/assets/posts/python-pickle-code.svg)

## 커스텀 직렬화: __getstate__ / __setstate__

직렬화할 수 없는 속성을 제외하거나 변환해야 할 때 씁니다.

```python
import pickle

class DatabaseManager:
    def __init__(self, dsn):
        self.dsn = dsn
        self._conn = self._connect()   # 연결 객체 — pickle 불가

    def _connect(self):
        ...  # DB 연결 반환

    def __getstate__(self):
        # 저장할 상태에서 _conn 제외
        state = self.__dict__.copy()
        del state['_conn']
        return state

    def __setstate__(self, state):
        # 복원 시 _conn 재생성
        self.__dict__.update(state)
        self._conn = self._connect()
```

## pickle을 이용한 깊은 복사

```python
import pickle, copy

original = {'nested': {'data': [1, 2, 3]}}

# copy.deepcopy와 동등하지만 pickle이 더 빠를 때도 있음
clone = pickle.loads(pickle.dumps(original))
clone['nested']['data'].append(99)

print(original['nested']['data'])  # [1, 2, 3] — 독립적
```

## 보안 취약점

**pickle의 가장 중요한 제약**: 신뢰할 수 없는 소스의 데이터를 절대 역직렬화하지 마세요.

```python
# 악의적인 pickle 데이터 — 실행 금지
import pickle, os

class Exploit:
    def __reduce__(self):
        return (os.system, ('whoami',))

payload = pickle.dumps(Exploit())
# 이 데이터를 loads()하면 시스템 명령이 실행됨
```

신뢰 경계를 넘는 상황(API 입력, 네트워크 수신, 사용자 업로드)에서는 pickle 대신 JSON이나 MessagePack 같은 형식을 사용하세요.

## ML 모델 저장 실전 예시

```python
import pickle
from sklearn.linear_model import LogisticRegression

# 학습
model = LogisticRegression()
model.fit(X_train, y_train)

# 저장
with open('model.pkl', 'wb') as f:
    pickle.dump(model, f, protocol=pickle.HIGHEST_PROTOCOL)

# 로드 (같은 Python·scikit-learn 버전 권장)
with open('model.pkl', 'rb') as f:
    loaded_model = pickle.load(f)

predictions = loaded_model.predict(X_test)
```

scikit-learn은 `joblib`을 공식 권장합니다. `joblib.dump()`/`joblib.load()`는 NumPy 배열을 더 효율적으로 처리합니다.

## 대안 라이브러리

| 라이브러리 | 특징 |
|---|---|
| `joblib` | NumPy 배열 효율적, ML 모델 표준 방법 |
| `shelve` | pickle 기반 dict처럼 쓰는 간단 KV 저장소 |
| `dill` | lambda, 클로저 등 더 많은 타입 지원 |
| `msgpack` | 크로스 언어 이진 형식, 빠름 |
| `protobuf` | 스키마 기반, 버전 호환성 강함 |

---

**지난 글:** [csv 모듈: CSV 파일 읽기와 쓰기](/posts/python-csv-module/)

**다음 글:** [sqlite3: 내장 관계형 데이터베이스](/posts/python-sqlite3/)

<br>
읽어주셔서 감사합니다. 😊
