---
title: "옵저버·발행-구독 패턴 — 느슨한 결합의 이벤트 설계"
description: "옵저버 패턴과 발행-구독 패턴의 차이, JavaScript EventEmitter 기반 구현, 메모리 누수 방지를 위한 구독 해제 전략, 실제 상태 관리 스토어 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "디자인패턴", "옵저버", "발행구독", "PubSub", "EventEmitter", "상태관리"]
featured: false
draft: false
---

[지난 글](/posts/fp-errors-as-values/)에서 함수형 에러 설계 패턴을 다뤘습니다. 이번부터는 **디자인 패턴** 시리즈를 시작합니다. 첫 번째 주제는 느슨한 결합 이벤트 시스템의 기초, **옵저버 패턴** 과 **발행-구독 패턴** 입니다.

## 옵저버 패턴

옵저버 패턴에서는 **Subject(Observable)** 가 상태 변화를 직접 **Observer** 들에게 알립니다. Subject는 Observer 목록을 유지하고, 변화가 있을 때 순회하며 알림을 보냅니다.

![옵저버 vs 발행-구독 패턴](/assets/posts/pattern-observer-pubsub-compare.svg)

```js
class Observable {
  #observers = [];

  subscribe(observer) {
    this.#observers.push(observer);
    // 구독 해제 함수 반환 (클린업 패턴)
    return () => {
      this.#observers = this.#observers.filter(o => o !== observer);
    };
  }

  notify(data) {
    this.#observers.forEach(observer => observer(data));
  }
}
```

Subject는 Observer를 직접 참조하므로 **강한 결합**입니다. Observer를 구독 해제하지 않으면 메모리 누수가 발생합니다.

## 옵저버로 상태 스토어 만들기

![옵저버 패턴 구현](/assets/posts/pattern-observer-pubsub-impl.svg)

옵저버 패턴으로 간단한 상태 스토어를 구현할 수 있습니다. Zustand, Jotai 같은 라이브러리의 핵심 원리입니다.

```js
class Store extends Observable {
  #state;

  constructor(initialState) {
    super();
    this.#state = initialState;
  }

  setState(updater) {
    const next = updater(this.#state);
    if (next !== this.#state) {  // 참조 변경 시에만 알림
      this.#state = next;
      this.notify(this.#state);
    }
  }

  getState() {
    return this.#state;
  }
}

// 사용
const store = new Store({ count: 0, user: null });

const unsubscribe = store.subscribe(state => {
  console.log('상태 변경:', state.count);
});

store.setState(s => ({ ...s, count: s.count + 1 })); // "상태 변경: 1"
store.setState(s => ({ ...s, count: s.count + 1 })); // "상태 변경: 2"

// 클린업
unsubscribe();
store.setState(s => ({ ...s, count: 99 })); // 알림 없음
```

## 발행-구독(Pub/Sub) 패턴

발행-구독 패턴은 **중간 브로커(Message Bus, Event Bus)** 를 둬서 발행자(Publisher)와 구독자(Subscriber)가 서로를 전혀 모르게 합니다.

```js
class EventBus {
  #handlers = new Map();

  on(event, handler) {
    if (!this.#handlers.has(event)) {
      this.#handlers.set(event, new Set());
    }
    this.#handlers.get(event).add(handler);
    // 구독 해제 함수 반환
    return () => this.#handlers.get(event)?.delete(handler);
  }

  once(event, handler) {
    const wrapper = (...args) => {
      handler(...args);
      off();
    };
    const off = this.on(event, wrapper);
    return off;
  }

  emit(event, data) {
    this.#handlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error(`EventBus error in "${event}":`, e);
      }
    });
  }

  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }
}

const bus = new EventBus();

// 구독자들은 서로를 모름
const off1 = bus.on('user:login', user => console.log(`${user.name} 로그인`));
const off2 = bus.on('user:login', user => updateLastLogin(user.id));
const off3 = bus.on('user:login', user => sendWelcomeNotification(user));

// 발행자는 구독자를 모름
bus.emit('user:login', { id: 1, name: 'Alice' });

// 클린업
off1(); off2(); off3();
```

## 옵저버 vs Pub/Sub 차이

| 항목 | 옵저버 | Pub/Sub |
|---|---|---|
| 결합도 | Subject → Observer 직접 참조 | 브로커로 완전 분리 |
| 통신 방식 | 동기 | 동기 또는 비동기 |
| 스코프 | 단일 앱 내 | 크로스 모듈, 마이크로서비스 |
| 예시 | DOM 이벤트, RxJS Subject | Redis Pub/Sub, Kafka |

## 메모리 누수 방지

옵저버 패턴의 가장 흔한 실수는 구독 해제를 빠트리는 것입니다.

```js
// React 컴포넌트에서의 클린업 패턴
function UserStatus({ userId }) {
  const [status, setStatus] = useState('offline');

  useEffect(() => {
    // 구독
    const off = store.subscribe(state => {
      if (state.userId === userId) {
        setStatus(state.status);
      }
    });

    // 언마운트 시 반드시 구독 해제
    return off;
  }, [userId]);

  return <span>{status}</span>;
}

// WeakRef를 활용한 자동 클린업 (참조가 GC되면 자동 제거)
class WeakObservable {
  #refs = new Set();

  subscribe(observer) {
    const ref = new WeakRef(observer);
    this.#refs.add(ref);
    return () => this.#refs.delete(ref);
  }

  notify(data) {
    for (const ref of this.#refs) {
      const observer = ref.deref();
      if (observer) {
        observer(data);
      } else {
        this.#refs.delete(ref); // GC된 참조 제거
      }
    }
  }
}
```

## DOM 이벤트는 옵저버 패턴

브라우저의 `addEventListener`는 옵저버 패턴의 구현입니다.

```js
const button = document.querySelector('#btn');

// subscribe
const handler = e => console.log('클릭!', e.target);
button.addEventListener('click', handler);

// unsubscribe — 반드시 같은 함수 참조로
button.removeEventListener('click', handler);

// AbortController로 일괄 해제
const controller = new AbortController();
button.addEventListener('click', handler, { signal: controller.signal });
input.addEventListener('input', inputHandler, { signal: controller.signal });
// 모든 리스너 한 번에 해제
controller.abort();
```

## 비동기 이벤트 처리

이벤트 핸들러가 비동기 함수일 때는 에러를 명시적으로 처리해야 합니다.

```js
class AsyncEventBus extends EventBus {
  async emitAsync(event, data) {
    const handlers = [...(this.#handlers.get(event) ?? [])];
    const results = await Promise.allSettled(
      handlers.map(h => Promise.resolve(h(data)))
    );
    const errors = results.filter(r => r.status === 'rejected');
    if (errors.length > 0) {
      console.error(`${event}: ${errors.length}개 핸들러 실패`);
    }
  }
}
```

## 정리

옵저버 패턴은 Subject와 Observer가 직접 연결된 **동기적이고 단순한** 이벤트 시스템입니다. Pub/Sub은 브로커를 통해 완전히 분리된 **확장 가능한** 이벤트 시스템입니다. 두 패턴 모두 **구독 해제(unsubscribe)** 가 핵심입니다.

---

**지난 글:** [에러를 값으로 — 함수형 에러 설계 패턴](/posts/fp-errors-as-values/)

**다음 글:** [싱글턴·팩토리 패턴 — 객체 생성의 제어와 추상화](/posts/pattern-singleton-factory/)

<br>
읽어주셔서 감사합니다. 😊
