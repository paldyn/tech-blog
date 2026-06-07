---
title: "제약 조건 완전 정리 — NOT NULL, DEFAULT, CHECK"
description: "SQL 제약 조건이 데이터 무결성을 어떻게 보장하는지, NOT NULL, DEFAULT, CHECK 제약의 동작 방식과 실전 활용 패턴을 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["SQL", "제약조건", "NOT NULL", "DEFAULT", "CHECK", "무결성"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-datetime/)에서 날짜·시간 타입을 다뤘다. 올바른 타입 선택 다음 단계는 **제약 조건(Constraint)**이다. 제약 조건은 데이터베이스 계층에서 잘못된 데이터를 원천 차단하는 메커니즘이다. 애플리케이션 코드가 우회되거나 버그를 포함해도 데이터베이스 수준에서 막힌다.

## 왜 DB 제약 조건이 필요한가

애플리케이션 코드에서 유효성 검사를 해도 다음 경로가 열려 있다.

- **직접 INSERT**: DBA가 SQL 클라이언트로 직접 데이터를 넣는 경우
- **배치 스크립트**: 유효성 검사 없는 마이그레이션 스크립트
- **여러 애플리케이션**: 같은 DB를 사용하는 다른 앱이 규칙을 모를 수 있음
- **버그**: 애플리케이션 코드의 엣지 케이스

DB 제약 조건은 "어떤 경로로 들어오든" 규칙을 강제한다.

![제약 조건의 역할 — 데이터 무결성 계층](/assets/posts/sql-constraints-not-null-default-check-overview.svg)

## NOT NULL

NULL을 허용하지 않는다. 값이 반드시 있어야 한다.

```sql
CREATE TABLE 주문 (
    주문ID    INTEGER      PRIMARY KEY,
    고객ID   VARCHAR(10)  NOT NULL,   -- 고객 없는 주문은 불가
    주문일시  TIMESTAMP    NOT NULL,   -- 주문 시각 반드시 기록
    금액     NUMERIC(12,2) NOT NULL,   -- 금액 없는 주문 불가
    메모     TEXT                     -- NULL 허용 (선택 항목)
);
```

NULL은 "값이 없음"이지 0이나 빈 문자열이 아니다. 집계 함수(`SUM`, `AVG`, `COUNT`)는 NULL을 무시한다. `WHERE 메모 = NULL`은 동작하지 않고 `WHERE 메모 IS NULL`을 써야 한다.

```sql
-- NOT NULL 컬럼에 NULL 삽입 시도 → 오류
INSERT INTO 주문 (주문ID, 고객ID, 주문일시, 금액)
VALUES (1, NULL, CURRENT_TIMESTAMP, 50000);
-- ERROR: null value in column "고객ID" violates not-null constraint
```

## DEFAULT

값을 생략했을 때 자동으로 채울 기본값이다.

```sql
CREATE TABLE 게시글 (
    글ID      INTEGER    PRIMARY KEY,
    제목      VARCHAR(200) NOT NULL,
    조회수    INTEGER    NOT NULL DEFAULT 0,             -- 숫자 기본값
    공개여부  BOOLEAN    NOT NULL DEFAULT TRUE,          -- 불리언 기본값
    상태      VARCHAR(20) NOT NULL DEFAULT '초안',       -- 문자열 기본값
    생성일시  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP  -- 함수 기본값
);

-- 조회수, 공개여부, 상태, 생성일시 생략 가능
INSERT INTO 게시글 (글ID, 제목) VALUES (1, '첫 번째 글');
-- 자동: 조회수=0, 공개여부=TRUE, 상태='초안', 생성일시=현재시각
```

`DEFAULT` 표현식에는 리터럴 값과 일부 함수(`CURRENT_TIMESTAMP`, `CURRENT_DATE`, `NOW()`)를 쓸 수 있다. 서브쿼리나 사용자 정의 함수는 DBMS마다 지원 여부가 다르다.

## CHECK

불리언 조건이 TRUE인 행만 허용한다. UNKNOWN(NULL이 포함된 비교)은 허용된다.

```sql
CREATE TABLE 상품 (
    상품ID    INTEGER      PRIMARY KEY,
    이름      VARCHAR(200) NOT NULL,
    가격      NUMERIC(12,2) NOT NULL
                CHECK (가격 > 0),                    -- 양수만
    할인율    NUMERIC(5,4) NOT NULL DEFAULT 0
                CHECK (할인율 BETWEEN 0 AND 0.5),    -- 0~50% 범위
    등급      CHAR(1)      NOT NULL
                CHECK (등급 IN ('A', 'B', 'C')),    -- 허용 값 목록
    시작일    DATE         NOT NULL,
    종료일    DATE,
    -- 테이블 수준: 두 열 간의 관계 검증
    CONSTRAINT chk_날짜순서 CHECK (종료일 IS NULL OR 종료일 > 시작일)
);
```

`CONSTRAINT 이름` 구문으로 제약에 이름을 붙이면 오류 메시지에서 어느 제약을 위반했는지 알 수 있다.

![NOT NULL · DEFAULT · CHECK 예시](/assets/posts/sql-constraints-not-null-default-check-examples.svg)

## 기존 테이블에 제약 추가

이미 데이터가 있는 테이블에 제약을 추가하면 기존 데이터를 검증한다. 위반 행이 있으면 추가가 실패한다.

```sql
-- NOT NULL 추가 (기존 NULL 행이 없어야 성공)
ALTER TABLE 고객 ALTER COLUMN 이메일 SET NOT NULL;

-- CHECK 제약 추가
ALTER TABLE 상품
    ADD CONSTRAINT chk_가격양수 CHECK (가격 > 0);

-- 기존 위반 행이 있으면 검증 없이 추가 (나중에 검증)
-- PostgreSQL 전용: NOT VALID → VALIDATE CONSTRAINT로 나중에 검증
ALTER TABLE 상품
    ADD CONSTRAINT chk_가격양수 CHECK (가격 > 0) NOT VALID;
-- 신규 INSERT/UPDATE만 즉시 검증, 기존 데이터는 별도로
ALTER TABLE 상품 VALIDATE CONSTRAINT chk_가격양수;
```

PostgreSQL의 `NOT VALID` + `VALIDATE CONSTRAINT` 패턴은 대용량 테이블에서 잠금 시간을 최소화하는 무중단 제약 추가 방법이다.

## CHECK 제약의 한계

- **참조 무결성**: 다른 테이블의 값을 참조하는 CHECK는 표준 SQL에서 불가능하다. 외래 키(FOREIGN KEY)로 처리한다.
- **트리거 기반 로직**: 복잡한 비즈니스 규칙은 CHECK 대신 트리거나 애플리케이션에서 처리한다.
- **성능**: MySQL 8.0.16 이전에는 CHECK가 파싱만 되고 실제 검증이 안 됐다. MySQL 8.0.16+, PostgreSQL, Oracle은 완전히 지원한다.

---

**지난 글:** [데이터 타입 완전 정리 — 날짜와 시간](/posts/sql-data-types-datetime/)

**다음 글:** [기본 키 설계 — 자연 키 vs 대리 키](/posts/sql-primary-key-design/)

<br>
읽어주셔서 감사합니다. 😊
