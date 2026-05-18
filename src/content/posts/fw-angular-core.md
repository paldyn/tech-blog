---
title: "Angular 핵심 — Zone.js, DI, 변경 감지, Signals"
description: "Angular의 계층형 DI 시스템, Zone.js 기반 변경 감지와 OnPush 전략, Standalone 컴포넌트, Signals API, RxJS 통합, Angular 17+ 새 기능을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Angular", "DI", "Zone.js", "Signals", "OnPush", "RxJS", "TypeScript"]
featured: false
draft: false
---

[지난 글](/posts/fw-svelte-core/)에서 Svelte의 컴파일러 기반 반응성을 살펴봤습니다. 이번에는 **Angular**를 다룹니다. Angular는 세 프레임워크 중 가장 "완전한(opinionated)" 프레임워크입니다. DI(의존성 주입) 컨테이너, RxJS 기반 반응성, Zone.js 변경 감지, TypeScript 퍼스트 설계가 특징입니다. 2023년 이후 Signals, Standalone 컴포넌트, 새 제어 흐름 문법 등을 통해 현대화가 빠르게 진행되고 있습니다.

---

## 계층형 DI 시스템

![Angular — DI 시스템과 변경 감지](/assets/posts/fw-angular-core-di.svg)

Angular의 DI는 **Injector 계층**으로 동작합니다. 서비스를 요청하면 가장 가까운 Injector에서 찾고, 없으면 상위로 올라갑니다. Root Injector에 등록된 서비스는 앱 전체에서 싱글턴으로 공유됩니다.

```typescript
// 서비스 정의
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient)   // inject() 함수 (Angular 14+)

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/users')
  }
}

// 컴포넌트 스코프 서비스 (컴포넌트마다 새 인스턴스)
@Injectable()
export class CartService { ... }

@Component({
  providers: [CartService],   // 이 컴포넌트와 자식만 공유
})
export class ShopComponent { }
```

---

## Zone.js와 변경 감지

Angular 기본 변경 감지는 **Zone.js**에 의존합니다. Zone.js는 브라우저의 비동기 API(`setTimeout`, `fetch`, `Promise`, DOM 이벤트)를 패치해서, 비동기 콜백이 완료될 때마다 Angular에 알립니다. Angular는 이를 받아 전체 컴포넌트 트리를 검사합니다.

이 방식은 단순하지만, 불필요한 검사가 많아질 수 있습니다.

### OnPush 전략

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ user.name }}</p>`,
})
export class UserCardComponent {
  @Input() user!: User   // user 객체 참조가 바뀔 때만 검사
}
```

`OnPush`를 적용하면 Angular는 다음 경우에만 이 컴포넌트를 검사합니다.
- `@Input` 참조가 변경됐을 때
- 이 컴포넌트 또는 자식에서 이벤트가 발생했을 때
- `async` 파이프로 구독한 Observable이 값을 emit했을 때
- `markForCheck()`를 명시적으로 호출했을 때

---

## Signals — Zone.js 없는 반응성 (v16+)

![Angular Signals — Zone.js 없는 반응성](/assets/posts/fw-angular-core-signals.svg)

Angular 16에서 도입된 Signals는 Vue의 `ref`/`computed`, SolidJS의 Signal과 유사합니다. Zone.js 없이 세밀한(fine-grained) 반응성을 제공합니다.

```typescript
import { signal, computed, effect, toSignal } from '@angular/core'

@Component({ ... })
export class CounterComponent {
  count = signal(0)
  doubled = computed(() => this.count() * 2)

  constructor() {
    effect(() => {
      console.log('count:', this.count())   // count를 읽으므로 자동 추적
    })
  }

  increment() { this.count.update(n => n + 1) }
  reset()     { this.count.set(0) }
}
```

Signal 값을 읽으려면 함수처럼 호출합니다(`this.count()`). 쓰려면 `.set(value)` 또는 `.update(fn)`을 씁니다. 읽기 전용 Signal이 필요하면 `.asReadonly()`를 씁니다.

---

## Standalone 컴포넌트 (v15+)

기존 NgModule 없이 컴포넌트를 독립적으로 정의합니다.

```typescript
@Component({
  standalone: true,
  selector: 'app-user-list',
  imports: [CommonModule, RouterModule, UserCardComponent],
  template: `
    @for (user of users(); track user.id) {
      <app-user-card [user]="user" />
    }
    @empty { <p>사용자가 없습니다</p> }
  `,
})
export class UserListComponent {
  private userService = inject(UserService)
  users = toSignal(this.userService.getUsers(), { initialValue: [] })
}
```

Angular 17에서는 `*ngFor` 대신 `@for`, `*ngIf` 대신 `@if` 제어 흐름 문법이 도입됐습니다.

---

## RxJS 통합

Angular은 HTTP, 폼, 라우팅 등 핵심 기능이 **Observable** 기반으로 설계됩니다.

```typescript
@Component({ ... })
export class SearchComponent implements OnDestroy {
  private destroy$ = new Subject<void>()

  searchControl = new FormControl('')
  results$: Observable<Product[]>

  constructor(private productService: ProductService) {
    this.results$ = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.productService.search(query ?? '')),
      takeUntil(this.destroy$),  // 메모리 누수 방지
    )
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.complete()
  }
}
```

`async` 파이프로 템플릿에서 직접 구독합니다.

```html
<ul>
  @for (product of results$ | async; track product.id) {
    <li>{{ product.name }}</li>
  }
</ul>
```

---

## 라우팅 — 지연 로딩

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.routes').then(m => m.adminRoutes),
    canActivate: [AuthGuard],
  },
]
```

---

## Angular 버전별 주요 변화

| 버전 | 주요 기능 |
|---|---|
| 14 | Standalone 컴포넌트, inject() 함수 |
| 15 | Standalone 기본 지원, directive composition |
| 16 | Signals (developer preview), Jest 지원 |
| 17 | 새 제어 흐름(`@if`, `@for`), Signals stable |
| 18+ | zoneless 실험적 지원, Signal-based inputs |

---

**지난 글:** [Svelte 핵심 — 컴파일러 기반 반응성과 Virtual DOM 없는 렌더링](/posts/fw-svelte-core/)

**다음 글:** [SolidJS 핵심 — 세밀한 반응성과 Virtual DOM 없는 선언적 UI](/posts/fw-solid-core/)

<br>
읽어주셔서 감사합니다. 😊
