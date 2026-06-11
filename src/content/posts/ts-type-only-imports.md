---
title: "타입 전용 import/export — import type 완전 정복"
description: "import type과 인라인 type 한정자가 왜 필요한지 컴파일 결과로 확인합니다. 타입 제거(erasure)의 원리, isolatedModules와의 관계, 순환 참조 해소 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "import-type", "export-type", "isolatedModules", "타입제거", "순환참조"]
featured: false
draft: false
---

[지난 글](/posts/ts-module-resolution-node16/)에서 nodenext 전략이 import 경로를 얼마나 엄격하게 다루는지 봤다. 이번 주제는 경로가 아니라 import 구문 자체다. `import type { User }`와 그냥 `import { User }`는 타입 검사 결과만 보면 차이가 없다. 그런데 왜 굳이 `type` 키워드가 존재하고, 린트 규칙은 왜 이것을 강제할까? 답은 컴파일러가 아니라 **esbuild, SWC 같은 파일 단위 트랜스파일러**에 있다.

## 타입은 컴파일하면 사라진다

TypeScript의 대원칙은 타입 제거(type erasure)다. 타입 주석, 인터페이스, 타입 별칭은 컴파일 결과물에서 흔적 없이 사라진다. import도 마찬가지다 — 타입으로만 쓰인 import는 출력에서 제거된다.

```typescript
// app.ts
import { api } from "./api.js";        // 값으로 사용 → 유지
import type { User } from "./types.js"; // 타입으로만 사용 → 제거

const u: User = api.getUser();
```

```javascript
// app.js (컴파일 결과)
import { api } from "./api.js";

const u = api.getUser();
```

`./types.js`를 가리키는 import 라인이 통째로 사라졌다. 즉 런타임에 `types.js` 파일은 **로드조차 되지 않는다.** 사이드 이펙트도 없고, 번들 크기에도 영향이 없다.

![import type이 컴파일 후 제거되는 과정](/assets/posts/ts-type-only-imports-erasure.svg)

## 문제 — type 키워드 없이도 되는 것 아닌가?

사실 `tsc`는 `type` 키워드가 없어도 알아서 처리한다. `import { User }`라고 써도 `User`가 타입으로만 쓰였다면 import를 제거한다(elision). 그렇다면 왜 명시적 구문이 필요할까?

`tsc`는 프로그램 전체를 분석하므로 "이 식별자가 타입인지 값인지"를 안다. 하지만 esbuild나 SWC 같은 트랜스파일러는 **파일 하나만 보고** 변환한다. 다른 파일을 열어보지 않으면 `User`가 인터페이스인지 클래스인지 알 방법이 없고, 따라서 import를 지워야 할지 남겨야 할지 결정할 수 없다.

```typescript
// 트랜스파일러의 시점에서 이 한 줄만 보면:
import { User } from "./models.js";
// User는 지워야 할 인터페이스인가, 남겨야 할 클래스인가? — 알 수 없음
```

이 모호함을 구문 수준에서 제거하는 것이 `import type`이다. `type` 키워드가 붙어 있으면 다른 파일을 보지 않고도 "지워도 된다"고 확신할 수 있다. `tsconfig`의 `isolatedModules: true`가 이런 파일 단위 변환 호환성을 검사하는 옵션이며, Vite 같은 도구는 이를 사실상 전제로 동작한다.

## 세 가지 형태

타입 전용 구문은 세 가지 형태로 쓴다.

```typescript
// 1. 구문 전체가 타입 전용 (TS 3.8+)
import type { User, Role } from "./models.js";

// 2. 인라인 type 한정자 — 값과 타입을 한 줄에 (TS 4.5+)
import { api, type User, type Role } from "./mod.js";

// 3. 타입만 재내보내기
export type { User } from "./models.js";
```

![import type, 인라인 type, export type 세 가지 형태](/assets/posts/ts-type-only-imports-forms.svg)

인라인 형태는 같은 모듈에서 값과 타입을 함께 가져올 때 import 문이 두 줄로 늘어나는 것을 막아준다. `export type`은 배럴(barrel) 파일에서 특히 중요하다 — 타입만 재수출하는데 `export { User } from ...`이라고 쓰면 파일 단위 변환기는 런타임 재수출 코드를 남길 수밖에 없고, 실제로는 존재하지 않는 바인딩이라 런타임 에러로 이어질 수 있다.

한 가지 제약도 기억하자. `import type`으로 가져온 이름은 값 위치에서 쓸 수 없다.

```typescript
import type { UserService } from "./service.js";

let svc: UserService;          // ✅ 타입 위치 — OK
svc = new UserService();       // ❌ 값으로 사용 불가
```

클래스를 `new`로 인스턴스화하거나 `extends` 해야 한다면 일반 import를 써야 한다. 타입으로서의 클래스(인스턴스 형태)만 필요하다면 `import type`으로 충분하다.

## 실전 활용 — 순환 참조 끊기

타입 전용 import의 숨은 강점은 **모듈 순환 참조 해소**다. 두 모듈이 서로의 타입만 참조하는 경우, 일반 import를 쓰면 런타임 순환 로드가 발생해 초기화 순서에 따라 `undefined`를 만날 수 있다. 하지만 양쪽 모두 `import type`이라면 컴파일 후 import 자체가 사라지므로 순환이 존재하지 않는다.

```typescript
// order.ts
import type { Customer } from "./customer.js";
export interface Order { buyer: Customer; total: number; }

// customer.ts
import type { Order } from "./order.js";
export interface Customer { name: string; orders: Order[]; }

// 타입 수준에서는 순환이지만 런타임에는 어떤 의존도 없다
```

## 일관성은 도구로 강제하기

어디에 `type`을 붙일지 매번 고민할 필요는 없다. 컴파일러 옵션과 린트 규칙으로 자동화하는 것이 표준 관행이다.

```jsonc
// tsconfig.json — 타입으로만 쓰는 import에 type 표기를 강제
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

ESLint를 쓴다면 `@typescript-eslint/consistent-type-imports` 규칙이 자동 수정까지 해 준다. 그런데 방금 등장한 `verbatimModuleSyntax`는 단순한 검사 옵션이 아니라 TypeScript의 모듈 출력 철학을 바꾼 옵션이다 — 다음 글에서 이 옵션 하나를 깊이 파헤친다.

---

**지난 글:** [Node16/NodeNext 모듈 해석 — ESM 시대의 규칙](/posts/ts-module-resolution-node16/)

**다음 글:** [verbatimModuleSyntax — 모듈 구문을 쓴 그대로](/posts/ts-verbatim-module-syntax/)

<br>
읽어주셔서 감사합니다. 😊
