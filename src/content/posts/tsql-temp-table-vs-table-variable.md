---
title: "T-SQL 임시 테이블 vs 테이블 변수 — 언제 무엇을 쓸까"
description: "SQL Server의 #임시 테이블과 @테이블 변수를 범위, 통계, 인덱스, 트랜잭션 측면에서 비교하고 상황별 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "TSQL", "임시테이블", "테이블변수", "tempdb", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/tsql-sequence-identity/)에서 IDENTITY와 SEQUENCE의 차이를 비교했다. 이번 주제는 T-SQL에서 자주 헷갈리는 **#임시 테이블**과 **@테이블 변수**다. 둘 다 세션 범위의 임시 저장 공간이지만, 작동 방식이 달라 잘못 선택하면 쿼리 성능이 크게 나빠진다.

## 임시 테이블 (#temp)

`#`으로 시작하는 이름을 붙이면 **로컬 임시 테이블**이 된다. `tempdb`에 물리적으로 생성되며, 현재 세션이 살아있는 동안 유지된다. 중첩된 저장 프로시저에서도 접근할 수 있다.

```sql
-- 임시 테이블 생성 및 인덱스
CREATE TABLE #monthly_summary (
    dept_id   INT        NOT NULL,
    dept_name NVARCHAR(100),
    total_amt MONEY,
    CONSTRAINT pk_ms PRIMARY KEY (dept_id)
);

CREATE NONCLUSTERED INDEX ix_amt ON #monthly_summary (total_amt DESC);

-- 데이터 삽입
INSERT INTO #monthly_summary
SELECT d.dept_id,
       d.dept_name,
       SUM(o.amount)
FROM   departments d
JOIN   orders o ON o.dept_id = d.dept_id
GROUP  BY d.dept_id, d.dept_name;

-- 사용 후 명시 삭제 (권장)
DROP TABLE IF EXISTS #monthly_summary;
```

## 테이블 변수 (@table)

`DECLARE @변수명 TABLE (...)` 형식으로 선언한다. 배치(batch) 블록 내에서만 살아있고, GO 또는 블록 종료 시 자동으로 소멸한다. 트랜잭션 ROLLBACK의 영향을 받지 않는 것이 특징이다.

```sql
DECLARE @top_customers TABLE (
    customer_id INT,
    total_spend  MONEY,
    INDEX ix_spend (total_spend DESC)  -- 인라인 인덱스 (SQL 2014+)
);

INSERT INTO @top_customers
SELECT TOP 20 customer_id, SUM(amount)
FROM   orders
WHERE  order_date >= '2026-01-01'
GROUP  BY customer_id
ORDER  BY SUM(amount) DESC;

-- 배치 종료 시 자동 해제
```

![임시 테이블 vs 테이블 변수 비교](/assets/posts/tsql-temp-table-comparison.svg)

## 핵심 차이: 통계(Statistics)

**임시 테이블**은 실제 테이블처럼 **자동 통계**를 생성한다. 옵티마이저가 행 수를 정확히 추정해 최적 플랜을 선택할 수 있다. **테이블 변수**는 통계가 없어 옵티마이저가 항상 **1행**으로 가정한다. 실제로 수만 행이 있어도 마치 1행인 것처럼 조인 알고리즘과 인덱스를 선택하므로 성능 문제가 생긴다.

```sql
-- 테이블 변수 통계 문제를 우회하는 힌트 (2017 이전)
SELECT *
FROM   @top_customers tc
JOIN   customers c ON c.id = tc.customer_id
OPTION (RECOMPILE);   -- 실제 행수 기반으로 플랜 재컴파일

-- SQL Server 2019 이상: 지연 컴파일(Deferred Compilation)
-- 테이블 변수 첫 사용 시점에 실제 행수로 재최적화
-- 별도 힌트 없이 자동 적용 (데이터베이스 호환성 150 이상)
```

![생명주기 및 범위](/assets/posts/tsql-temp-table-scope.svg)

## 트랜잭션과 ROLLBACK

임시 테이블은 일반 테이블과 같이 로그가 기록되어 ROLLBACK 시 함께 롤백된다. 테이블 변수는 내부적으로 로그 최소화 모드로 동작해 **ROLLBACK의 영향을 받지 않는다** — 트랜잭션이 취소되어도 테이블 변수에 이미 삽입한 데이터는 남는다.

```sql
BEGIN TRANSACTION;
    INSERT INTO #tmp VALUES (1);
    INSERT INTO @tv  VALUES (1);
ROLLBACK;

-- 결과:
SELECT COUNT(*) FROM #tmp;  -- 0 (롤백됨)
SELECT COUNT(*) FROM @tv;   -- 1 (롤백 무관)
```

이 특성 덕분에 오류가 발생해도 중간 결과를 보존해야 하는 배치 로직에서 테이블 변수가 유용하다.

## 전역 임시 테이블 (##temp)

`##`로 시작하는 전역 임시 테이블은 모든 세션에서 접근 가능하다. 마지막 참조 세션이 끊기면 삭제된다. 세션 간 데이터 공유 목적으로 쓰이지만, 동시성 문제가 있어 실무에서는 드물게 사용된다.

## 선택 기준 정리

| 상황 | 추천 |
|------|------|
| 100행 이상 중간 결과 저장 | `#임시 테이블` |
| 인덱스·통계가 필요한 조인 | `#임시 테이블` |
| 10~20행 이내 간단 저장 | `@테이블 변수` |
| 프로시저 파라미터 전달(TVP) | `@테이블 변수` |
| 트랜잭션 롤백 없이 보존 필요 | `@테이블 변수` |
| SQL 2019+, 행수 불확실 | `@테이블 변수` + DB 호환성 150 |

---

**지난 글:** [T-SQL SEQUENCE와 IDENTITY — 자동 증가 키 완전 가이드](/posts/tsql-sequence-identity/)

**다음 글:** [SQL Server 격리 수준 — SNAPSHOT과 RCSI의 이해](/posts/mssql-isolation-snapshot-rcsi/)

<br>
읽어주셔서 감사합니다. 😊
