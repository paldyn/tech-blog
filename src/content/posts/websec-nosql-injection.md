---
title: "NoSQL 인젝션: MongoDB와 쿼리 조작 공격"
description: "MongoDB의 연산자 인젝션·JavaScript 인젝션·타입 혼동 공격 원리를 설명하고, Zod 스키마 검증·연산자 필터링·$where 사용 금지로 구성된 NoSQL 인젝션 방어 전략을 Node.js 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["NoSQL인젝션", "MongoDB", "인젝션", "Mongoose", "입력검증", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-sql-injection-blind/)에서 에러 메시지 없이도 데이터를 추출하는 블라인드 SQL 인젝션을 다뤘다. SQL 데이터베이스 대신 MongoDB, Redis, Cassandra 같은 NoSQL을 사용한다고 해서 인젝션 위협에서 자유로운 것은 아니다. **NoSQL 인젝션**은 SQL과 문법은 다르지만 동일한 원리로 동작하며, 특히 JSON API를 사용하는 Node.js+MongoDB 조합에서 빈번하다.

## NoSQL 인젝션이란

SQL처럼 문자열 파서를 속이는 대신, NoSQL 인젝션은 **쿼리 구조 자체를 객체(JSON)로 조작**한다. MongoDB는 쿼리를 JSON 문서로 받기 때문에, 사용자 입력이 문자열이 아닌 객체로 전달되면 쿼리 연산자가 삽입될 수 있다.

```javascript
// 취약한 Express + MongoDB 코드
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    // req.body가 JSON 파싱되므로 password가 객체일 수 있음!
    const user = await db.collection('users').findOne({
        username: username,
        password: password  // 위험: 타입 검증 없음
    });
    if (user) res.json({ token: createToken(user) });
    else res.status(401).json({ error: 'Invalid credentials' });
});
```

공격자가 `{"username": "admin", "password": {"$ne": "anything"}}`을 전송하면 `password != "anything"` 조건이 되어 인증이 우회된다.

![NoSQL 인젝션 공격 패턴](/assets/posts/websec-nosql-injection-attack.svg)

## 연산자 인젝션 (Operator Injection)

MongoDB의 비교 연산자(`$ne`, `$gt`, `$regex`, `$in`)가 악용된다.

```json
// 정상 요청
{"username": "admin", "password": "secret"}

// 공격: $ne (not equal)
{"username": "admin", "password": {"$ne": "x"}}
// → password != "x" → 항상 True → 인증 우회

// 공격: $gt (greater than) - 비어있지 않은 모든 비밀번호
{"username": "admin", "password": {"$gt": ""}}

// 공격: $regex - 비밀번호 시작 문자 추측
{"username": "admin", "password": {"$regex": "^a"}}
```

## JavaScript 인젝션 ($where)

MongoDB의 `$where` 연산자는 JavaScript 표현식을 평가한다. 절대 사용하면 안 된다.

```javascript
// 극도로 위험한 코드
const users = await db.collection('users').find({
    $where: `this.username == '${userInput}'`
}).toArray();

// 공격: userInput = "x' || sleep(5000) || 'x"
// → Time-based blind NoSQLi 성공

// 공격: userInput = "x'; return this.password.length > 0 || '"
// → 모든 사용자 반환
```

`$where`, `mapReduce`, `$accumulator`, `$function`은 모두 서버 사이드 JavaScript 실행 기능이므로 프로덕션에서 비활성화해야 한다.

## 방어 전략

### 1. 타입 강제 검증

모든 입력을 사용 전에 타입과 형식을 검증한다. Zod, Joi, Yup 같은 스키마 검증 라이브러리를 사용한다.

```typescript
import { z } from 'zod';

const LoginSchema = z.object({
    username: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/),
    password: z.string().min(8).max(128),
});

app.post('/login', async (req, res) => {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: '잘못된 입력' });
    }
    const { username, password } = result.data;
    // 이 시점에서 username, password는 반드시 string
    const user = await db.collection('users').findOne({
        username,  // 객체 아님, 타입 보장됨
        password: hashPassword(password)
    });
    // ...
});
```

### 2. 연산자 필터링 미들웨어

![NoSQL 방어 코드](/assets/posts/websec-nosql-injection-defense.svg)

```javascript
// express-mongo-sanitize 미들웨어 사용 (권장)
import mongoSanitize from 'express-mongo-sanitize';

app.use(mongoSanitize({
    allowDots: false,       // . 허용 여부
    replaceWith: '_',       // $ 키를 제거 대신 교체
    onSanitize: ({ req, key }) => {
        console.warn('NoSQL injection attempt blocked:', key, req.ip);
    }
}));
```

### 3. Mongoose 스키마 타입 강제

```javascript
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

// Mongoose는 스키마에 정의된 타입으로 자동 캐스팅
// username에 객체가 오면 문자열 변환 시도 → "[object Object]"
// 별도 타입 검증으로 미리 차단하는 것이 안전
```

### 4. $where 비활성화

MongoDB 서버 설정에서 서버 사이드 JavaScript를 비활성화한다.

```yaml
# mongod.conf
security:
  javascriptEnabled: false  # $where, mapReduce 등 비활성화
```

```python
# Python pymongo에서도 타입 검증 적용
from pymongo import MongoClient
from bson import ObjectId

def get_user_by_id(db, user_id: str):
    # ObjectId로 변환 실패하면 ValueError 발생
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("유효하지 않은 ID 형식")
    return db.users.find_one({"_id": oid})
```

## Redis, Cassandra의 인젝션

NoSQL 인젝션은 MongoDB에만 국한되지 않는다.

```python
# Redis EVAL 인젝션
redis_client.eval(f"return redis.call('get', '{user_key}')", 0)
# user_key = "') return redis.call('flushall') redis.call('get', '"

# 방어: 파라미터 분리
redis_client.eval("return redis.call('get', KEYS[1])", 1, user_key)

# Cassandra CQL 인젝션
session.execute(f"SELECT * FROM users WHERE id = {user_id}")
# 방어: 준비된 문장(Prepared Statement)
prepared = session.prepare("SELECT * FROM users WHERE id = ?")
session.execute(prepared, [user_id])
```

NoSQL을 사용하더라도 **입력값의 타입을 강제하고, 동적 쿼리 조작 연산자를 필터링하고, 서버 사이드 스크립트 기능을 비활성화**하는 세 가지 원칙을 지켜야 한다. 다음 글에서는 OS 명령어를 직접 실행하는 Command 인젝션을 다룬다.

---

**지난 글:** [블라인드 SQL 인젝션: 응답 없이 데이터 훔치기](/posts/websec-sql-injection-blind/)

**다음 글:** [커맨드 인젝션: OS 명령어 탈취 공격과 방어](/posts/websec-command-injection/)

<br>
읽어주셔서 감사합니다. 😊
