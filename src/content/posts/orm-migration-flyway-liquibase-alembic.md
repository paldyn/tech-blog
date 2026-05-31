---
title: "Flyway · Liquibase · Alembic — DB 마이그레이션 도구"
description: "스키마 변경 이력을 코드로 관리하는 DB 마이그레이션의 개념을 이해하고, Java 생태계의 Flyway·Liquibase와 Python 생태계의 Alembic을 버전 관리 방식·롤백 전략·CI/CD 통합 측면에서 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["마이그레이션", "Flyway", "Liquibase", "Alembic", "DevOps", "스키마 관리"]
featured: false
draft: false
---

[지난 글](/posts/orm-n-plus-one-tracing/)에서 ORM의 N+1 문제를 살펴봤습니다. ORM을 올바르게 사용하려면 스키마 변경을 안전하게 관리하는 것도 중요합니다. **DB 마이그레이션 도구**는 "어떤 환경에서든 DB 스키마가 코드와 같은 버전"임을 보장합니다. 개발자가 개인 노트북에서 실행하든, 스테이징 서버에서 실행하든, 프로덕션에 배포하든 동일한 스키마 상태를 만듭니다.

## 마이그레이션 도구가 필요한 이유

초기에는 DBA가 직접 `ALTER TABLE`을 실행하거나 SQL 스크립트를 공유 폴더에 올려두는 방식을 많이 씁니다. 이 방법은 몇 가지 치명적인 문제가 있습니다.

- 스크립트가 이미 적용되었는지 확인할 방법이 없습니다.
- 환경마다(개발/스테이징/프로덕션) 스키마가 조금씩 달라집니다.
- 어떤 순서로 적용해야 하는지 알기 어렵습니다.
- 롤백 방법이 문서화되지 않습니다.

마이그레이션 도구는 이 문제를 해결합니다. **스키마 변경 이력을 코드로 관리**하고, 현재 적용 상태를 DB에 기록합니다.

![DB 마이그레이션 워크플로우와 도구 비교](/assets/posts/orm-migration-flyway-liquibase-alembic-flow.svg)

## Flyway — SQL 파일 기반 단순함

Flyway는 가장 단순한 철학을 가집니다. 마이그레이션 파일을 SQL 파일로 작성하고, 파일명으로 실행 순서를 결정합니다.

```sql
-- db/migration/V1__create_users.sql
CREATE TABLE users (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- db/migration/V2__add_phone.sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- db/migration/V3__add_email_index.sql
CREATE INDEX idx_users_email ON users(email);
```

Flyway는 `flyway_schema_history` 테이블에 각 마이그레이션의 파일명, 체크섬, 실행 시각을 기록합니다. 이미 적용된 파일의 내용을 수정하면 체크섬이 달라져 오류가 발생합니다.

Spring Boot에서는 `spring-boot-starter-data-jpa`와 함께 사용하면 애플리케이션 시작 시 자동으로 pending 마이그레이션을 적용합니다.

```yaml
# application.yml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
```

## Liquibase — XML/YAML 멀티 DB 지원

Liquibase는 Flyway보다 기능이 더 많습니다. SQL뿐만 아니라 XML, YAML, JSON으로 변경 사항을 표현할 수 있고, 각 changeset에 **rollback 정의**를 추가할 수 있습니다.

```yaml
# changelog.yaml
databaseChangeLog:
  - changeSet:
      id: add-phone-column
      author: developer
      changes:
        - addColumn:
            tableName: users
            columns:
              - column:
                  name: phone
                  type: varchar(20)
      rollback:
        - dropColumn:
            tableName: users
            columnName: phone
```

XML 방식은 DB 종류와 독립적인 추상화를 제공합니다. `addColumn`을 쓰면 MySQL, PostgreSQL, Oracle 각각에 맞는 SQL을 Liquibase가 생성합니다. 엔터프라이즈 환경에서 여러 DB를 지원해야 할 때 유리합니다.

## Alembic — Python 코드 기반 마이그레이션

Alembic은 SQLAlchemy와 함께 사용하는 Python 마이그레이션 도구입니다. 마이그레이션이 Python 함수로 작성되므로, 복잡한 데이터 변환 로직도 코드로 표현할 수 있습니다.

```bash
# 마이그레이션 자동 생성 (모델 변경 감지)
alembic revision --autogenerate -m "add_phone_column"

# 모든 pending 마이그레이션 적용
alembic upgrade head

# 이전 버전으로 롤백
alembic downgrade -1

# 특정 revision으로 이동
alembic upgrade a3f8c91
```

`--autogenerate` 옵션은 현재 모델과 DB 스키마를 비교해 차이점을 자동으로 감지합니다. 생성된 파일을 직접 편집해 데이터 마이그레이션 로직을 추가할 수 있습니다.

```python
# alembic/versions/a3f8c91_add_phone.py
def upgrade():
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))
    # 기존 데이터 변환
    op.execute("UPDATE users SET phone = '010-0000-0000' WHERE phone IS NULL")

def downgrade():
    op.drop_column('users', 'phone')
```

![버전 히스토리 추적 방식 비교](/assets/posts/orm-migration-flyway-liquibase-alembic-versioning.svg)

## 주요 차이점 비교

| 항목 | Flyway | Liquibase | Alembic |
|---|---|---|---|
| 파일 형식 | SQL (주) | XML/YAML/SQL | Python |
| 롤백 지원 | ✗ (수동 작성) | ✓ (자동) | △ (수동 작성) |
| Autogenerate | ✗ | ✗ | ✓ (SQLAlchemy) |
| Spring 통합 | ✓ 공식 | ✓ 공식 | N/A |
| 복잡한 데이터 변환 | SQL로 작성 | changeset | Python 코드 |
| 적합한 생태계 | Java/Spring | 엔터프라이즈 | Python/FastAPI |

## CI/CD 파이프라인 통합

마이그레이션은 배포 파이프라인에 통합해야 합니다. 일반적인 패턴은 다음과 같습니다.

```bash
# GitHub Actions 예시
steps:
  - name: Run Flyway migrations
    run: |
      flyway -url=${{ secrets.DB_URL }} \
             -user=${{ secrets.DB_USER }} \
             -password=${{ secrets.DB_PASS }} \
             migrate
  - name: Deploy application
    run: kubectl rollout restart deployment/app
```

중요한 원칙은 **마이그레이션이 애플리케이션 배포보다 먼저 실행**되어야 한다는 점입니다. 이를 통해 애플리케이션이 시작될 때 이미 스키마가 준비된 상태를 보장합니다. 다음 글부터는 실전 SQL 패턴 시리즈로 넘어가 페이지네이션 구현 전략을 살펴봅니다.

---

**지난 글:** [N+1 문제 — 추적, 원인, 해결](/posts/orm-n-plus-one-tracing/)

**다음 글:** [커서 vs 오프셋 — 페이지네이션 전략](/posts/pattern-pagination-cursor-vs-offset/)

<br>
읽어주셔서 감사합니다. 😊
