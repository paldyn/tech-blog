---
title: "SQL Server 행 수준 보안 · Always Encrypted — 데이터 접근 제어"
description: "SQL Server RLS(Row-Level Security)로 테넌트 행 격리를 구현하는 방법과 Always Encrypted로 민감 컬럼을 DB 엔진도 볼 수 없게 암호화하는 구성과 제약을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "RLS", "AlwaysEncrypted", "보안", "멀티테넌트", "GDPR"]
featured: false
draft: false
---

[지난 글](/posts/mssql-partitioning-sliding-window/)에서 대용량 데이터 관리를 위한 파티셔닝을 다뤘다. 이번에는 데이터 **보안** 으로 넘어간다. SQL Server는 행 수준 접근 제어(RLS)와 열 수준 암호화(Always Encrypted) 두 가지 보안 메커니즘을 제공한다.

## 행 수준 보안 (RLS)

RLS는 SQL Server 2016에 도입됐다. 보안 정책 함수를 통해 각 사용자가 테이블의 어떤 행을 볼 수 있는지 투명하게 제한한다. 애플리케이션 코드에 WHERE 조건을 추가하지 않아도 DB 레벨에서 자동으로 필터가 삽입된다.

![RLS와 Always Encrypted 비교](/assets/posts/mssql-rls-always-encrypted-overview.svg)

### RLS 구현: 멀티 테넌트 격리

SaaS 애플리케이션에서 테넌트별 데이터를 같은 테이블에 저장하고 각 테넌트는 자신의 행만 볼 수 있어야 하는 시나리오에 RLS가 탁월하다.

![RLS 구현 — 멀티 테넌트 행 격리](/assets/posts/mssql-rls-always-encrypted-rls-impl.svg)

```sql
-- 연결 시 테넌트 컨텍스트 설정 (앱 로그인 후)
EXEC sp_set_session_context N'TenantID', @UserTenantID;

-- 이후 SELECT * FROM Orders 실행 시 자동으로 테넌트 필터 적용
-- 앱 코드 변경 없이 격리 달성
```

RLS에는 두 종류의 술어가 있다.

- **FILTER PREDICATE**: SELECT·UPDATE·DELETE에서 반환되는 행을 제한한다. 사용자가 없는 행에 UPDATE를 시도해도 아무 행도 없는 것처럼 동작한다.
- **BLOCK PREDICATE**: INSERT·UPDATE·DELETE에서 정책에 맞지 않는 변경을 차단하고 오류를 반환한다.

```sql
-- 쓰기 차단 술어 추가 (자신의 TenantID 행만 INSERT 가능)
CREATE SECURITY POLICY TenantPolicy
  ADD FILTER PREDICATE Security.fn_TenantFilter(TenantID) ON dbo.Orders,
  ADD BLOCK  PREDICATE Security.fn_TenantFilter(TenantID) ON dbo.Orders AFTER INSERT
  WITH (STATE = ON);
```

### RLS 주의사항

`db_owner`·`sysadmin` 권한을 가진 계정은 RLS 정책을 우회한다. DBA가 직접 테이블을 조회하면 모든 행이 보인다. 또한 복잡한 술어 함수는 쿼리마다 호출되어 성능에 영향을 줄 수 있다. 술어 함수에 필요한 인덱스가 있는지 반드시 확인한다.

## Always Encrypted

Always Encrypted는 SQL Server 2016에 도입됐다. 데이터 암호화·복호화가 클라이언트 드라이버에서 이루어져 SQL Server 엔진(DBA 포함)은 평문을 절대 볼 수 없다. 클라우드 환경에서 관리형 DB 서비스를 사용하면서도 클라우드 공급자가 데이터를 열람하지 못하게 막는 데 특히 유용하다.

### 암호화 유형

**결정적 암호화(Deterministic)**: 같은 값은 항상 같은 암호문을 생성한다. 등치 조건(`WHERE SSN = @ssn`)이나 인덱스가 필요한 컬럼에 적합하다. 빈도 분석 공격에 취약할 수 있다.

**무작위 암호화(Randomized)**: 같은 값도 매번 다른 암호문을 생성한다. 더 안전하지만 등치 조건·인덱스·GROUP BY 사용 불가. SQL Server 2019의 보안 Enclave를 사용하면 제한이 완화된다.

```sql
-- Always Encrypted 컬럼을 포함한 테이블 생성
CREATE TABLE Patients (
  PatientID   INT            PRIMARY KEY,
  Name        NVARCHAR(100)  NOT NULL,
  SSN         NVARCHAR(11)   COLLATE Latin1_General_BIN2
                             ENCRYPTED WITH (
                               COLUMN_ENCRYPTION_KEY = CEK_Patients,
                               ENCRYPTION_TYPE       = DETERMINISTIC,
                               ALGORITHM             = 'AEAD_AES_256_CBC_HMAC_SHA_256')
                             NOT NULL,
  Diagnosis   NVARCHAR(500)  ENCRYPTED WITH (
                               COLUMN_ENCRYPTION_KEY = CEK_Patients,
                               ENCRYPTION_TYPE       = RANDOMIZED,
                               ALGORITHM             = 'AEAD_AES_256_CBC_HMAC_SHA_256')
);

-- 클라이언트에서 (Column Encryption Setting=Enabled 연결 문자열)
-- INSERT · SELECT 시 드라이버가 자동 암호화/복호화
-- SSMS에서도 "Column Encryption Setting=Enabled" 옵션 필요
```

### Always Encrypted 제약

- 암호화 컬럼에 대한 LIKE·BETWEEN·ORDER BY·GROUP BY 불가 (Randomized)
- 집계 함수 불가
- 암호화 컬럼끼리의 JOIN 제한
- SQL Server Enclave(2019+, VBS Enclave)를 사용하면 일부 제약 완화

### 키 관리

**CMK(Column Master Key)**: 클라이언트가 보유하는 최상위 키. Azure Key Vault, Windows 인증서 저장소, HSM에 저장한다.  
**CEK(Column Encryption Key)**: 실제 데이터 암호화에 사용하는 대칭 키. CMK로 암호화된 형태로만 SQL Server에 저장된다.

## RLS와 Always Encrypted의 조합

두 기능은 서로 다른 레이어를 보호한다. RLS는 "누가 어떤 행을 볼 수 있는가"를 제어하고, Always Encrypted는 "볼 수 있더라도 민감 컬럼은 읽을 수 없다"를 보장한다. 규정 준수가 엄격한 환경에서는 두 기능을 조합해 이중 보호를 구성할 수 있다.

## 정리

RLS는 멀티 테넌트 SaaS나 부서별 데이터 격리처럼 "같은 DB, 다른 시야"가 필요할 때 코드 변경 없이 투명하게 적용할 수 있는 강력한 도구다. Always Encrypted는 DBA·클라우드 관리자조차 열람할 수 없는 수준의 민감 데이터 보호가 필요할 때 적용한다. 두 기능의 제약을 이해하고 적절한 시나리오에 선택적으로 사용하는 것이 핵심이다.

---

**지난 글:** [SQL Server 파티셔닝 — Sliding Window 패턴](/posts/mssql-partitioning-sliding-window/)

**다음 글:** [SQL Server SSIS — ETL 파이프라인 설계와 데이터 통합](/posts/mssql-ssis-etl/)

<br>
읽어주셔서 감사합니다. 😊
