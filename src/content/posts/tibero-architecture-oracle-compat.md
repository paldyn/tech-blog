---
title: "Tibero RDBMS 아키텍처와 Oracle 호환성"
description: "국산 RDBMS Tibero의 내부 아키텍처(프로세스·메모리·스토리지)와 Oracle 호환성 수준을 비교하며, 공공기관 전환 사례와 핵심 차이점을 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["Tibero", "RDBMS", "Oracle호환", "국산DB", "아키텍처", "TmaxData"]
featured: false
draft: false
---

[지난 글](/posts/sqlite-limitations/)에서 SQLite의 한계를 살펴봤다. 이번 글부터는 국내 환경에서 중요한 위치를 차지하는 RDBMS들을 살펴본다. 그 첫 주제는 **Tibero**다. TmaxData가 개발한 Tibero는 Oracle 호환성을 최우선 설계 목표로 삼아 공공기관과 금융권에서 Oracle 대체제로 광범위하게 채택된 국산 RDBMS다.

## Tibero란

Tibero는 2000년대 초반부터 TmaxSoft(현 TmaxData)가 개발해온 상용 RDBMS다. 설계 철학은 명확하다. "Oracle 환경에서 운영 중인 시스템을 최소한의 변경으로 Tibero로 이전한다." 실제로 Tibero는 Oracle의 SQL 문법, PL/SQL과 유사한 PSM(tbPSM), 동일한 데이터 타입(NUMBER, VARCHAR2, DATE, CLOB), 비슷한 딕셔너리 뷰(DBA_TABLES, V$SESSION 등)를 제공한다.

국내에서는 공공기관 소프트웨어 자립화 정책, 오라클 라이선스 비용 절감 수요와 맞물려 행정안전부·국방부·대형 은행 등 수백 개 기관이 Tibero로 전환했다.

## 아키텍처 개요

Tibero의 아키텍처는 Oracle과 매우 유사하다. 크게 **클라이언트 계층 → 인스턴스(프로세스+메모리) → 스토리지** 세 계층으로 나뉜다.

![Tibero RDBMS 아키텍처](/assets/posts/tibero-architecture-overview.svg)

### 프로세스 구조

Oracle의 백그라운드 프로세스에 대응하는 Tibero 프로세스들이 있다.

| Tibero 프로세스 | Oracle 대응 | 역할 |
|---|---|---|
| WTHR (Worker Thread) | Shared Server | SQL 파싱·실행 |
| AGNT (Agent) | Listener + Dispatcher | 클라이언트 연결 수락 |
| DBWR (DB Writer) | DBWR | dirty buffer를 데이터 파일에 기록 |
| LGWR (Log Writer) | LGWR | 리두 로그 버퍼를 로그 파일에 기록 |
| CKPT (Checkpoint) | CKPT | 체크포인트 SCN 갱신 |
| RCVR (Recoverer) | SMON | 인스턴스 복구 |

Tibero는 Oracle의 프로세스 기반 모델 대신 **스레드 기반 아키텍처**를 채택해 컨텍스트 스위칭 비용을 줄였다. 하나의 프로세스 안에서 여러 WTHR이 동시 요청을 처리한다.

### 메모리 구조

Tibero의 메모리는 Oracle SGA/PGA에 해당하는 구조를 가진다.

- **DB Buffer Cache**: 데이터 파일 블록의 캐시. LRU 알고리즘으로 관리
- **SQL Query Cache**: 파싱된 쿼리 플랜 재사용 (Oracle의 Shared Pool 상당)
- **Redo Log Buffer**: LGWR가 디스크에 내리기 전 리두 레코드를 임시 보관
- **개인 메모리(PGA 상당)**: 정렬·해시 조인 등 세션별 연산 공간

### 스토리지 구조

Oracle과 동일한 논리 단위: `Database → Tablespace → Segment → Extent → Block`

```sql
-- Tibero tablespace 생성 (Oracle 문법과 동일)
CREATE TABLESPACE app_data
  DATAFILE '/tibero/data/app_data01.dbf' SIZE 1G
  AUTOEXTEND ON NEXT 256M MAXSIZE 10G
  EXTENT MANAGEMENT LOCAL UNIFORM SIZE 1M;
```

## Oracle 호환성 상세

![Tibero vs Oracle 호환성 비교](/assets/posts/tibero-oracle-compat.svg)

### SQL 문법 호환

표준 SQL은 물론 Oracle 전용 문법도 대부분 지원한다.

```sql
-- Oracle 전용 ROWNUM (Tibero에서 동일하게 동작)
SELECT * FROM employees
WHERE ROWNUM <= 10
ORDER BY hire_date;

-- CONNECT BY 계층 쿼리 (Oracle 비표준 → Tibero 지원)
SELECT LEVEL, employee_id, manager_id, name
FROM   employees
START WITH manager_id IS NULL
CONNECT BY PRIOR employee_id = manager_id;

-- DECODE (Oracle 전용 함수 → Tibero 지원)
SELECT DECODE(status, 'A', '활성', 'I', '비활성', '알수없음') AS status_label
FROM   users;
```

### tbPSM (PL/SQL 호환)

Tibero는 자체 절차형 언어 **tbPSM**을 제공한다. Oracle PL/SQL 문법과 거의 동일하다.

```sql
-- Oracle PL/SQL 코드를 Tibero tbPSM에서 거의 그대로 실행
CREATE OR REPLACE PROCEDURE update_salary(
    p_emp_id  IN NUMBER,
    p_rate    IN NUMBER
) AS
    v_current NUMBER;
BEGIN
    SELECT salary INTO v_current
    FROM   employees
    WHERE  employee_id = p_emp_id;

    UPDATE employees
    SET    salary = v_current * (1 + p_rate / 100)
    WHERE  employee_id = p_emp_id;

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20001, '사원 없음: ' || p_emp_id);
END;
/
```

### 딕셔너리 뷰 호환

Oracle의 DBA_*, ALL_*, USER_* 뷰와 V$ 동적 뷰를 Tibero에서도 동일하게 쿼리할 수 있다.

```sql
-- Oracle DBA 뷰와 동일한 이름으로 쿼리 가능
SELECT table_name, num_rows, last_analyzed
FROM   dba_tables
WHERE  owner = 'APP_USER'
ORDER BY num_rows DESC;

-- V$SESSION으로 현재 세션 확인
SELECT sid, serial#, username, status, sql_id
FROM   v$session
WHERE  username IS NOT NULL;
```

## Oracle과의 차이점

호환성이 높지만 완전히 동일하지는 않다.

- **RAC 대신 TAC**: Oracle RAC(Real Application Clusters) 대신 Tibero 고유의 **TAC(Tibero Active Cluster)** 를 사용한다. 개념은 유사하지만 내부 캐시 동기화 프로토콜이 다르다.
- **일부 힌트 미지원**: Oracle 전용 힌트 중 일부(예: `RESULT_CACHE`, 특정 병렬 힌트)는 Tibero에서 무시되거나 에러가 발생할 수 있다.
- **고급 기능 제한**: Oracle Database Vault, Label Security 같은 고도화된 보안 기능은 Tibero에서 제공하지 않거나 대안이 다르다.
- **패키지 차이**: DBMS_SCHEDULER, DBMS_CRYPTO 등 Oracle 내장 패키지 중 일부는 Tibero에서 동작 방식이 달라 이전 시 수동 검증이 필요하다.

## 마이그레이션 고려사항

Oracle에서 Tibero로 전환할 때 검증해야 할 포인트다.

```sql
-- 이전 전 호환성 점검: Oracle 전용 함수 사용 여부 확인
-- (DBA_SOURCE를 조회해 DBMS_* 패키지 사용 목록 추출)
SELECT name, type, line, text
FROM   dba_source
WHERE  text LIKE '%DBMS_%'
   AND owner = 'APP_SCHEMA'
ORDER BY name, line;
```

1. **SQL 스크립트 검증**: Oracle 전용 문법 사용 목록 추출 후 Tibero 실행 테스트
2. **PL/SQL 패키지 호환성**: tbPSM에서 오류 없이 컴파일되는지 확인
3. **성능 벤치마크**: 핵심 쿼리의 실행 계획 및 응답 시간 비교
4. **JDBC/ODBC 드라이버 교체**: Oracle 드라이버 → Tibero 전용 드라이버로 교체

---

**다음 글:** [Tibero Active Cluster(TAC) 구조](/posts/tibero-tac-cluster/)

<br>
읽어주셔서 감사합니다. 😊
