---
title: "T-SQL 핵심 문법 — SQL Server 전용 확장 완전 가이드"
description: "T-SQL의 배치 처리(GO), TOP/PERCENT, IDENTITY, 식별자 대괄호, N 접두사, 4부분 이름, 시스템 함수, 표준 SQL과의 차이점을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "TSQL", "문법", "배치처리", "IDENTITY", "TOP", "시스템함수"]
featured: false
draft: false
---

[지난 글](/posts/mssql-data-log-filegroup/)에서 SQL Server 파일 구조를 살펴봤다. 이번 글부터는 T-SQL(Transact-SQL) 문법 시리즈를 시작한다. T-SQL은 ANSI SQL 표준을 기반으로 Microsoft가 SQL Server를 위해 확장한 방언이다. 표준 SQL과 다른 T-SQL만의 특징을 이해해야 올바르고 효율적인 쿼리를 작성할 수 있다.

## 배치(Batch)와 GO

T-SQL에서 **배치(Batch)**는 한 번에 서버로 전송되고 파싱되는 SQL 문의 집합이다. `GO`는 배치의 경계를 나타내는 **클라이언트 도구(SSMS, sqlcmd)의 지시어**로, SQL Server 엔진이 직접 처리하지 않는다.

```sql
-- 배치 1
CREATE TABLE Products (
    ProductID   INT IDENTITY(1,1) PRIMARY KEY,
    ProductName NVARCHAR(100) NOT NULL,
    Price       DECIMAL(10,2)
);
GO

-- 배치 2 (Products 테이블이 배치 1에서 생성된 후에 실행)
INSERT INTO Products (ProductName, Price)
VALUES (N'노트북', 1299.99), (N'마우스', 29.99);
GO

-- GO 뒤에 숫자: 배치를 N번 반복 실행 (테스트용)
PRINT N'Hello T-SQL';
GO 3
```

`GO` 없이 `CREATE TABLE`과 해당 테이블에 대한 INSERT를 같은 배치로 보내면 파서가 테이블이 없다고 에러를 낸다.

## TOP과 PERCENT

T-SQL의 `TOP`은 ANSI SQL의 `FETCH FIRST`에 해당한다. 쿼리 결과의 앞부분을 잘라낸다.

```sql
-- 상위 10개
SELECT TOP 10 ProductID, ProductName, Price
FROM Products
ORDER BY Price DESC;

-- 전체의 5% (PERCENT)
SELECT TOP 5 PERCENT *
FROM Employees
ORDER BY HireDate;

-- WITH TIES: 동점자 포함
SELECT TOP 3 WITH TIES
    OrderID, CustomerID, Amount
FROM Orders
ORDER BY Amount DESC;
-- Amount 3위와 같은 값을 가진 행도 함께 반환

-- ORDER BY 없이 TOP: 순서 보장 안 됨 (주의!)
SELECT TOP 10 * FROM Products;  -- 임의 10개
```

![T-SQL vs 표준 SQL 비교](/assets/posts/tsql-syntax-essentials-overview.svg)

## IDENTITY와 식별자

`IDENTITY(seed, increment)`는 자동 증가 정수 컬럼을 생성한다.

```sql
-- IDENTITY 컬럼 생성
CREATE TABLE Orders (
    OrderID    INT           IDENTITY(1, 1) PRIMARY KEY,  -- 1부터 1씩 증가
    CustomerID INT           NOT NULL,
    OrderDate  datetime2(0)  NOT NULL DEFAULT GETDATE()
);

-- 마지막 IDENTITY 값 조회 (스코프 한정)
SELECT SCOPE_IDENTITY();    -- 현재 배치·SP 범위 내 마지막 IDENTITY
SELECT @@IDENTITY;          -- 현재 세션 마지막 IDENTITY (트리거 포함)
SELECT IDENT_CURRENT('Orders');  -- 테이블 기준 마지막 IDENTITY (세션 무관)

-- IDENTITY 값 수동 삽입 (일시적 허용)
SET IDENTITY_INSERT Orders ON;
INSERT INTO Orders (OrderID, CustomerID) VALUES (1000, 42);
SET IDENTITY_INSERT Orders OFF;

-- IDENTITY 시드 재설정
DBCC CHECKIDENT('Orders', RESEED, 100);  -- 다음 값이 101부터 시작
```

## 식별자 인용부호

T-SQL에서 예약어나 공백이 포함된 식별자는 **대괄호 `[]`** 또는 **쌍따옴표 `""`**로 감싼다.

```sql
-- 대괄호: T-SQL 전용 (권장)
SELECT [Order ID], [From], [Customer Name]
FROM dbo.[Order Details];

-- 쌍따옴표: ANSI_QUOTES 설정 시 사용 가능
-- (기본값은 문자열 리터럴로 처리됨)
SET QUOTED_IDENTIFIER ON;  -- 기본 ON
SELECT "Order ID" FROM "Order Details";
```

## 유니코드 문자열 — N 접두사

`nchar`, `nvarchar`에 한글, 일본어, 중국어 등 유니코드 문자를 입력하려면 문자열 앞에 `N` 접두사를 붙여야 한다.

```sql
-- N 없이 삽입하면 한글이 깨질 수 있음
INSERT INTO Customers (Name) VALUES ('홍길동');      -- 위험
INSERT INTO Customers (Name) VALUES (N'홍길동');     -- 안전

-- varchar vs nvarchar
DECLARE @v1 VARCHAR(10) = '홍길동';   -- 각 한글 2~3바이트
DECLARE @v2 NVARCHAR(10) = N'홍길동'; -- 각 한글 2바이트(UTF-16)
SELECT LEN(@v1), LEN(@v2), DATALENGTH(@v1), DATALENGTH(@v2);
-- LEN: 3, 3 / DATALENGTH: 6, 6 (환경에 따라 다를 수 있음)
```

## 4부분 이름

SQL Server는 `서버.데이터베이스.스키마.오브젝트` 형식으로 다른 서버의 객체를 직접 참조할 수 있다.

```sql
-- 2부분: 스키마.오브젝트 (같은 DB 내)
SELECT * FROM dbo.Customers;
SELECT * FROM Sales.Orders;

-- 3부분: 데이터베이스.스키마.오브젝트
SELECT * FROM AdventureWorks.dbo.Customers;
SELECT * FROM [ReportDB].dbo.ReportTable;

-- 4부분: 연결된 서버 (Linked Server) 참조
SELECT * FROM [DataWarehouse].[SalesDB].[dbo].[Customers];
```

![T-SQL 데이터 타입과 시스템 함수](/assets/posts/tsql-syntax-essentials-datatypes.svg)

## 자주 쓰는 시스템 함수

```sql
-- 메타 정보
SELECT DB_NAME();            -- 현재 데이터베이스 이름
SELECT SCHEMA_NAME();        -- 현재 기본 스키마
SELECT USER_NAME();          -- 현재 사용자
SELECT SUSER_NAME();         -- SQL Server 로그인 이름
SELECT @@SERVERNAME;         -- 서버 인스턴스 이름
SELECT @@ROWCOUNT;           -- 직전 DML 영향 행 수

-- 날짜 함수
SELECT GETDATE();            -- datetime (밀리초 정밀도)
SELECT SYSDATETIME();        -- datetime2(7) (100ns 정밀도)
SELECT GETUTCDATE();         -- UTC datetime
SELECT DATEADD(DAY, 7, GETDATE());
SELECT DATEDIFF(DAY, '2024-01-01', GETDATE());
SELECT DATEPART(WEEKDAY, GETDATE());
SELECT FORMAT(GETDATE(), 'yyyy-MM-dd', 'ko-KR');

-- 문자열 함수
SELECT LEN(N'hello');        -- 5 (문자 수)
SELECT DATALENGTH(N'hello'); -- 10 (바이트 수)
SELECT CHARINDEX('l', 'hello'); -- 3
SELECT STUFF('hello', 2, 3, 'XYZ');  -- hXYZo
SELECT STRING_AGG(name, ', ')  -- 그룹 내 문자열 집계 (SQL Server 2017+)
FROM Employees GROUP BY department;
```

## SET 옵션

T-SQL 세션 동작을 제어하는 주요 SET 옵션이다.

```sql
SET NOCOUNT ON;          -- 영향 행 수 메시지 숨김 (SP 내부 권장)
SET XACT_ABORT ON;       -- 런타임 오류 시 자동 ROLLBACK
SET ANSI_NULLS ON;       -- NULL = NULL → FALSE (ANSI 표준)
SET QUOTED_IDENTIFIER ON; -- 큰따옴표를 식별자로 처리
SET ARITHABORT ON;       -- 산술 오버플로·0 나눗셈 오류 발생

-- 현재 SET 옵션 확인
SELECT SESSIONPROPERTY('QUOTED_IDENTIFIER'),
       SESSIONPROPERTY('ANSI_NULLS');
```

다음 글에서는 T-SQL의 변수 선언, 조건문, 반복문, TRY...CATCH 오류 처리를 살펴본다.

---

**지난 글:** [SQL Server 데이터 파일·로그 파일·파일 그룹](/posts/mssql-data-log-filegroup/)

**다음 글:** [T-SQL 변수·제어흐름·TRY...CATCH](/posts/tsql-variables-control-trycatch/)

<br>
읽어주셔서 감사합니다. 😊
