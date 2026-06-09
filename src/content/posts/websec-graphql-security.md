---
title: "GraphQL 보안: 인트로스펙션·깊이 제한·배치 공격·인가 취약점 방어"
description: "GraphQL 고유 보안 위협(인트로스펙션 남용·깊이 공격·배치 공격·필드 제안), 필드 수준 인가(graphql-shield), 페르시스티드 쿼리, DataLoader N+1 방어를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "Security"
tags: ["GraphQL", "인트로스펙션", "깊이제한", "배치공격", "graphql-shield", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-bola-bfla/)에서 BOLA/BFLA를 해부했다. GraphQL은 REST와 달리 단일 엔드포인트에서 모든 데이터를 유연하게 쿼리할 수 있어 개발 생산성이 높지만, 이 유연성이 새로운 보안 위협을 만들어낸다. REST API 보안 기법을 그대로 적용하면 안 되는 이유가 있다.

## GraphQL의 구조적 특성과 보안 도전

REST는 엔드포인트마다 고정된 응답 구조가 있다. `/api/users`는 항상 같은 필드를 반환한다. GraphQL은 클라이언트가 **필요한 필드를 직접 지정**한다. 이는 Over-fetching을 줄이지만, 공격자도 어떤 필드가 있는지 탐색하고 권한 없는 데이터를 요청할 수 있다는 뜻이기도 하다.

![GraphQL 고유 보안 위협](/assets/posts/websec-graphql-threats.svg)

## 인트로스펙션 비활성화

GraphQL 스키마 자동 탐색(`__schema`, `__type` 쿼리)은 개발 단계에서는 유용하지만, 프로덕션에서는 API 전체 구조를 공격자에게 제공한다.

```javascript
// Apollo Server v4: 프로덕션에서 인트로스펙션 비활성화
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
  // 필드 제안도 비활성화
  hideSchemaDetailsFromClientErrors: process.env.NODE_ENV === 'production',
});
```

단, 인트로스펙션을 꺼도 실제 쿼리를 시도하면서 오류 메시지로 스키마를 추측하는 방법이 있어, **필드 수준 인가**가 더 중요한 방어선이다.

## 쿼리 깊이 및 복잡도 제한

재귀적 중첩 쿼리로 DB를 폭주시키는 공격을 막으려면 깊이와 복잡도 제한이 필요하다.

```javascript
// graphql-depth-limit + graphql-validation-complexity
import depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(5),               // 중첩 5레벨 제한
    createComplexityLimitRule(1000, {  // 복잡도 점수 1000 제한
      onCost: (cost) => console.log('Query cost:', cost),
    }),
  ],
});
```

각 필드에 복잡도 가중치를 부여하면 더 정밀하게 제어할 수 있다. 연결(Connection)을 반환하는 필드는 반환 개수만큼 비용을 부과한다.

## 배치 및 별칭 공격 방어

GraphQL 배치 요청(단일 요청에 여러 작업)과 별칭(alias)을 이용하면 Rate Limit을 단일 IP 기준으로만 제한해도 우회할 수 있다.

```graphql
# 단일 요청으로 100개의 로그인 시도
mutation {
  a: login(email: "a@a.com", password: "pass1") { token }
  b: login(email: "b@b.com", password: "pass2") { token }
  # ... 100개
}
```

```javascript
// 해결 1: 뮤테이션 별칭 수 제한
const countAliasesRule = (context) => ({
  Document(node) {
    const aliases = node.definitions
      .flatMap(d => d.selectionSet?.selections || [])
      .filter(s => s.alias);
    if (aliases.length > 10) {
      context.reportError(new GraphQLError('Too many aliases'));
    }
  }
});

// 해결 2: 페르시스티드 쿼리 (승인된 쿼리만 허용)
// 빌드 타임에 허용 쿼리 해시 목록 생성 → 런타임에 해시만 전송
```

## 필드 수준 인가

![GraphQL 필드 수준 인가 모델](/assets/posts/websec-graphql-auth-model.svg)

REST의 엔드포인트 수준 권한 체크와 달리, GraphQL은 **각 필드마다 독립적인 권한 확인**이 필요하다. `graphql-shield`는 이를 선언적으로 구현한다.

```javascript
// graphql-shield (Node.js)
import { shield, rule, and, or } from 'graphql-shield';

const isAuthenticated = rule()(async (parent, args, ctx) => {
  return ctx.user !== null;
});

const isAdmin = rule()(async (parent, args, ctx) => {
  return ctx.user?.role === 'admin';
});

const isOwner = rule()(async (parent, args, ctx) => {
  return parent.userId === ctx.user?.id;
});

export const permissions = shield({
  Query: {
    users: isAdmin,
    me: isAuthenticated,
  },
  User: {
    email: or(isOwner, isAdmin),   // 자신 또는 관리자만
    internalNotes: isAdmin,         // 관리자만
    passwordHash: rule()(() => false), // 항상 거부
  },
  Mutation: {
    updateUser: and(isAuthenticated, isOwner),
    deleteUser: isAdmin,
  },
});
```

## N+1 문제와 DataLoader

DataLoader는 성능뿐 아니라 보안 측면에서도 중요하다. 요청당 DB 쿼리 횟수를 제한하면 자원 고갈 공격에 대한 자연스러운 방어선이 된다.

```javascript
// DataLoader로 N+1 방지 + 쿼리 배치
import DataLoader from 'dataloader';

const userLoader = new DataLoader(async (userIds) => {
  const users = await User.findAll({ where: { id: userIds } });
  // 요청 당 단일 쿼리로 배치 처리
  return userIds.map(id => users.find(u => u.id === id));
});

// 리졸버에서 loader 사용
const resolvers = {
  Order: {
    user: (order, _, { loaders }) =>
      loaders.userLoader.load(order.userId),
  },
};
```

GraphQL 보안의 핵심은 유연성을 제한하는 것이다 — 허용할 쿼리 패턴, 깊이, 복잡도, 필드 접근을 명시적으로 정의하고, 나머지는 거부하는 화이트리스트 방식이 가장 안전하다.

---

**지난 글:** [BOLA와 BFLA 심층 분석: 객체·기능 수준 권한 실패 완전 해부](/posts/websec-bola-bfla/)

**다음 글:** [API Rate Limiting: 토큰 버킷·슬라이딩 윈도우·분산 환경 구현](/posts/websec-api-rate-limiting/)

<br>
읽어주셔서 감사합니다. 😊
