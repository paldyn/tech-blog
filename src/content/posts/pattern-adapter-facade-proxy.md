---
title: "어댑터·퍼사드·프록시 패턴 — 구조 패턴의 세 가지 얼굴"
description: "인터페이스를 변환하는 어댑터, 복잡한 서브시스템을 단일 진입점으로 감싸는 퍼사드, 동일 인터페이스를 유지하며 접근을 제어하는 프록시 패턴을 JavaScript 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "디자인패턴", "어댑터", "퍼사드", "프록시", "GoF", "구조패턴", "Proxy"]
featured: false
draft: false
---

[지난 글](/posts/pattern-strategy-decorator/)에서 전략·데코레이터 패턴으로 행위를 교체하고 확장하는 방법을 살펴봤습니다. 이번에는 **구조 패턴(Structural Pattern)** 세 가지—**어댑터(Adapter)**, **퍼사드(Facade)**, **프록시(Proxy)**—를 JavaScript 코드와 함께 정리합니다. 세 패턴 모두 "래퍼(wrapper)"를 두는 방식이지만, 해결하는 문제가 다릅니다.

![어댑터·퍼사드·프록시 개념 구조](/assets/posts/pattern-adapter-facade-proxy-concept.svg)

## 어댑터 패턴 — 인터페이스 변환

어댑터는 **호환되지 않는 두 인터페이스를 연결**합니다. 기존 코드를 수정하지 않고, 중간에 변환 레이어를 끼워 맞춥니다.

### 어디서 필요한가

- 외부 라이브러리를 팀 내부 규격으로 감쌀 때
- 레거시 API를 새 인터페이스로 마이그레이션할 때 (점진적 교체)
- 테스트에서 실제 서비스를 페이크(fake)로 대체할 때

### 함수형 어댑터

클래스 없이 함수로 구현하면 가볍습니다.

```javascript
// Adaptee: XML 반환 구형 API
function fetchLegacyData(id) {
  return `<data><id>${id}</id><value>42</value></data>`;
}

// Adapter: XML → JSON 변환
function legacyToJsonAdapter(id) {
  const xml = fetchLegacyData(id);
  const idMatch   = xml.match(/<id>(\d+)<\/id>/);
  const valMatch  = xml.match(/<value>(\d+)<\/value>/);
  return { id: Number(idMatch[1]), value: Number(valMatch[1]) };
}

// Target 인터페이스: JSON을 기대하는 클라이언트 코드
async function renderWidget(fetchJson) {
  const data = await fetchJson(1);
  console.log(data.value); // 42
}

renderWidget(legacyToJsonAdapter);
```

### 클래스 어댑터 — 외부 HTTP 클라이언트 통일

팀에서 `axios` 스타일(`{data, status}` 응답)을 표준으로 정했지만, 일부 코드가 `fetch`를 사용한다면 어댑터로 감쌉니다.

```javascript
class FetchAdapter {
  async get(url, config = {}) {
    const res = await fetch(url, {
      headers: config.headers ?? {},
    });
    if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
    return { data: await res.json(), status: res.status };
  }

  async post(url, body, config = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config.headers },
      body: JSON.stringify(body),
    });
    return { data: await res.json(), status: res.status };
  }
}

// 팀 전체가 axios 스타일로 통일
const http = new FetchAdapter();
const { data } = await http.get('/api/users');
```

---

## 퍼사드 패턴 — 복잡성 은닉

퍼사드는 **복잡한 서브시스템에 단순한 단일 진입점**을 제공합니다. 서브시스템 자체를 변경하거나 숨기는 것이 아니라, 자주 사용되는 흐름을 하나의 메서드로 조합해 줍니다.

### 퍼사드가 필요한 순간

- 인증, HTTP 요청, 캐시, 로깅이 각각 별도 클래스로 분리되어 있을 때
- SDK를 초기화하는 순서가 복잡할 때
- 여러 서비스를 조합해야 하는 유스케이스가 반복될 때

```javascript
// 서브시스템들
class AuthService {
  async getToken() { return localStorage.getItem('token'); }
}

class HttpClient {
  async get(url, headers) {
    const res = await fetch(url, { headers });
    return res.json();
  }
}

class ResponseCache {
  #store = new Map();
  get(key)           { return this.#store.get(key); }
  set(key, val, ttl) {
    this.#store.set(key, val);
    setTimeout(() => this.#store.delete(key), ttl);
  }
}

// 퍼사드 — 세 서브시스템을 조율
class ApiFacade {
  #auth   = new AuthService();
  #http   = new HttpClient();
  #cache  = new ResponseCache();

  async get(url, cacheTtl = 30_000) {
    const cached = this.#cache.get(url);
    if (cached) return cached;

    const token = await this.#auth.getToken();
    const data  = await this.#http.get(url, {
      Authorization: `Bearer ${token}`,
    });

    this.#cache.set(url, data, cacheTtl);
    return data;
  }
}

// 클라이언트는 단 한 줄
const api  = new ApiFacade();
const user = await api.get('/api/me');
```

인증 흐름이 바뀌어도, 캐시 전략이 바뀌어도 클라이언트 코드를 건드리지 않아도 됩니다.

---

## 프록시 패턴 — 투명한 접근 제어

프록시는 실제 대상과 **동일한 인터페이스**를 가지면서, 그 앞에서 접근을 가로채 캐시·지연 로딩·접근 권한 검사 등을 삽입합니다.

### ES6 `Proxy`를 활용한 메모이제이션 프록시

```javascript
function memoProxy(fn) {
  const cache = new Map();
  return new Proxy(fn, {
    apply(target, thisArg, args) {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = Reflect.apply(target, thisArg, args);
      cache.set(key, result);
      return result;
    },
  });
}

function expensiveCalc(n) {
  console.log('계산 중...');
  return n * n;
}

const cachedCalc = memoProxy(expensiveCalc);
cachedCalc(10); // "계산 중..." 출력 후 100
cachedCalc(10); // 캐시 히트, 출력 없이 100
```

### 가상 프록시 — 지연 로딩

무거운 객체를 실제로 필요한 순간까지 생성을 미룹니다.

```javascript
function lazyProxy(factory) {
  let instance = null;
  return new Proxy({}, {
    get(_, prop) {
      instance ??= factory();
      return instance[prop];
    },
  });
}

const heavyService = lazyProxy(() => {
  console.log('서비스 초기화');
  return { process: (x) => x * 2 };
});

// 이 시점까지 초기화 안 됨
heavyService.process(5); // "서비스 초기화" 출력 후 10
heavyService.process(5); // 초기화 없이 10
```

### 보호 프록시 — 접근 권한 검사

```javascript
function protectedProxy(target, role) {
  const ADMIN_ONLY = new Set(['delete', 'reset']);
  return new Proxy(target, {
    get(obj, prop) {
      if (ADMIN_ONLY.has(prop) && role !== 'admin') {
        throw new Error(`'${prop}'은 관리자 전용입니다.`);
      }
      return Reflect.get(obj, prop);
    },
  });
}
```

---

## 세 패턴 한눈에 비교

![JavaScript 구현 예시](/assets/posts/pattern-adapter-facade-proxy-code.svg)

| 구분 | 어댑터 | 퍼사드 | 프록시 |
|---|---|---|---|
| **목적** | 인터페이스 변환 | 복잡성 단순화 | 접근 제어 |
| **인터페이스** | Target 인터페이스 제공 | 새 인터페이스 정의 | 동일 인터페이스 유지 |
| **서브시스템 변경** | 어댑티 코드 불변 | 서브시스템 불변 | 실제 대상 불변 |
| **JS 특기** | 함수형 래퍼 | 클래스 조합 | `Proxy` / `Reflect` |

세 패턴의 공통점은 **래핑**이지만, 해결하는 문제가 다릅니다. 어댑터는 "이미 있는 두 인터페이스를 연결"하고, 퍼사드는 "복잡한 내부를 단순한 API 뒤에 숨기고", 프록시는 "원본과 같은 인터페이스로 행동을 가로채거나 제어"합니다.

---

**지난 글:** [전략·데코레이터 패턴 — 행위의 교체와 확장](/posts/pattern-strategy-decorator/)

**다음 글:** [모듈 패턴 — 캡슐화와 네임스페이스](/posts/pattern-module/)

<br>
읽어주셔서 감사합니다. 😊
