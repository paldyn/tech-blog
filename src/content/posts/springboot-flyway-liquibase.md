---
title: "Spring Boot Flyway & Liquibase — DB 마이그레이션 자동화"
description: "Spring Boot에서 데이터베이스 스키마를 버전 관리하는 방법을 다룹니다. Flyway의 네이밍 규칙부터 실행 흐름, Liquibase의 changelog 기반 관리까지 두 도구의 차이와 Spring Boot 통합 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "Flyway", "Liquibase", "DatabaseMigration", "SchemaVersionControl"]
featured: false
draft: false
---

[지난 글](/posts/springboot-multi-datasource/)에서 복수의 DataSource를 구성하는 방법을 살펴봤습니다. 여러 환경(로컬·스테이징·프로덕션)을 운영하다 보면 각 환경의 DB 스키마가 조금씩 달라지는 문제가 생깁니다. 그 해결책이 **DB 마이그레이션 도구**입니다. 스프링 부트는 Flyway와 Liquibase 두 가지를 공식 지원하며, 의존성 하나만 추가하면 앱 기동 시 자동으로 스키마를 최신 상태로 맞춥니다.

## DB 마이그레이션이 필요한 이유

코드는 Git으로 버전 관리를 하지만, DB 스키마는 보통 수동 `ALTER TABLE`로 변경합니다. 이 방식은 세 가지 문제를 낳습니다.

- 개발자마다 로컬 DB 상태가 달라 "내 PC에서는 됩니다" 상황 발생
- 배포 순서가 꼬이면 앱과 스키마 버전이 어긋남
- 어떤 순서로 어떤 DDL을 적용했는지 추적 불가

마이그레이션 도구는 스크립트를 버전 번호에 묶고, 히스토리 테이블에 실행 기록을 남깁니다. 동일한 스크립트는 한 번만 실행되므로 어느 환경에서든 재현 가능한 스키마를 보장합니다.

## Flyway 기초

### 의존성

```xml
<!-- Maven -->
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-core</artifactId>
</dependency>
<!-- MySQL 8+ 사용 시 추가 필요 -->
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-mysql</artifactId>
</dependency>
```

```gradle
// Gradle
implementation 'org.flywaydb:flyway-core'
// MySQL 8+ 사용 시
implementation 'org.flywaydb:flyway-mysql'
```

`spring-boot-starter-data-jpa`와 `flyway-core`만 있으면 Spring Boot Auto-configuration이 나머지를 처리합니다.

### 네이밍 규칙

Flyway 스크립트는 파일명이 규칙을 결정합니다.

```
V{버전}__{설명}.sql
 │        │
 │        └── 언더스코어 두 개 (__)
 └── 버전 번호: 1, 2, 1.1, 202412010 등

예) V1__create_users.sql
    V2__add_email_column.sql
    V3__create_orders.sql
```

기본 경로는 `src/main/resources/db/migration/`입니다. 이 경로는 `spring.flyway.locations`로 변경할 수 있습니다.

### 실행 흐름

![Flyway 마이그레이션 실행 흐름](/assets/posts/springboot-flyway-liquibase-flow.svg)

앱이 기동되면 Flyway가 `flyway_schema_history` 테이블을 확인합니다. 테이블이 없으면 생성하고, 스크립트 디렉터리를 스캔해 아직 적용되지 않은 스크립트를 번호 순서대로 실행합니다. 실행 성공 시 `success=true`로 기록하며, 체크섬이 달라진 스크립트가 있으면 `FlywayException`을 던지고 기동을 중단합니다.

이 동작이 프로덕션 안전망이 됩니다. 스크립트 오류가 있으면 앱 자체가 뜨지 않으므로 잘못된 스키마로 서비스가 운영되는 상황을 방지합니다.

### 기본 설정

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true   # 기존 DB에 처음 적용 시 기준점 생성
    validate-on-migrate: true   # 체크섬 검증 (기본값 true)
    out-of-order: false         # 순서 역전 스크립트 허용 여부
    placeholders:
      schema: myapp
```

`baseline-on-migrate: true`는 이미 운영 중인 DB에 Flyway를 처음 도입할 때 필수입니다. V1부터 시작하는 히스토리 베이스라인을 설정해 기존 테이블과 충돌을 방지합니다.

### 실용 스크립트 예시

```sql
-- V1__create_users.sql
CREATE TABLE users (
    id      BIGINT PRIMARY KEY AUTO_INCREMENT,
    email   VARCHAR(255) NOT NULL UNIQUE,
    name    VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- V2__add_role_column.sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER';

-- V3__create_orders.sql
CREATE TABLE orders (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id    BIGINT NOT NULL,
    total      DECIMAL(10,2) NOT NULL,
    status     VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
);
```

`INSERT`·`UPDATE` 같은 DML도 마이그레이션 스크립트에 넣을 수 있습니다. 초기 코드 테이블 값이나 기존 데이터 정제 작업에 활용합니다.

### 반복 스크립트 (Repeatable Migration)

버전 없이 `R__` 접두사를 사용하면 체크섬이 바뀔 때마다 재실행됩니다. 뷰·프로시저처럼 자주 교체하는 객체에 적합합니다.

```
R__create_views.sql          ← 변경될 때마다 재실행
R__insert_code_data.sql      ← 코드 테이블 초기화
```

## Liquibase 기초

Liquibase는 XML·YAML·JSON·SQL 등 다양한 형식의 **changelog** 파일로 변경을 기술합니다.

### 의존성

```xml
<dependency>
  <groupId>org.liquibase</groupId>
  <artifactId>liquibase-core</artifactId>
</dependency>
```

### Changelog 작성 (XML)

```xml
<!-- db/changelog/db.changelog-master.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
    http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.20.xsd">

  <changeSet id="1" author="dev">
    <createTable tableName="users">
      <column name="id" type="BIGINT" autoIncrement="true">
        <constraints primaryKey="true"/>
      </column>
      <column name="email" type="VARCHAR(255)">
        <constraints nullable="false" unique="true"/>
      </column>
    </createTable>
  </changeSet>

  <changeSet id="2" author="dev">
    <addColumn tableName="users">
      <column name="role" type="VARCHAR(20)"
              defaultValue="USER">
        <constraints nullable="false"/>
      </column>
    </addColumn>
    <rollback>
      <dropColumn tableName="users" columnName="role"/>
    </rollback>
  </changeSet>

</databaseChangeLog>
```

`<rollback>` 태그가 Flyway와 다른 결정적 차이입니다. `rollback` 명령어 하나로 changeSet을 역순으로 되돌릴 수 있습니다.

### YAML Changelog (가독성 중시)

```yaml
# db/changelog/001-create-users.yaml
databaseChangeLog:
  - changeSet:
      id: 1
      author: dev
      changes:
        - createTable:
            tableName: users
            columns:
              - column:
                  name: id
                  type: BIGINT
                  autoIncrement: true
                  constraints:
                    primaryKey: true
              - column:
                  name: email
                  type: VARCHAR(255)
                  constraints:
                    nullable: false
                    unique: true
```

### 설정

```yaml
spring:
  liquibase:
    change-log: classpath:db/changelog/db.changelog-master.xml
    enabled: true
    contexts: dev    # 특정 context의 changeSet만 실행
    default-schema: myapp
```

## Flyway vs Liquibase 비교

![Flyway vs Liquibase 핵심 비교](/assets/posts/springboot-flyway-liquibase-compare.svg)

두 도구 모두 Spring Boot Auto-configuration으로 설정이 거의 없어도 동작합니다. **단순함과 SQL 친화성**을 원한다면 Flyway, **XML/YAML 기반 추상화와 자동 롤백**이 필요하다면 Liquibase를 선택합니다. 대부분의 스프링 부트 프로젝트에서는 Flyway가 기본 선택지입니다.

## 프로덕션 운영 팁

이미 서비스 중인 DB에 Flyway를 도입하는 절차입니다.

```bash
# 1. 현재 스키마를 V1__baseline.sql에 dump
mysqldump --no-data mydb > src/main/resources/db/migration/V1__baseline.sql

# 2. application.yml에 baseline 설정
# spring.flyway.baseline-on-migrate: true
# spring.flyway.baseline-version: 1

# 3. 이후 모든 스키마 변경은 V2__, V3__ 스크립트로 관리
```

**절대 하면 안 되는 것**: 적용된 마이그레이션 파일의 내용 수정. 체크섬이 달라져 다음 기동 시 `FlywayException: Detected failed migration`이 발생합니다. 수정이 필요하면 새 버전 스크립트를 추가합니다.

## 테스트 환경 설정

```yaml
# src/test/resources/application-test.yml
spring:
  flyway:
    locations:
      - classpath:db/migration
      - classpath:db/testdata   # 테스트용 DML 스크립트 별도 관리
  datasource:
    url: jdbc:h2:mem:testdb;MODE=MySQL
```

테스트용 INSERT 스크립트는 `R__test_data.sql`(반복 실행형)로 관리하면 매 테스트마다 고정 데이터를 보장할 수 있습니다.

---

**지난 글:** [Spring Boot 멀티 DataSource — 읽기/쓰기 분리부터 AbstractRoutingDataSource까지](/posts/springboot-multi-datasource/)

**다음 글:** [Spring Boot H2 콘솔 — 인메모리 DB로 빠른 개발 환경 구성](/posts/springboot-h2-console/)

<br>
읽어주셔서 감사합니다. 😊
