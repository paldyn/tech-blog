---
title: "T-SQL 변수·제어흐름·TRY...CATCH — 절차형 프로그래밍 완전 가이드"
description: "T-SQL DECLARE 변수 선언, SET/SELECT 할당, IF/ELSE/WHILE/BREAK/CONTINUE 제어흐름, TRY...CATCH 오류 처리, THROW/RAISERROR를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "TSQL", "변수", "제어흐름", "TRYCATCH", "WHILE", "오류처리"]
featured: false
draft: false
---

[지난 글](/posts/tsql-syntax-essentials/)에서 T-SQL의 기본 문법과 표준 SQL과의 차이를 살펴봤다. 이번 글에서는 T-SQL의 절차형 프로그래밍 기능인 **변수, 제어흐름, TRY...CATCH**를 다룬다. 저장 프로시저나 배치 스크립트 작성에 반드시 필요한 내용이다.

## 변수 선언과 할당

T-SQL 변수는 `DECLARE`로 선언하고 `SET` 또는 `SELECT`로 값을 할당한다.

```sql
-- 변수 선언 (@ 접두사 필수)
DECLARE @name     NVARCHAR(100);
DECLARE @age      INT = 30;          -- 선언과 동시에 초기화
DECLARE @now      DATETIME2 = SYSDATETIME();
DECLARE @flag     BIT = 1;

-- SET으로 단일 값 할당 (권장)
SET @name = N'홍길동';
SET @age  = @age + 1;

-- SELECT로 할당 (쿼리 결과로 할당 가능)
SELECT @name = name
FROM Customers
WHERE CustomerID = 1;

-- 여러 변수 동시 할당 (SELECT 방식)
DECLARE @max_price DECIMAL(10,2), @min_price DECIMAL(10,2);
SELECT @max_price = MAX(Price), @min_price = MIN(Price)
FROM Products;

-- 변수 값 출력
PRINT N'최고가: ' + CAST(@max_price AS NVARCHAR(20));
SELECT @max_price AS max_price, @min_price AS min_price;
```

**SET vs SELECT 차이**: `SET`은 행이 없으면 변수가 NULL로 유지된다. `SELECT`는 행이 없으면 변수 값이 변경되지 않아 이전 값이 유지될 수 있다.

## IF / ELSE IF / ELSE

```sql
DECLARE @score INT = 75;

IF @score >= 90
BEGIN
    PRINT N'A등급';
END
ELSE IF @score >= 80
BEGIN
    PRINT N'B등급';
END
ELSE IF @score >= 70
BEGIN
    PRINT N'C등급';
END
ELSE
BEGIN
    PRINT N'F등급';
END;

-- 단순 조건 (BEGIN/END 생략 가능, 권장하지 않음)
IF @score >= 60 PRINT N'합격';
ELSE PRINT N'불합격';

-- EXISTS 조건 (자주 사용되는 패턴)
IF EXISTS (SELECT 1 FROM Customers WHERE Country = 'KR')
BEGIN
    PRINT N'국내 고객 존재';
END;
```

![T-SQL 제어흐름 구조](/assets/posts/tsql-variables-control-flow.svg)

## WHILE / BREAK / CONTINUE

T-SQL은 `FOR` 루프가 없다. 반복은 모두 `WHILE`로 처리한다.

```sql
-- 기본 WHILE
DECLARE @i INT = 1;
WHILE @i <= 10
BEGIN
    INSERT INTO TestLog (val) VALUES (@i);
    SET @i += 1;    -- 증감 연산자
END;

-- BREAK: 루프 즉시 탈출
DECLARE @sum INT = 0, @n INT = 1;
WHILE 1 = 1   -- 무한 루프
BEGIN
    SET @sum += @n;
    SET @n   += 1;
    IF @sum > 100 BREAK;   -- 합계가 100 초과 시 탈출
END;
SELECT @sum, @n;

-- CONTINUE: 현재 반복 건너뜀
DECLARE @k INT = 0;
WHILE @k < 20
BEGIN
    SET @k += 1;
    IF @k % 2 = 0 CONTINUE;   -- 짝수 건너뜀
    PRINT @k;                  -- 홀수만 출력
END;

-- WAITFOR: 지연 또는 특정 시각까지 대기
WAITFOR DELAY '00:00:05';      -- 5초 대기
WAITFOR TIME '09:00:00';       -- 오전 9시까지 대기
```

## TRY...CATCH 오류 처리

T-SQL의 구조적 오류 처리 메커니즘이다. SQL Server 2005+에서 지원된다.

```sql
BEGIN TRY
    BEGIN TRAN;

    UPDATE accounts SET balance = balance - 100 WHERE id = 1;
    UPDATE accounts SET balance = balance + 100 WHERE id = 2;

    COMMIT TRAN;
    PRINT N'이체 성공';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;

    -- 오류 정보 수집
    DECLARE @err_num  INT          = ERROR_NUMBER();
    DECLARE @err_msg  NVARCHAR(MAX) = ERROR_MESSAGE();
    DECLARE @err_sev  INT          = ERROR_SEVERITY();
    DECLARE @err_state INT         = ERROR_STATE();
    DECLARE @err_line INT          = ERROR_LINE();
    DECLARE @err_proc NVARCHAR(200) = ERROR_PROCEDURE();

    -- 오류 로그 기록
    INSERT INTO ErrorLog (ErrorNumber, ErrorMessage, Severity, ErrorDate)
    VALUES (@err_num, @err_msg, @err_sev, SYSDATETIME());

    -- 오류 재발생 (THROW: SQL Server 2012+)
    THROW;   -- 원본 오류 번호·메시지·상태 그대로 재발생
END CATCH;
```

![TRY...CATCH 흐름](/assets/posts/tsql-variables-trycatch.svg)

## THROW vs RAISERROR

| 항목 | THROW (SQL Server 2012+) | RAISERROR |
|---|---|---|
| 오류 번호 | 50000 이상 또는 원본 번호 | 50000 이상 사용자 정의 |
| 트랜잭션 | `XACT_ABORT` 영향 없음 | 심각도 17+ 시 트랜잭션 롤백 |
| 형식 | 단순 | printf 스타일 |
| 재발생 | 파라미터 없이 `THROW` | 불가 |

```sql
-- THROW로 사용자 정의 오류 발생
THROW 50001, N'잔액이 부족합니다.', 1;

-- THROW (재발생 — CATCH 블록 내에서)
BEGIN CATCH
    THROW;   -- 원본 오류 그대로 재발생
END CATCH;

-- RAISERROR (구식, 하지만 여전히 사용됨)
RAISERROR(N'오류 메시지: %s, 코드: %d', 16, 1, N'잔액부족', 1001);
-- 심각도 16 = 사용자 오류
-- 심각도 10 이하 = 경고 (CATCH 안 걸림)
```

## 중첩 트랜잭션과 SAVE TRAN

T-SQL은 중첩 트랜잭션을 지원하지만 `@@TRANCOUNT` 관리가 중요하다.

```sql
-- @@TRANCOUNT 관리
BEGIN TRAN;     -- @@TRANCOUNT = 1
BEGIN TRAN;     -- @@TRANCOUNT = 2 (중첩)
COMMIT;         -- @@TRANCOUNT = 1 (내부 COMMIT은 실제 커밋 안 됨)
COMMIT;         -- @@TRANCOUNT = 0 (최외부 COMMIT에서 실제 커밋)

-- ROLLBACK은 항상 최외부 트랜잭션까지 한 번에 롤백
-- 부분 롤백이 필요하면 SAVE TRAN 사용
BEGIN TRAN;
SAVE TRAN SavePoint1;
-- 일부 작업...
ROLLBACK TRAN SavePoint1;   -- SavePoint1 이후만 롤백
COMMIT TRAN;                -- SavePoint1 이전 변경사항은 커밋
```

## CURSOR — 행별 처리

집합 기반으로 처리 불가한 경우에 한해 커서를 사용한다. 성능상 집합 기반 처리가 항상 더 빠르다.

```sql
DECLARE @id INT, @name NVARCHAR(100);
DECLARE c CURSOR FAST_FORWARD FOR
    SELECT id, name FROM Customers ORDER BY id;

OPEN c;
FETCH NEXT FROM c INTO @id, @name;
WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT CAST(@id AS NVARCHAR) + N': ' + @name;
    FETCH NEXT FROM c INTO @id, @name;
END;
CLOSE c;
DEALLOCATE c;
```

`FAST_FORWARD` 커서(읽기 전용, 앞으로만 이동)가 일반 커서 대비 가장 빠르다.

다음 글에서는 T-SQL의 CTE와 APPLY 연산자를 살펴본다.

---

**지난 글:** [T-SQL 핵심 문법 — SQL Server 전용 확장 완전 가이드](/posts/tsql-syntax-essentials/)

**다음 글:** [T-SQL CTE와 APPLY 연산자](/posts/tsql-cte-apply/)

<br>
읽어주셔서 감사합니다. 😊
