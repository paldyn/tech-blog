---
title: "IndexedDB 완전 이해"
description: "브라우저 내장 NoSQL 저장소 IndexedDB의 Database·ObjectStore·Transaction 구조, CRUD 패턴, 인덱스 조회, idb 라이브러리 활용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "IndexedDB", "브라우저", "스토리지", "NoSQL", "트랜잭션", "idb"]
featured: false
draft: false
---

[지난 글](/posts/browser-cookie-api/)에서 쿠키 API를 살펴봤습니다. 이번에는 브라우저 내장 NoSQL 저장소인 IndexedDB를 정리합니다. localStorage가 단순 문자열 키-값 저장에 그치는 반면, IndexedDB는 구조화된 객체를 대용량으로 저장하고 인덱스·트랜잭션을 지원하는 본격적인 클라이언트 DB입니다.

---

## IndexedDB란

IndexedDB는 origin별로 격리된 브라우저 내장 키-값 데이터베이스입니다. 저장 용량 제한이 localStorage(약 5MB)보다 훨씬 크고(일반적으로 디스크의 수십~수백 GB까지 가능), Blob·File·ArrayBuffer 같은 이진 데이터도 그대로 저장할 수 있습니다.

![IndexedDB 아키텍처](/assets/posts/browser-indexeddb-architecture.svg)

핵심 개념 세 가지:
- **Database**: origin당 여러 개 생성 가능. 버전 번호로 스키마를 관리합니다.
- **Object Store**: 관계형 DB의 테이블에 해당. 각 스토어는 하나의 keyPath를 가집니다.
- **Transaction**: 모든 읽기·쓰기는 반드시 트랜잭션 안에서 이루어집니다.

---

## DB 열기와 스키마 마이그레이션

```js
const request = indexedDB.open('myApp-db', 3); // name, version

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  if (oldVersion < 1) {
    const store = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
    store.createIndex('by-email', 'email', { unique: true });
  }
  if (oldVersion < 2) {
    db.createObjectStore('products', { keyPath: 'sku' });
  }
  if (oldVersion < 3) {
    const users = event.target.transaction.objectStore('users');
    users.createIndex('by-age', 'age');
  }
};

request.onsuccess = (event) => {
  const db = event.target.result;
  // db 사용
};

request.onerror = (event) => {
  console.error('DB open error:', event.target.error);
};
```

`onupgradeneeded`는 버전이 올라갈 때만 실행됩니다. 스키마 변경은 반드시 여기서만 합니다.

---

## CRUD 패턴

```js
// 쓰기 (add: 중복 키 → 에러, put: upsert)
function addUser(db, user) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const req = store.put(user);
    req.onsuccess = () => resolve(req.result); // 저장된 key 반환
    req.onerror = () => reject(req.error);
  });
}

// 읽기 (키로 단건 조회)
function getUser(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const req = tx.objectStore('users').get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

// 전체 조회
function getAllUsers(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const req = tx.objectStore('users').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 삭제
function deleteUser(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const req = tx.objectStore('users').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
```

![IndexedDB 트랜잭션 흐름](/assets/posts/browser-indexeddb-transaction.svg)

---

## 인덱스로 조회

keyPath가 아닌 다른 필드로 검색하려면 인덱스를 사용합니다.

```js
function getUserByEmail(db, email) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const idx = tx.objectStore('users').index('by-email');
    const req = idx.get(email);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

// 범위 쿼리 (나이 20~30)
function getUsersByAgeRange(db, min, max) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const idx = tx.objectStore('users').index('by-age');
    const range = IDBKeyRange.bound(min, max);
    const req = idx.getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

`IDBKeyRange`는 `only`, `lowerBound`, `upperBound`, `bound`를 지원합니다.

---

## Cursor로 순회

`getAll()`은 결과 전체를 메모리에 올리므로, 대용량 데이터는 커서를 사용합니다.

```js
function forEachUser(db, callback) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const req = tx.objectStore('users').openCursor();
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        callback(cursor.value);
        cursor.continue(); // 다음 레코드로
      } else {
        resolve(); // 순회 완료
      }
    };
    req.onerror = () => reject(req.error);
  });
}
```

---

## idb 라이브러리 — Promise 래퍼

IndexedDB의 이벤트 기반 API는 장황합니다. Jake Archibald의 [idb](https://github.com/jakearchibald/idb) 라이브러리가 Promise/async 인터페이스를 제공합니다.

```js
import { openDB } from 'idb';

const db = await openDB('myApp-db', 3, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const store = db.createObjectStore('users', { keyPath: 'id' });
      store.createIndex('by-email', 'email', { unique: true });
    }
  },
});

// CRUD — await 가능
await db.put('users', { id: 1, name: 'Alice', email: 'alice@ex.com' });
const user = await db.get('users', 1);
const all = await db.getAll('users');
await db.delete('users', 1);

// 인덱스 조회
const byEmail = await db.getFromIndex('users', 'by-email', 'alice@ex.com');
```

---

## 트랜잭션 주의사항

IndexedDB 트랜잭션은 **자동 커밋** 방식입니다. 모든 요청이 완료되면 자동으로 닫힙니다. `await`를 포함한 비동기 gap이 생기면 트랜잭션이 먼저 닫혀버립니다.

```js
// ❌ 잘못된 패턴 — await로 트랜잭션이 닫힘
const tx = db.transaction('users', 'readwrite');
const store = tx.objectStore('users');
const user = await new Promise(r => { store.get(1).onsuccess = e => r(e.target.result); });
// ↑ 이 await 동안 트랜잭션이 닫혀 다음 요청이 실패

// ✅ 올바른 패턴 — idb의 트랜잭션 API 활용
const tx2 = db.transaction('users', 'readwrite');
const user2 = await tx2.store.get(1);
await tx2.store.put({ ...user2, age: user2.age + 1 });
await tx2.done; // 커밋 대기
```

---

## 언제 IndexedDB를 써야 하나

| 기준 | localStorage | IndexedDB |
|------|-------------|-----------|
| 저장 대상 | 단순 문자열 | 구조화 객체, Blob |
| 용량 | ~5 MB | 수백 MB ~ GB |
| 트랜잭션 | 없음 | 있음 |
| 인덱스 쿼리 | 없음 | 있음 |
| 비동기 | 동기 (blocking) | 비동기 |
| 적합한 경우 | 사용자 설정, 토큰 | 오프라인 데이터, 캐시 |

---

**다음 글:** [Cache API 완전 이해](/posts/browser-cache-api/)

<br>
읽어주셔서 감사합니다. 😊
