---
title: "Sequelize · Prisma · TypeORM — Node.js ORM 3파전"
description: "Node.js 생태계의 대표 ORM인 Sequelize, Prisma, TypeORM의 스키마 정의 방식, 타입 안전성, 마이그레이션 전략, 성능 트레이드오프를 코드와 함께 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["ORM", "Sequelize", "Prisma", "TypeORM", "Node.js", "TypeScript"]
featured: false
draft: false
---

[지난 글](/posts/orm-querydsl-jooq/)에서 Java 진영의 타입 안전 SQL 빌더인 QueryDSL과 jOOQ를 살펴봤습니다. 이번에는 Node.js · TypeScript 생태계로 눈을 돌려 가장 많이 쓰이는 세 ORM — **Sequelize**, **Prisma**, **TypeORM** — 을 비교합니다. 세 라이브러리는 각기 다른 철학으로 "개발자가 SQL을 직접 쓰지 않아도 DB를 다룰 수 있게 하는 방법"을 구현합니다.

## Sequelize — 가장 오래된 Node ORM

Sequelize는 2011년에 등장한 Node.js 최초의 성숙한 ORM입니다. JavaScript 기반으로 설계되었기 때문에 TypeScript 지원이 나중에 추가 되었고, 타입 추론이 완전하지 않은 부분이 있습니다.

```javascript
// Sequelize 모델 정의 (JavaScript 스타일)
const { DataTypes } = require('sequelize');

const User = sequelize.define('User', {
  id:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:  { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING,      allowNull: false, unique: true },
}, { tableName: 'users', timestamps: true });

// 연관 관계
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });
```

장점은 오랜 역사만큼 풍부한 레퍼런스와 MySQL · PostgreSQL · SQLite · MSSQL을 모두 지원한다는 점입니다. 단점은 복잡한 쿼리에서 타입 추론이 `any`로 빠지는 경우가 많아 런타임 오류가 컴파일 타임에 잡히지 않는다는 점입니다.

## TypeORM — 데코레이터 기반 엔티티

TypeORM은 TypeScript-first로 설계되었으며, Java의 JPA/Hibernate와 유사한 데코레이터 방식으로 엔티티를 정의합니다. NestJS와 공식적으로 연동되어 NestJS 프로젝트에서 가장 많이 선택됩니다.

```typescript
// TypeORM Entity 정의
import { Entity, PrimaryGeneratedColumn, Column,
         OneToMany, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Order, order => order.user)
  orders: Order[];
}
```

TypeORM의 Repository 패턴은 `userRepository.findOne({ where: { id } })` 처럼 타입이 추론되지만, 복잡한 JOIN이나 집계 쿼리에서는 QueryBuilder로 전환해야 합니다. QueryBuilder는 JPA의 Criteria API와 유사하며, 체인 방식으로 SQL을 조합합니다.

![Sequelize · Prisma · TypeORM 비교표](/assets/posts/orm-sequelize-prisma-typeorm-comparison.svg)

## Prisma — 스키마 우선(Schema-First) 접근

Prisma는 세 가지 중 가장 최근에 등장했으며, 기존 ORM과 다른 철학을 가집니다. 코드에서 모델을 정의하는 대신 **`schema.prisma`라는 전용 DSL**로 스키마를 선언합니다. 그리고 `prisma generate` 명령으로 완전한 타입이 내장된 `PrismaClient`를 생성합니다.

```typescript
// Prisma 조회 — 자동 생성된 타입으로 완전한 자동완성 제공
const activeUsers = await prisma.user.findMany({
  where: { isActive: true },
  include: {
    orders: {
      where: { status: 'PAID' },
      orderBy: { createdAt: 'desc' }
    }
  },
  take: 20,
  skip: 0
});
// activeUsers 타입: (User & { orders: Order[] })[]
```

`include`로 관계를 즉시 로딩하면 반환 타입에 자동으로 `orders: Order[]`가 추가됩니다. 이 타입은 편집기에서 완전히 자동완성됩니다.

![Prisma 개발 워크플로우](/assets/posts/orm-sequelize-prisma-typeorm-workflow.svg)

## 마이그레이션 비교

세 ORM의 마이그레이션 접근 방식이 크게 다릅니다.

| | Sequelize | TypeORM | Prisma |
|---|---|---|---|
| 명령 | `sequelize-cli migration:generate` | `typeorm migration:generate` | `prisma migrate dev` |
| SQL 파일 생성 | 수동 작성 | 자동 생성 | 자동 생성 |
| diff 기반 | ✗ | △ | ✓ (스키마 diff) |
| 롤백 | 수동 down 작성 | 수동 down 작성 | 지원 제한 |

Prisma의 `prisma migrate dev`는 `schema.prisma` 변경 사항을 감지해 자동으로 SQL 마이그레이션 파일을 생성합니다. 개발 단계에서는 가장 편리하지만, 복잡한 데이터 마이그레이션(기존 데이터 변환)은 수동 SQL을 추가해야 합니다.

## Raw SQL과의 조합

세 ORM 모두 Raw SQL을 실행하는 방법을 제공합니다. ORM이 생성하는 SQL이 비효율적이거나 DB 고유 기능(윈도우 함수, CTE, LATERAL JOIN)을 써야 할 때 유용합니다.

```typescript
// Prisma — $queryRaw (파라미터 바인딩으로 SQL Injection 방지)
const result = await prisma.$queryRaw<User[]>`
  SELECT u.*, COUNT(o.id) AS order_count
  FROM   users u
  LEFT JOIN orders o ON o.user_id = u.id
  WHERE  u.created_at >= ${since}
  GROUP  BY u.id
`;

// TypeORM — QueryRunner로 직접 실행
const rows = await dataSource.query(
  `SELECT * FROM users WHERE email ILIKE $1`,
  [`%${domain}`]
);
```

## 선택 가이드

- **NestJS 프로젝트**: TypeORM (공식 통합, Repository 패턴 자연스러운 DI)
- **Next.js / tRPC / 풀스택 TypeScript**: Prisma (타입 안전성 최강, Studio GUI)
- **레거시 Express 유지보수**: Sequelize (기존 코드 호환)
- **복잡한 쿼리가 많은 경우**: Prisma `$queryRaw` 또는 jOOQ/Kysely 병행

ORM은 CRUD 작업을 빠르게 처리해 주는 강력한 도구지만, 복잡한 리포팅 쿼리나 대량 배치 처리에서는 Raw SQL로 전환하는 것이 성능과 가독성 모두에서 유리합니다. 다음 글에서는 Python 진영의 SQLAlchemy를 살펴봅니다.

---

**지난 글:** [QueryDSL·jOOQ — 타입 안전 SQL 빌더](/posts/orm-querydsl-jooq/)

**다음 글:** [SQLAlchemy — Python ORM의 표준](/posts/orm-sqlalchemy-python/)

<br>
읽어주셔서 감사합니다. 😊
