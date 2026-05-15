---
title: "NLS와 한국어 환경 설정"
description: "Oracle NLS(National Language Support)의 문자 집합 계층 구조, AL32UTF8과 KO16MSWIN949의 차이, 한국어 정렬·비교 설정, 그리고 VARCHAR2(N CHAR) vs BYTE 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["oracle", "nls", "charset", "al32utf8", "ko16mswin949", "korean", "nls_lang", "varchar2", "lengthb", "unicode"]
featured: false
draft: false
---

[지난 글](/posts/oracle-stats-tuning-advisor/)에서 옵티마이저 통계와 SQL 튜닝 어드바이저를 다뤘다. 이번에는 한국어 서비스를 운영하는 DBA·개발자가 반드시 이해해야 할 **NLS(National Language Support)** 설정을 살펴본다.

## NLS란

Oracle NLS는 다국어 데이터를 저장·정렬·표시하기 위한 언어·문자·날짜·숫자 형식 설정의 집합이다. 잘못 설정하면 한글이 물음표(`?`)나 깨진 문자로 저장되거나, 날짜 연산이 예상과 다르게 동작하는 버그가 발생한다.

## 문자 집합 계층

NLS 설정에는 DB, 세션, 클라이언트의 세 계층이 있다.

**DB 문자 집합(NLS_CHARACTERSET)**: DB 생성 시 결정되며 이후 변경이 사실상 불가능하다. 한국어를 포함한 다국어를 사용한다면 **AL32UTF8(Unicode UTF-8)**을 강력히 권장한다. 레거시 시스템에서는 KO16MSWIN949(EUC-KR 계열)나 KO16KSC5601이 남아 있다.

**국가 문자 집합(NLS_NCHAR_CHARACTERSET)**: `NCHAR`, `NVARCHAR2`, `NCLOB` 타입 전용. AL16UTF16 또는 UTF8만 선택 가능하다.

**세션/클라이언트 NLS**: `ALTER SESSION`이나 `NLS_LANG` 환경변수로 개별 세션 단위로 재정의할 수 있다.

![Oracle NLS 문자 집합 계층](/assets/posts/oracle-nls-korean-charset.svg)

## AL32UTF8 vs KO16MSWIN949

| 항목 | AL32UTF8 | KO16MSWIN949 |
|---|---|---|
| 인코딩 | UTF-8 가변 바이트 | EUC-KR 확장(CP949) 2바이트 |
| 한글 1자 | 3 바이트 | 2 바이트 |
| 이모지·특수문자 | 완전 지원 | 지원 안 됨 |
| VARCHAR2(100) | 100 바이트 = 약 33한글 | 100 바이트 = 50한글 |
| 글로벌 서비스 | 권장 | 한국어 전용 시스템만 |

AL32UTF8에서 한글은 3바이트이므로 컬럼 크기를 **BYTE가 아닌 CHAR 단위**로 선언하는 것이 안전하다.

```sql
-- BYTE 단위 (기본값): 한글이 3바이트이므로 실제로 33자만 저장됨
name VARCHAR2(100)          -- = VARCHAR2(100 BYTE)

-- CHAR 단위: 100 문자 보장 (한글·영문·숫자 구분 없이 100자)
name VARCHAR2(100 CHAR)

-- DB 기본 단위를 CHAR로 설정 (신규 시스템 권장)
ALTER SYSTEM SET nls_length_semantics = CHAR SCOPE = SPFILE;
```

## 한글 바이트·글자 수 확인

```sql
-- 한글 1자의 바이트 크기 확인
SELECT
  LENGTHB('가나다') AS byte_length,   -- AL32UTF8: 9
  LENGTH('가나다')  AS char_length    -- 3
FROM dual;

-- 문자 집합 확인
SELECT value FROM nls_database_parameters
WHERE  parameter = 'NLS_CHARACTERSET';

-- 세션별 NLS 파라미터 전체 조회
SELECT * FROM nls_session_parameters ORDER BY parameter;
```

## NLS_LANG 환경변수

JDBC/ODBC/SQL*Plus 클라이언트는 `NLS_LANG` 환경변수로 자신의 문자 집합을 DB에 알린다. **클라이언트와 DB 문자 집합이 다르면 Oracle이 자동 변환을 시도**하는데, 지원 불가 문자가 있으면 `?`로 치환된다.

```bash
# Linux 클라이언트 — UTF-8로 접속
export NLS_LANG=KOREAN_KOREA.AL32UTF8

# Windows 클라이언트 — CP949로 접속
set NLS_LANG=KOREAN_KOREA.KO16MSWIN949
```

JDBC URL에서는 `useUnicode=true&characterEncoding=UTF-8`를 명시하고, Oracle JDBC thin 드라이버는 자체적으로 UTF-8을 처리하므로 `NLS_LANG`을 별도로 설정하지 않아도 된다.

![한국어 NLS 실무 SQL](/assets/posts/oracle-nls-korean-sql.svg)

## 한국어 정렬과 비교

기본 정렬은 바이트 값 기준(Binary)이라 한글이 사전 순서와 다를 수 있다. 한국어 사전 순 정렬이 필요하면 `NLS_SORT`와 `NLS_COMP`를 변경한다.

```sql
-- 세션 단위 한국어 사전 정렬 활성화
ALTER SESSION SET nls_sort = KOREAN;
ALTER SESSION SET nls_comp = LINGUISTIC;

-- 이후 = , LIKE, ORDER BY 모두 언어 기준 적용
SELECT name FROM employees ORDER BY name;

-- 초성 검색 (KO16MSWIN949 DB에서만 동작)
SELECT * FROM products WHERE name LIKE '가%';
```

`NLS_COMP = LINGUISTIC`을 설정하면 인덱스가 `NLSSORT()` 함수 기반 인덱스로 재구성되어야 정렬 인덱스를 탈 수 있다. 성능에 주의하자.

## 날짜 형식 한국화

```sql
-- 날짜 형식 변경
ALTER SESSION SET nls_date_format     = 'YYYY년 MM월 DD일';
ALTER SESSION SET nls_timestamp_format = 'YYYY-MM-DD HH24:MI:SS.FF3';

-- 이후 TO_CHAR(SYSDATE) 결과: 2026년 05월 11일
SELECT TO_CHAR(SYSDATE) FROM dual;

-- 언어별 월 이름
ALTER SESSION SET nls_date_language = KOREAN;
SELECT TO_CHAR(SYSDATE, 'Month') FROM dual;  -- 5월
```

## 문자 집합 마이그레이션

KO16MSWIN949에서 AL32UTF8로의 마이그레이션은 **DMU(Database Migration Assistant for Unicode)**를 사용하는 것이 공식 방법이다. 단순 Export/Import도 가능하지만 데이터 크기가 늘어나고(2→3바이트) VARCHAR2 컬럼 크기 초과 문제가 발생할 수 있어 사전 점검이 필수다.

## 정리

한국어 Oracle 환경의 핵심은 세 가지다. 첫째, 신규 시스템은 AL32UTF8을 사용한다. 둘째, VARCHAR2 컬럼은 `CHAR` 단위로 선언한다. 셋째, 클라이언트 `NLS_LANG`과 DB 문자 집합을 일치시키거나 Oracle이 자동 변환을 지원하도록 구성한다.

---

**지난 글:** [통계 정보와 SQL 튜닝 어드바이저](/posts/oracle-stats-tuning-advisor/)

**다음 글:** [멀티테넌트 — CDB와 PDB](/posts/oracle-multitenant-pdb-cdb/)

<br>
읽어주셔서 감사합니다. 😊
