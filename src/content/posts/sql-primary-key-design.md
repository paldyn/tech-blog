---
title: "기본 키 설계 — 자연 키, 대리 키, UUID"
description: "자연 키와 대리 키의 장단점, BIGINT AUTO_INCREMENT vs UUID 선택 기준, UUIDv4의 인덱스 단편화 문제와 UUIDv7·ULID로 해결하는 방법, 복합 기본 키 설계 지침을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["SQL", "기본키", "PK", "UUID", "ULID", "대리키", "자연키", "AUTO_INCREMENT"]
featured: false
draft: false
---

[지난 글](/posts/sql-constraints-not-null-default-check/)에서 NOT NULL, DEFAULT, CHECK 제약조건을 다뤘다. 그 중 가장 중요한 제약조건은 `PRIMARY KEY`다. 기본 키(PK)는 릴레이션의 각 튜플을 고유하게 식별하는 열(또는 열의 조합)이다. 어떤 값을 PK로 쓸지는 단순해 보이지만, 잘못된 선택은 장기적으로 성능, 확장성, 보안에 심각한 영향을 미친다.

## PK의 물리적 역할

PK를 정의하면 DBMS는 자동으로 **클러스터드 인덱스(Clustered Index)**를 생성한다(MySQL InnoDB, SQL Server). PostgreSQL은 힙(Heap) 구조라 PK가 클러스터드 인덱스는 아니지만, 자동 생성된 B-Tree 인덱스를 통해 빠른 조회를 제공한다.

B-Tree 인덱스는 키 값 순서로 정렬된다. 따라서 PK의 특성이 **삽입 성능**에 직접 영향을 준다.

## 자연 키 vs 대리 키

![기본 키 전략 비교](/assets/posts/sql-primary-key-design-comparison.svg)

### 자연 키(Natural Key)

비즈니스에서 이미 고유한 의미를 가진 값을 PK로 사용한다. 주민등록번호, 사원번호, 이메일, ISBN 등이 해당한다.

자연 키의 문제는 **불변 보장이 어렵다**는 점이다. 사원번호가 조직 개편으로 바뀔 수 있고, 이메일 주소는 변경된다. PK가 변경되면 이를 참조하는 모든 FK도 연쇄적으로 갱신해야 한다. 또 자연 키에는 개인 정보가 포함되어 API URL에 노출하면 보안 문제가 생긴다.

### 대리 키(Surrogate Key)

비즈니스 의미 없이 오직 식별 목적으로 생성되는 숫자 일련번호다. `AUTO_INCREMENT` / `IDENTITY` / `SEQUENCE`가 이를 구현한다.

```sql
-- PostgreSQL: SQL 표준 방식
CREATE TABLE users (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- MySQL
CREATE TABLE users (
    id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);
```

대리 키의 장점은 **불변**, **작은 크기(4~8 byte)**, **인덱스 효율 최적**이다. 단점은 외부에 노출하면 순서가 예측 가능하다는 점이다. `/users/42`라고 노출하면 사용자가 41이나 43 번 자원도 추측할 수 있다.

## UUID

UUID(Universally Unique Identifier)는 128비트(16 byte) 식별자다. 중앙 서버 없이 각 노드에서 독립적으로 생성해도 충돌 확률이 매우 낮다. 마이크로서비스, 분산 시스템에 적합하다.

```sql
-- PostgreSQL
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(12,2) NOT NULL
);

-- 결과: id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
```

### UUIDv4의 인덱스 단편화 문제

![순차 vs 랜덤 PK 인덱스 영향](/assets/posts/sql-primary-key-design-index.svg)

UUIDv4는 완전 랜덤이라 B-Tree의 임의 위치에 삽입된다. 이는 **페이지 분할(Page Split)**을 빈번하게 일으켜 쓰기 성능을 저하시키고 인덱스를 단편화한다. 대용량 테이블에서 체감이 크다.

### UUIDv7 / ULID — 정렬 가능한 UUID

이 문제를 해결하기 위해 **시간 순서로 정렬 가능한** ID 포맷이 등장했다.

- **UUIDv7**: 앞 48비트가 Unix 타임스탬프(밀리초)여서 시간 순 정렬이 가능하다. RFC 9562(2024)로 표준화되었다.
- **ULID**: 타임스탬프 48비트 + 랜덤 80비트. Base32 인코딩으로 사람이 읽기 쉽다.

```sql
-- MySQL: uuid_to_bin(uuid, 1)으로 시간 부분 앞으로 이동
-- uuid 생성 후 첫 번째와 세 번째 섹션을 스왑 → 정렬 가능한 바이너리 저장
INSERT INTO orders VALUES (uuid_to_bin(uuid(), 1), ...);
SELECT bin_to_uuid(id, 1) FROM orders;
```

## 복합 기본 키

여러 열을 조합해 유일성을 보장하는 경우 복합 PK를 사용한다. 다대다 관계의 연결 테이블이 대표적이다.

```sql
-- 사용자-태그 다대다
CREATE TABLE user_tags (
    user_id INT NOT NULL,
    tag_id  INT NOT NULL,
    tagged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_user_tags PRIMARY KEY (user_id, tag_id),
    CONSTRAINT fk_ut_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_ut_tag  FOREIGN KEY (tag_id)  REFERENCES tags(id)
);
```

복합 PK에서 인덱스는 첫 번째 열로 범위 검색이 가능하다. `WHERE user_id = 42`는 인덱스를 탈 수 있지만 `WHERE tag_id = 5`만으로는 풀스캔이 된다. 두 번째 열 단독 조회가 빈번하다면 보조 인덱스를 추가해야 한다.

## PK 설계 결정 기준

| 상황 | 권장 PK |
|---|---|
| 단일 서버, 일반 트래픽 | `BIGINT AUTO_INCREMENT` |
| API에 ID 노출 필요, 보안 중요 | UUID (내부적으로 BIGINT, 외부 UUID 매핑) |
| 분산 시스템, 마이크로서비스 | UUIDv7 또는 ULID |
| 다대다 연결 테이블 | 복합 PK + 보조 인덱스 |
| INT로 시작했다가 오버플로우 우려 | 처음부터 BIGINT 사용 |

**보안 팁**: PK를 외부 API에 노출하는 것은 총 레코드 수와 생성 속도를 노출한다. 중요한 경우 내부 BIGINT PK와 별도의 공개용 UUID/ULID 열을 분리해 관리하면 된다.

이것으로 이번 배치의 10편을 마친다. 다음 글에서는 테이블 간 관계를 지정하는 외래 키와 참조 무결성을 깊이 다룰 것이다.

---

**지난 글:** [제약조건 완전 정복 — NOT NULL, DEFAULT, CHECK](/posts/sql-constraints-not-null-default-check/)

**다음 글:** [외래 키와 참조 무결성 — ON DELETE, ON UPDATE](/posts/sql-foreign-key-referential-integrity/)

<br>
읽어주셔서 감사합니다. 😊
