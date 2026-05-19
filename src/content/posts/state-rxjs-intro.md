---
title: "RxJS 입문 — Observable과 반응형 프로그래밍"
description: "RxJS가 필요한 이유, Observable 패러다임과 Promise의 차이, 구독과 해지, 생성·변환·고차·결합 연산자, switchMap·mergeMap·concatMap 차이, Subject, Angular/React에서의 활용 패턴, 마블 다이어그램 읽는 법까지 RxJS 핵심을 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "RxJS", "Observable", "반응형프로그래밍", "비동기", "switchMap", "Subject", "Angular", "React"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "state-mobx"
  title: "MobX — 반응형 상태 관리"
next:
  slug: "state-tanstack-query"
  title: "TanStack Query — 서버 상태 관리의 표준"
---

[지난 글](/posts/state-mobx/)에서 MobX의 투명한 반응형 상태 관리를 살펴봤습니다. 이번에는 한 단계 더 깊이 들어가 **RxJS(Reactive Extensions for JavaScript)**를 다룹니다. RxJS는 상태 관리 라이브러리가 아니라 **비동기 이벤트 스트림을 다루는 라이브러리**입니다. 클릭, HTTP 요청, WebSocket 메시지, 타이머 등 시간축 위에 펼쳐지는 모든 것을 하나의 모델로 다룰 수 있습니다.

---

## RxJS가 필요한 이유

JavaScript에서 비동기를 처리하는 방법은 콜백 → Promise → async/await 순으로 발전해왔습니다. 단일 비동기 작업은 Promise와 async/await으로 충분합니다. 하지만 다음 시나리오를 생각해보세요:

- 검색창 입력마다 API를 호출하되, 이전 요청은 취소해야 한다
- 여러 소스의 이벤트를 결합해 하나의 상태를 만들어야 한다
- WebSocket 메시지에 필터링·변환·디바운싱을 적용해야 한다
- 실패 시 3번까지 재시도하고, 그래도 실패하면 폴백을 보여줘야 한다

이런 **비동기 이벤트의 조합과 변환**이 많아질수록 Promise 기반 코드는 복잡해집니다. RxJS는 이 복잡함을 **파이프라인**으로 표현합니다.

```javascript
// Promise 방식 — 취소·조합이 어렵다
let currentRequest = null

async function search(query) {
  currentRequest?.abort()
  const controller = new AbortController()
  currentRequest = controller
  const data = await fetch(`/api/search?q=${query}`, {
    signal: controller.signal
  }).then(r => r.json())
  return data
}

// RxJS 방식 — 선언적으로 표현
fromEvent(input, 'input').pipe(
  map(e => e.target.value),
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(query => ajax.getJSON(`/api/search?q=${query}`))
).subscribe(results => setResults(results))
```

---

## Observable 패러다임 vs Promise

Observable과 Promise의 차이를 이해하는 것이 RxJS 학습의 출발점입니다.

| 특성 | Promise | Observable |
|---|---|---|
| 값의 수 | 단일 값 (1개) | 0개 ~ 무한 |
| 실행 시점 | 즉시 실행 (eager) | 구독 시 실행 (lazy) |
| 취소 | 불가 (기본) | `unsubscribe()`로 취소 가능 |
| 연산자 | `.then()`, `.catch()` | 70개 이상의 연산자 |
| 멀티캐스트 | 가능 | 기본은 유니캐스트 (Subject로 멀티캐스트) |

Observable은 **lazy**합니다. `subscribe()`를 호출하기 전까지 아무 일도 일어나지 않습니다.

```javascript
import { Observable } from 'rxjs'

const observable = new Observable(subscriber => {
  console.log('구독됨!')
  subscriber.next(1)
  subscriber.next(2)
  subscriber.complete()
})

// 이 시점까지 아무것도 실행되지 않음
console.log('구독 전')

observable.subscribe({
  next: value => console.log('값:', value),
  error: err => console.error('에러:', err),
  complete: () => console.log('완료')
})

// 출력 순서:
// 구독 전
// 구독됨!
// 값: 1
// 값: 2
// 완료
```

![RxJS Observable 스트림](/assets/posts/state-rxjs-intro-stream.svg)

---

## 구독(subscribe)과 해지(unsubscribe), 메모리 누수 주의

Observable을 구독하면 `Subscription` 객체가 반환됩니다. 더 이상 필요 없을 때 반드시 해지해야 합니다.

```javascript
import { interval } from 'rxjs'

const subscription = interval(1000).subscribe(n => console.log(n))

// 3초 후 해지
setTimeout(() => {
  subscription.unsubscribe()
  console.log('구독 해지 완료')
}, 3000)
```

React에서는 `useEffect`의 cleanup 함수에서 해지합니다.

```javascript
useEffect(() => {
  const sub = someObservable$.subscribe(handler)
  return () => sub.unsubscribe()  // 컴포넌트 언마운트 시 자동 해지
}, [])
```

`takeUntil`, `take`, `first` 같은 완료 연산자를 사용하면 Observable이 자동으로 완료되어 구독도 자동 해지됩니다.

```javascript
import { interval, Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'

const destroy$ = new Subject()

interval(1000).pipe(
  takeUntil(destroy$)  // destroy$가 emit하면 자동 완료
).subscribe(n => console.log(n))

// 컴포넌트 소멸 시
destroy$.next()
destroy$.complete()
```

---

## 생성 연산자

RxJS는 다양한 소스로부터 Observable을 만드는 생성 연산자를 제공합니다.

```javascript
import { of, from, interval, fromEvent, timer } from 'rxjs'
import { ajax } from 'rxjs/ajax'

// of: 주어진 값들을 순서대로 emit하고 완료
of(1, 2, 3).subscribe(console.log)  // 1, 2, 3

// from: Promise, 배열, 이터러블을 Observable로 변환
from([10, 20, 30]).subscribe(console.log)
from(fetch('/api/data')).subscribe(res => console.log(res.status))

// interval: 지정한 ms마다 0부터 증가하는 숫자 emit
interval(1000).pipe(take(5)).subscribe(console.log)  // 0,1,2,3,4

// fromEvent: DOM 이벤트를 Observable로
fromEvent(document, 'click').subscribe(e => console.log(e.clientX))

// timer: 지연 후 한 번, 또는 주기적으로 emit
timer(2000, 1000).subscribe(console.log)  // 2초 후 시작, 1초마다

// ajax: HTTP 요청
ajax.getJSON('/api/users').subscribe(users => console.log(users))
```

---

## 변환 연산자: map, filter, tap

파이프라인에서 스트림의 값을 변환합니다.

```javascript
import { fromEvent } from 'rxjs'
import { map, filter, tap } from 'rxjs/operators'

fromEvent(document, 'keyup').pipe(
  map(e => e.key),                        // KeyboardEvent → key 문자열
  filter(key => key.length === 1),        // 단일 문자만 통과
  tap(key => console.log('입력:', key)),  // 부수 효과 (디버깅), 스트림 변경 없음
  map(key => key.toUpperCase())           // 대문자 변환
).subscribe(key => console.log('최종:', key))
```

`tap`은 스트림의 값을 변경하지 않고 부수 효과만 실행합니다. 디버깅이나 로깅에 유용합니다.

---

## 고차 연산자: switchMap, mergeMap, concatMap, exhaustMap

고차(higher-order) 연산자는 **각 값을 새로운 Observable로 변환**합니다. "Observable을 emit하는 Observable"을 평탄화(flatten)하는 방식이 각각 다릅니다.

![switchMap vs mergeMap vs concatMap](/assets/posts/state-rxjs-intro-operators.svg)

### switchMap — 이전 inner 취소

새 값이 오면 이전 inner Observable을 취소하고 새 것을 시작합니다. 검색 자동완성처럼 "최신 요청만 유효"한 경우에 적합합니다.

```javascript
import { fromEvent } from 'rxjs'
import { map, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators'
import { ajax } from 'rxjs/ajax'

fromEvent(searchInput, 'input').pipe(
  map(e => e.target.value),
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(query =>
    ajax.getJSON(`/api/search?q=${encodeURIComponent(query)}`)
  )
).subscribe(results => renderResults(results))
```

### mergeMap — 병렬 실행

모든 inner Observable을 동시에 실행하고 도착하는 순서대로 emit합니다. 독립적인 HTTP 요청을 병렬로 실행할 때 적합합니다.

```javascript
import { from } from 'rxjs'
import { mergeMap } from 'rxjs/operators'
import { ajax } from 'rxjs/ajax'

const userIds = [1, 2, 3, 4, 5]

from(userIds).pipe(
  mergeMap(id => ajax.getJSON(`/api/users/${id}`))
  // 5개 요청이 동시에 실행, 응답 순서는 비보장
).subscribe(user => console.log(user))
```

### concatMap — 순서 보장

이전 inner Observable이 완료된 후에만 다음 것을 시작합니다. 순서가 중요한 파일 업로드, 순차 API 호출에 적합합니다.

```javascript
import { from } from 'rxjs'
import { concatMap } from 'rxjs/operators'

const filesToUpload = [file1, file2, file3]

from(filesToUpload).pipe(
  concatMap(file => uploadFile(file))  // file1 완료 후 file2, file2 완료 후 file3
).subscribe(result => console.log('업로드 완료:', result.name))
```

### exhaustMap — 진행 중이면 무시

inner Observable이 실행 중일 때 새 값이 오면 무시합니다. 로그인 버튼처럼 중복 클릭을 방지할 때 적합합니다.

```javascript
import { fromEvent } from 'rxjs'
import { exhaustMap } from 'rxjs/operators'

fromEvent(loginButton, 'click').pipe(
  exhaustMap(() => loginRequest$)  // 로그인 진행 중 추가 클릭 무시
).subscribe(user => navigateHome(user))
```

---

## 결합 연산자

여러 Observable을 결합할 때 사용합니다.

```javascript
import { combineLatest, forkJoin, merge } from 'rxjs'

// combineLatest: 모든 소스의 최신 값을 결합, 하나라도 바뀌면 emit
const form$ = combineLatest([
  nameInput$,
  emailInput$,
  passwordInput$
]).pipe(
  map(([name, email, password]) => ({ name, email, password }))
)

// forkJoin: 모든 소스가 완료되면 마지막 값을 배열로 emit (Promise.all과 유사)
forkJoin([
  ajax.getJSON('/api/user'),
  ajax.getJSON('/api/posts'),
  ajax.getJSON('/api/comments')
]).subscribe(([user, posts, comments]) => {
  console.log(user, posts, comments)
})

// merge: 여러 소스를 하나의 스트림으로 합침
merge(
  fromEvent(document, 'click'),
  fromEvent(document, 'touchstart')
).subscribe(e => console.log('입력 감지:', e.type))
```

---

## Subject: Observable이자 Observer

`Subject`는 Observable과 Observer 역할을 동시에 합니다. 외부에서 직접 값을 push할 수 있어 이벤트 버스, 컴포넌트 간 통신에 활용됩니다.

```javascript
import { Subject, BehaviorSubject, ReplaySubject } from 'rxjs'

// Subject: 구독 후 emit된 값만 받음
const subject = new Subject()
subject.subscribe(v => console.log('A:', v))
subject.next(1)  // A: 1
subject.subscribe(v => console.log('B:', v))
subject.next(2)  // A: 2, B: 2

// BehaviorSubject: 초기값을 가지며 최신 값을 새 구독자에게 즉시 전달
const count$ = new BehaviorSubject(0)
count$.subscribe(v => console.log('count:', v))  // 즉시 0 출력
count$.next(1)   // count: 1
count$.next(2)   // count: 2
// 나중에 구독해도 현재값(2)을 즉시 받음
count$.subscribe(v => console.log('late:', v))   // late: 2

// ReplaySubject: 지정한 개수만큼 이전 값을 새 구독자에게 재생
const replay$ = new ReplaySubject(3)  // 마지막 3개 값 보관
replay$.next(10)
replay$.next(20)
replay$.next(30)
replay$.next(40)
replay$.subscribe(v => console.log(v))  // 20, 30, 40 즉시 출력
```

---

## Angular/React에서의 RxJS 활용 패턴

### Angular: 기본 내장

Angular는 RxJS를 기본으로 사용합니다. `HttpClient`는 Observable을 반환하고, `async` 파이프로 템플릿에서 직접 구독할 수 있습니다.

```typescript
// Angular 서비스
@Injectable({ providedIn: 'root' })
export class UserService {
  users$ = this.http.get<User[]>('/api/users').pipe(
    shareReplay(1)  // 여러 컴포넌트가 구독해도 요청은 한 번
  )

  constructor(private http: HttpClient) {}
}

// Angular 템플릿 — async 파이프가 구독/해지 자동 처리
@Component({
  template: `
    <div *ngFor="let user of userService.users$ | async">
      {{ user.name }}
    </div>
  `
})
export class UserListComponent {
  constructor(public userService: UserService) {}
}
```

### React: 커스텀 훅 패턴

```javascript
import { useState, useEffect } from 'react'
import { BehaviorSubject } from 'rxjs'
import { distinctUntilChanged } from 'rxjs/operators'

// 전역 상태를 BehaviorSubject로 관리
const theme$ = new BehaviorSubject('light')

// RxJS Observable을 React 상태로 연결하는 커스텀 훅
function useObservable(observable$, initialValue) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    const sub = observable$.subscribe(v => setValue(v))
    return () => sub.unsubscribe()
  }, [observable$])

  return value
}

// 사용
function ThemeToggle() {
  const theme = useObservable(theme$, 'light')

  return (
    <button onClick={() => theme$.next(theme === 'light' ? 'dark' : 'light')}>
      현재 테마: {theme}
    </button>
  )
}
```

---

## 마블 다이어그램 읽는 법

RxJS 공식 문서는 **마블 다이어그램(marble diagram)**으로 연산자 동작을 시각화합니다.

```
시간 →
─────●─────●─────●──|─→   source$  (●: 값 emit, |: 완료, ✗: 에러)
     1     2     3

map(x => x * 2)

─────●─────●─────●──|─→   result$
     2     4     6
```

읽는 규칙:
- **가로축**: 시간의 흐름 (왼쪽 → 오른쪽)
- **원(●)**: 값이 emit되는 시점과 값
- **세로 선(|)**: Observable 완료
- **X**: 에러 발생
- **아래 화살표**: 연산자 적용
- **결과 라인**: 연산자 출력

`switchMap`의 마블 다이어그램을 읽으면:

```
source$: ─────A──────B──────C──|─→
              │      │      │
              ∨      │      │
         ─a──a──✗    │      │      (A의 inner — B 도착 시 취소)
                ─b───b──✗   │      (B의 inner — C 도착 시 취소)
                        ─c──c──|─→ (C의 inner — 완료까지 실행)

result$:                ─c──c──|─→
```

공식 사이트 [rxmarbles.com](https://rxmarbles.com)에서 인터랙티브하게 마블 다이어그램을 실험해볼 수 있습니다.

---

## 정리

RxJS는 처음 접하면 연산자 이름과 개수에 압도될 수 있습니다. 하지만 핵심 개념은 단순합니다:

- **Observable** — 시간축 위의 값의 흐름, 구독 전까지 실행 안 됨 (lazy)
- **subscribe** — 구독 시작, 반드시 `unsubscribe`로 해지해야 메모리 누수 없음
- **pipe + operators** — 생성 → 변환 → 필터링 → 결합 의 선언적 파이프라인
- **고차 연산자 4종**: switchMap(취소) / mergeMap(병렬) / concatMap(순서) / exhaustMap(무시)
- **Subject** — Observer + Observable, 외부에서 직접 push 가능

처음에는 `fromEvent`, `map`, `filter`, `debounceTime`, `switchMap` 다섯 가지만 익혀도 실용적인 사용 사례 대부분을 커버할 수 있습니다. 나머지 연산자는 필요할 때 공식 문서에서 마블 다이어그램을 보며 찾으면 됩니다.

다음 글에서는 [TanStack Query — 서버 상태 관리의 표준](/posts/state-tanstack-query/)에서 서버 데이터를 위한 특화된 상태 관리를 살펴봅니다.
