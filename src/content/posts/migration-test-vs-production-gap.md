---
title: "테스트는 깨끗한 DB 만 본다 — V13 부분 적용 사건"
description: "9개 ALTER TABLE 이 도중에 멈춘 자리. 통합 테스트는 다 통과했는데 운영 부팅이 막혔다. IF NOT EXISTS 한 줄로 끝났지만, 그 뒤에 남은 교훈은 더 컸다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 2
type: "record"
category: "Backend"
tags: ["flyway", "postgres", "migration", "ddl", "idempotent"]
featured: false
draft: false
---

운영자가 보내온 메시지는 단순했다. "erd-api 빼고 다 떴는데 erd-api 만
부팅 실패." 로그를 보니 V13 마이그레이션이 죽어 있었다. 통합 테스트는
다 통과했고, 로컬에서도 잘 돌았던 마이그레이션이다.

문제는 **이미 한 번 실패한 자리에서 두 번째로 죽은 것**이었다.

---

## 상황 / 배경

- Mebrix `mb-erd-api` 의 V13 마이그레이션 (`add_project_code.sql`) 은
  멀티테넌시 작업의 일부로 9개 도메인 테이블에 `project_code` 컬럼을
  추가
- 통합 테스트 (Testcontainers + 깨끗한 PG 컨테이너 + Flyway 적용) 모두
  통과 후 main 푸시
- 운영자가 git pull 후 erd-api 부팅 → V13 단계에서 실패

---

## 무엇이 문제였나

부팅 로그:

```
SQL State : 42701
Error Code: 0
Message   : ERROR: column "project_code" of relation "erd_relation" already exists
Location  : db/migration/V13__add_project_code.sql
Line      : 38
Statement : ALTER TABLE erd_relation ADD COLUMN project_code VARCHAR(100) NOT NULL DEFAULT 'mebrix'
```

V13 의 38번째 줄. 9개 ALTER TABLE 이 순차로 있는데, **erd_relation 차례
에서 "이미 컬럼이 있다"** 는 에러. 그러나 V13 자체는 처음 도는 거였다
(flyway_schema_history 에 V13 row 없음).

가능한 시나리오는 하나다 — **V13 첫 시도가 어딘가에서 실패하면서 일부
ALTER 만 commit 된 채 멈췄다**. 그 다음 시도가 이미 적용된 erd_relation
에서 충돌.

PostgreSQL 의 ALTER TABLE 은 트랜잭션 안에서 동작하니 한 트랜잭션 안의
실패는 모두 롤백되어야 정상이다. 그러면 부분 적용이 어떻게 가능했나.
정확한 원인을 추적하지는 못 했지만 가능성:

- Flyway 의 트랜잭션 처리가 statement-by-statement 모드였을 가능성
  (특정 설정에서 발생)
- 한 마이그레이션 안에 여러 ALTER 가 있을 때, 일부 성공 후 외부 요인
  (timeout, connection drop 등) 으로 다음 ALTER 시도 중 connection 끊김
- 첫 시도 로그가 사라진 상태라 root cause 까지 파지 못 함

핵심은 root cause 가 아니다. **"한 번 실패한 마이그레이션을 재실행할 수
있는가"** 가 문제였다.

![V13 부분 적용 — 9개 ALTER 중 7개가 commit 된 채 멈춘 상태](/assets/posts/migration-partial-application.svg)

---

## 통합 테스트가 잡지 못한 이유

통합 테스트는 매번 깨끗한 PG 컨테이너에서 시작한다.

```java
@SpringBootTest
@Testcontainers
public abstract class AbstractIntegrationTest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
            .withDatabaseName("erd")
            .withUsername("test")
            .withPassword("test");
    static { POSTGRES.start(); }
    ...
}
```

V1 부터 V13 까지 순서대로, 한 번씩만 도는 환경. **"이미 컬럼이 있는데
또 ADD COLUMN"** 같은 시나리오는 절대 발생하지 않는다. 모든 마이그레이션
이 한 번만 실행되고 그 결과만 검증한다.

운영 환경은 다르다. 마이그레이션이 중간에 죽으면 그 자리에서 다시
시작해야 하는데, 죽은 자리가 어디였는지 정확히 알 수도 없고 — 알아도
이미 적용된 ALTER 를 manual 로 복구하기는 위험하다.

이게 통합 테스트가 잡지 못하는 영역이다.

![통합 테스트 vs 운영 환경 — 깨끗한 DB 와 살아있는 schema 의 갭](/assets/posts/migration-test-vs-production-gap.svg)

---

## 어떻게 해결했나

V13 을 idempotent 하게 다시 썼다. 모든 ALTER ADD COLUMN 에 `IF NOT
EXISTS`, 모든 CREATE INDEX 에도 같은 절. ALTER COLUMN ... DROP DEFAULT
는 PG 에서 default 미존재 시 no-op 이라 그대로 둠.

```sql
-- 부분 적용된 컬럼은 IF NOT EXISTS 로 건너뛰고
-- 누락된 ALTER 만 마저 적용된다.

ALTER TABLE erd_project ADD COLUMN IF NOT EXISTS project_code VARCHAR(100) NOT NULL DEFAULT 'mebrix';
ALTER TABLE erd_project ALTER COLUMN project_code DROP DEFAULT;
CREATE INDEX IF NOT EXISTS idx_erd_project_project_code ON erd_project (project_code);

ALTER TABLE erd_project_member ADD COLUMN IF NOT EXISTS project_code ...;
ALTER TABLE erd_project_member ALTER COLUMN project_code DROP DEFAULT;
CREATE INDEX IF NOT EXISTS idx_erd_project_member_project_code ...;

-- (9개 테이블 모두 같은 패턴)
```

운영 가이드는 두 단계:

```sql
-- 1) flyway_schema_history 의 실패 entry 정리
DELETE FROM flyway_schema_history
 WHERE version = '13' AND success = false;
```

```bash
# 2) erd-api 재시작
git pull && ./gradlew bootRun
```

이미 적용된 컬럼은 `IF NOT EXISTS` 로 skip, 안 적용된 것만 마저 ALTER.
재실행 후 첫 번째 시도에 무사 통과.

---

## 결과

| 지표 | 사고 (V13 v1) | fix (V13 v2 idempotent) |
|---|---|---|
| 첫 부팅 결과 | 일부 ALTER 적용 후 어떤 이유로 실패 | 정상 |
| 재실행 결과 | `column already exists` 무한 실패 | 정상 (재실행 가능) |
| flyway_schema_history 의 V13 | success=false (수동 정리 필요) | success=true |
| 회복까지 운영자 작업 | 1) DELETE FROM history, 2) git pull, 3) restart | git pull, restart |

---

## 앞으로 어떻게 할 것인가

같은 멀티테넌시 작업의 다른 마이그레이션들 — `auth-api V18`,
`dict-api V5`, `dbwb-api V4` — 도 같은 위험을 가지고 있었다. 다 운 좋게
한 번에 통과했지만, 다음에 같은 사건이 그쪽에서 일어나도 이상하지 않다.

이번 사고에서 정리한 룰:

1. **여러 ALTER 가 있는 마이그레이션은 idempotent 하게 작성**
   - `ADD COLUMN IF NOT EXISTS`
   - `CREATE INDEX IF NOT EXISTS`
   - `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`
   - PK 변경처럼 IF NOT EXISTS 가 안 되는 경우는 PL/pgSQL DO 블록으로
     conditional:
     ```sql
     DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'foo' AND column_name = 'project_code') THEN
         ALTER TABLE foo ADD COLUMN project_code VARCHAR(100) NOT NULL DEFAULT 'mebrix';
         ALTER TABLE foo DROP CONSTRAINT foo_pkey;
         ALTER TABLE foo ADD PRIMARY KEY (project_code, ...);
       END IF;
     END $$;
     ```

2. **통합 테스트에 "재실행 가능한가" 시나리오 추가 검토**
   - 같은 마이그레이션을 두 번 돌려서 두 번째도 무사 통과하는지
   - Flyway repeatable migration (`R__`) 이 아닌 versioned 도 idempotent
     일수록 운영 안전성 ↑

3. **운영 마이그레이션 실패 회복 가이드를 CONTRIBUTING.md 에 명시**
   - "마이그레이션이 중간에 죽으면 어떻게 회복하는가" 절차 박제
   - flyway_schema_history 의 failed entry 정리 + 재실행 흐름

4. **로컬 컴파일 + 통합 테스트만으로는 충분하지 않다**
   - 운영 환경에서 한 번 손으로 띄워보는 검증을 PR merge 전에 (또는 직후
     첫 푸시 시점에) 해야 한다. 이번에도 그래서 잡힌 것.

---

## 회고 한 줄

> 마이그레이션은 한 번에 통과한다고 가정하면 안 된다. 운영의 schema 는
> 이미 적용된 변경 위에서 다음 변경을 받는데, 통합 테스트는 항상 깨끗한
> DB 만 본다. 그 갭을 메우는 건 idempotent 하게 쓰는 작은 습관이다.

<br>
읽어주셔서 감사합니다. 😊
