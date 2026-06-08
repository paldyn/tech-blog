---
title: "Pick과 Omit으로 타입 조각내기"
description: "TypeScript의 Pick<T, K>와 Omit<T, K> 유틸리티 타입을 완전히 이해합니다. 화이트리스트/블랙리스트 전략 선택법, API 응답 분리, CRUD 폼 타입 파생, 컴포넌트 Props 설계까지 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "유틸리티 타입", "Pick", "Omit", "타입 설계"]
featured: false
draft: false
---

[지난 글](/posts/ts-partial-required-readonly/)에서 프로퍼티의 선택성과 불변성을 조작하는 세 유틸리티를 살펴봤습니다. 이번에는 타입에서 **원하는 프로퍼티만 선택하거나 일부를 제거**하는 `Pick<T, K>`와 `Omit<T, K>`를 깊이 파봅니다. 이 두 타입은 하나의 마스터 인터페이스를 여러 용도에 맞게 잘라내는 데 핵심적입니다.

![Pick vs Omit: 타입 조각내기](/assets/posts/ts-pick-omit-overview.svg)

## 내부 구현

```typescript
// Pick: K에 해당하는 키만 남긴다
type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// Omit: K에 해당하는 키를 제외한다
// Omit은 Pick + Exclude 조합으로 구현됨
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
```

`Pick`의 타입 파라미터 `K`는 `keyof T`를 extends해야 합니다. 즉, T에 없는 키를 Pick하면 컴파일 에러가 납니다. 반면 `Omit`의 `K`는 `keyof any`를 extends하기 때문에 T에 없는 키를 Omit해도 에러가 나지 않는다는 미묘한 차이가 있습니다.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

type A = Pick<User, "nonExistent">;  // Error: 'nonExistent'는 keyof User에 없음
type B = Omit<User, "nonExistent">;  // OK (단순히 아무것도 제거 안 함)
```

## Pick\<T, K\>: 화이트리스트 전략

`Pick`은 **남길 키를 명시**합니다. 원본 타입에서 소수의 프로퍼티만 필요할 때 적합합니다.

```typescript
interface Article {
  id: number;
  title: string;
  content: string;
  authorId: number;
  publishedAt: Date;
  viewCount: number;
  tags: string[];
}

// 목록 화면 — 내용과 통계는 불필요
type ArticleListItem = Pick<Article, "id" | "title" | "authorId" | "publishedAt">;

// 검색 결과 — 제목과 태그만
type ArticleSearchResult = Pick<Article, "id" | "title" | "tags">;
```

남길 키가 제거할 키보다 적을 때 Pick을 선택하면 코드가 더 명확하고 새 프로퍼티가 추가돼도 자동으로 제외됩니다.

## Omit\<T, K\>: 블랙리스트 전략

`Omit`은 **제거할 키를 명시**합니다. 민감 정보 숨기기, ID 자동 생성 필드 제외 등 제거 대상이 명확할 때 적합합니다.

```typescript
// 비밀번호 해시 등 민감 정보 제거
type PublicUser = Omit<User, "password" | "salt" | "resetToken">;

// DB가 자동 생성하는 필드 제외
type CreateArticle = Omit<Article, "id" | "publishedAt" | "viewCount">;

// 수정 시 id는 URL path에서, 나머지는 body에서
type UpdateArticle = Partial<Omit<Article, "id">>;
```

## Pick vs Omit: 선택 기준

| 상황 | 권장 |
|---|---|
| 원본의 2~3개 키만 필요 | `Pick` |
| 원본의 대부분이 필요하고 1~2개만 제거 | `Omit` |
| 제거할 키가 명확한 규칙(민감, 자동생성) | `Omit` |
| 허용할 키를 명시적으로 선언하고 싶다 | `Pick` |
| 새 필드 추가 시 자동 포함되길 원한다 | `Omit` |
| 새 필드 추가 시 자동 제외되길 원한다 | `Pick` |

이 선택은 타입의 **확장 방향**을 결정합니다. `Pick`을 쓰면 원본에 새 필드가 추가돼도 파생 타입에는 포함되지 않습니다. `Omit`은 반대로 새 필드를 자동 흡수합니다.

## 실전 패턴

![Pick · Omit 실전 패턴](/assets/posts/ts-pick-omit-patterns.svg)

### CRUD 타입 파생

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

// 생성: DB가 만드는 필드 제외
type CreateProduct = Omit<Product, "id" | "createdAt" | "updatedAt">;

// 수정: id 고정, 나머지 선택
type UpdateProduct = { id: string } & Partial<Omit<Product, "id" | "createdAt">>;

// 목록: 재고 수 제외
type ProductSummary = Omit<Product, "stock">;
```

### Override 패턴

특정 프로퍼티의 타입을 더 좁게 바꾸려면 `Omit` + 인터섹션을 활용합니다.

```typescript
type Override<T, U> = Omit<T, keyof U> & U;

// role을 string에서 리터럴 유니언으로 좁히기
type AdminUser = Override<User, { role: "admin" | "superadmin" }>;

// adminUser.role은 "admin" | "superadmin" — string이 아님
const admin: AdminUser = { id: 1, name: "Bob", email: "b@c.com",
  password: "hash", role: "admin" };
```

### 컴포넌트 Props 분리

React 컴포넌트에서 DOM 타입의 일부 속성을 재사용할 때도 강력합니다.

```typescript
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "disabled" | "type" | "onClick" | "className"
> & {
  label: string;
  variant?: "primary" | "secondary";
};

function Button({ label, variant = "primary", ...rest }: ButtonProps) {
  return <button className={`btn btn-${variant}`} {...rest}>{label}</button>;
}
```

## 중첩 타입 처리

`Pick`과 `Omit`은 최상위 키만 처리합니다. 중첩 객체 내부의 키는 직접 접근할 수 없습니다.

```typescript
interface Config {
  server: { host: string; port: number };
  db: { url: string; pool: number };
  auth: { secret: string };
}

// 최상위 'auth'만 제거
type PublicConfig = Omit<Config, "auth">;
// Config.server.port를 직접 제거하는 유틸리티는 없음
// → 중첩은 타입을 재정의하거나 Override 패턴 사용
```

## `keyof` 와 조합

`keyof T`를 변수에 담아 재사용하면 큰 타입에서 공통 그룹을 뽑아낼 수 있습니다.

```typescript
type SensitiveKeys = "password" | "salt" | "resetToken";
type PublicUser = Omit<User, SensitiveKeys>;
type SensitiveUser = Pick<User, SensitiveKeys>;

// 역방향으로 검증: SensitiveKeys가 실제로 User의 키인지 확인
type _Check = SensitiveKeys extends keyof User ? true : never;
```

이 패턴은 여러 파생 타입이 같은 제거 목록을 공유할 때 중앙화를 도와줍니다.

---

**지난 글:** [Partial · Required · Readonly 완전 정복](/posts/ts-partial-required-readonly/)

**다음 글:** [Record 타입 완전 정복](/posts/ts-record-type/)

<br>
읽어주셔서 감사합니다. 😊
