---
title: "싱글턴·팩토리 패턴 — 객체 생성의 제어와 추상화"
description: "싱글턴 패턴의 구현과 테스트 가능성 문제, ES Module 기반 싱글턴, 팩토리 함수와 추상 팩토리로 생성 로직을 캡슐화하고 환경별 구현체를 교체하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "디자인패턴", "싱글턴", "팩토리", "생성패턴", "GoF", "의존성주입"]
featured: false
draft: false
---

[지난 글](/posts/pattern-observer-pubsub/)에서 옵저버·발행-구독 패턴을 살펴봤습니다. 이번에는 **생성 패턴(Creational Pattern)** 의 두 가지 핵심, **싱글턴** 과 **팩토리** 패턴을 다룹니다.

## 싱글턴 패턴

싱글턴은 클래스나 모듈의 인스턴스가 **단 하나만 존재**하도록 보장하는 패턴입니다. 데이터베이스 커넥션, 로거, 설정 객체처럼 전역에서 하나만 필요한 리소스에 사용합니다.

![싱글턴 패턴 — 단 하나의 인스턴스](/assets/posts/pattern-singleton-factory-singleton.svg)

### ES Module 싱글턴 (권장)

ES Module은 파일당 한 번만 평가되므로, 모듈 수준 변수가 자연스럽게 싱글턴입니다.

```js
// db.js — 모듈 자체가 싱글턴
import { createPool } from 'mysql2/promise';

const pool = createPool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

export default pool;

// 어디서 임포트해도 같은 pool 인스턴스
import pool from './db.js';
```

### 지연 초기화 싱글턴

처음 사용할 때 초기화가 필요한 경우(비동기 포함)입니다.

```js
// config-singleton.js
let _config = null;

export async function getConfig() {
  if (!_config) {
    const raw = await fs.readFile('./config.json', 'utf-8');
    _config = JSON.parse(raw);
  }
  return _config;
}

// 여러 곳에서 호출해도 config.json은 한 번만 읽음
const config = await getConfig();
```

### 클래스 기반 싱글턴

```js
class EventBus {
  static #instance = null;

  #handlers = new Map();

  // 생성자를 private으로 막기 (private constructor trick)
  constructor() {
    if (EventBus.#instance) {
      throw new Error('EventBus.getInstance()를 사용하세요');
    }
  }

  static getInstance() {
    if (!EventBus.#instance) {
      EventBus.#instance = new EventBus();
    }
    return EventBus.#instance;
  }

  on(event, handler) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(handler);
  }

  emit(event, data) {
    this.#handlers.get(event)?.forEach(h => h(data));
  }
}

const bus = EventBus.getInstance();
```

### 싱글턴의 문제점과 해결책

싱글턴은 전역 상태를 만들기 때문에 테스트가 어렵습니다.

```js
// 테스트에서 싱글턴 상태가 테스트 간 오염
it('test A', () => {
  const config = getConfig();
  config.debug = true;         // 전역 상태 오염
});

it('test B', () => {
  const config = getConfig();
  // config.debug가 여전히 true — 이전 테스트 영향
});

// 해결: 테스트에서 초기화 훅 제공
export function _resetConfigForTest() {
  _config = null;
}
```

더 나은 해결책은 **의존성 주입(DI)** 입니다. 싱글턴을 직접 임포트하는 대신 함수 인자로 받으면 테스트에서 Mock을 주입할 수 있습니다.

## 팩토리 패턴

팩토리는 **객체 생성 로직을 캡슐화**합니다. `new`를 직접 호출하는 대신 팩토리 함수에 위임해 생성 세부사항을 숨깁니다.

![팩토리 패턴 — 생성 로직 캡슐화](/assets/posts/pattern-singleton-factory-factory.svg)

### 팩토리 함수

```js
// 간단한 팩토리 함수 — 조건에 따라 다른 객체 반환
function createAnimal(type, name) {
  const base = { name, sound: '...' };

  switch (type) {
    case 'dog':  return { ...base, sound: '멍멍', fetch: () => `${name} 물어옴!` };
    case 'cat':  return { ...base, sound: '야옹', purr: () => `${name} 그르릉` };
    case 'bird': return { ...base, sound: '짹짹', fly: () => `${name} 날아감` };
    default: throw new Error(`알 수 없는 동물 타입: ${type}`);
  }
}

const dog = createAnimal('dog', '바둑이');
dog.fetch(); // "바둑이 물어옴!"
```

### 추상 팩토리 패턴

환경(개발/테스트/프로덕션)에 따라 다른 구현체를 반환합니다.

```js
// 스토리지 팩토리 — 환경별 구현 교체
class MemoryStorage {
  #data = new Map();
  async get(key) { return this.#data.get(key); }
  async set(key, value) { this.#data.set(key, value); }
  async delete(key) { this.#data.delete(key); }
}

class RedisStorage {
  constructor(client) { this.client = client; }
  async get(key) { return this.client.get(key); }
  async set(key, value) { return this.client.set(key, JSON.stringify(value)); }
  async delete(key) { return this.client.del(key); }
}

// 팩토리 함수 — 환경에 따라 적절한 구현체 반환
function createStorage(options = {}) {
  const env = options.env ?? process.env.NODE_ENV;

  if (env === 'test') {
    return new MemoryStorage(); // 테스트에서 실제 Redis 불필요
  }
  if (env === 'production') {
    return new RedisStorage(options.redisClient);
  }
  return new MemoryStorage(); // 개발환경 기본값
}

// 사용 — 구현체를 모르고 인터페이스만 사용
const storage = createStorage();
await storage.set('session:123', { userId: 1 });
const session = await storage.get('session:123');
```

### 빌더 패턴과의 조합

복잡한 객체 구성에는 팩토리와 빌더를 조합합니다.

```js
class QueryBuilder {
  #table = '';
  #conditions = [];
  #orderBy = null;
  #limit = null;

  from(table) { this.#table = table; return this; }
  where(condition) { this.#conditions.push(condition); return this; }
  orderBy(field, dir = 'ASC') { this.#orderBy = `${field} ${dir}`; return this; }
  limit(n) { this.#limit = n; return this; }

  build() {
    let sql = `SELECT * FROM ${this.#table}`;
    if (this.#conditions.length) {
      sql += ` WHERE ${this.#conditions.join(' AND ')}`;
    }
    if (this.#orderBy) sql += ` ORDER BY ${this.#orderBy}`;
    if (this.#limit) sql += ` LIMIT ${this.#limit}`;
    return sql;
  }
}

// 팩토리 함수로 빌더 생성
const query = () => new QueryBuilder();

const sql = query()
  .from('users')
  .where('active = true')
  .where('age > 18')
  .orderBy('name')
  .limit(20)
  .build();
// "SELECT * FROM users WHERE active = true AND age > 18 ORDER BY name ASC LIMIT 20"
```

## 싱글턴 vs 팩토리

| 항목 | 싱글턴 | 팩토리 |
|---|---|---|
| 인스턴스 수 | 정확히 1개 | 호출마다 새 인스턴스 가능 |
| 목적 | 공유 리소스 관리 | 생성 로직 추상화 |
| 테스트 | 어려움 (전역 상태) | 쉬움 (Mock 주입 가능) |
| 유연성 | 낮음 | 높음 |

실무에서는 싱글턴 대신 **모듈 레벨 변수** 또는 **DI 컨테이너**를 사용하는 추세입니다. 팩토리는 특히 **환경별 구현체 교체**, **테스트 더블 주입**에 강력합니다.

## 정리

싱글턴은 단 하나의 인스턴스를 보장하지만 전역 상태로 인한 테스트 어려움이 단점입니다. 팩토리는 생성 로직을 캡슐화해 조건부 생성과 환경별 구현체 교체를 깔끔하게 처리합니다.

---

**지난 글:** [옵저버·발행-구독 패턴 — 느슨한 결합의 이벤트 설계](/posts/pattern-observer-pubsub/)

**다음 글:** [전략·데코레이터 패턴 — 행위의 교체와 확장](/posts/pattern-strategy-decorator/)

<br>
읽어주셔서 감사합니다. 😊
