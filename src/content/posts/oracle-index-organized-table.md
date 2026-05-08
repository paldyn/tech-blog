---
title: "Oracle Index-Organized Table (IOT)"
description: "데이터를 B-Tree 리프 노드에 직접 저장하는 IOT의 구조, 생성 방법, OVERFLOW 세그먼트, 보조 인덱스, 그리고 적합한 사용 시나리오를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["oracle", "iot", "index-organized-table", "organization-index", "urowid", "overflow", "secondary-index", "heap-table"]
featured: false
draft: false
---

[지난 글](/posts/oracle-function-based-index/)에서 표현식을 키로 저장하는 Function-Based Index를 다뤘다. 이번에는 테이블 자체가 B-Tree 구조로 저장되는 **Index-Organized Table(IOT)**을 살펴본다.

## Heap 테이블 vs. IOT

일반 **힙 테이블**에서 PK로 행을 조회하면 두 단계를 거친다.

1. PK 인덱스 B-Tree를 탐색해 **ROWID** 획득
2. ROWID로 힙 세그먼트의 데이터 블록에 **재방문**

IOT는 이 구조를 바꾼다. B-Tree의 **리프 노드가 곧 데이터 행**이다. ROWID 포인터가 필요 없고, 인덱스 탐색이 끝나는 시점에 데이터를 바로 반환한다. PK 기준으로 행이 **물리적으로 정렬**되어 저장되므로 범위 스캔(Range Scan)도 순차 I/O로 처리된다.

![IOT 개념 및 Heap 테이블 비교](/assets/posts/oracle-iot-concept.svg)

---

## 생성 문법

IOT는 `ORGANIZATION INDEX` 절을 추가하고, **반드시 PK가 정의**되어야 한다.

```sql
CREATE TABLE postal_codes (
    zip_code CHAR(5)        NOT NULL,
    city     VARCHAR2(100)  NOT NULL,
    region   VARCHAR2(50),
    CONSTRAINT pk_zip PRIMARY KEY (zip_code)
)
ORGANIZATION INDEX
PCTTHRESHOLD 20          -- 행이 블록의 20%를 초과하면 overflow
OVERFLOW TABLESPACE users;
```

`PCTTHRESHOLD`와 `OVERFLOW`는 행 폭이 블록 크기보다 커질 때 **넘치는 컬럼 값을 별도 세그먼트**에 저장하도록 지시한다. PK 컬럼과 지정 임계치 이내의 컬럼은 B-Tree 리프에 그대로 유지되고, 나머지 컬럼만 OVERFLOW 세그먼트로 내보낸다.

---

## OVERFLOW 세그먼트

행이 넓으면 B-Tree 리프 노드에 모든 컬럼을 저장하기 어렵다. Oracle은 이를 자동으로 분리한다.

| 저장 위치 | 내용 |
|-----------|------|
| IOT B-Tree 리프 | PK + PCTTHRESHOLD 이내 컬럼 |
| OVERFLOW 세그먼트 | 초과 컬럼 (별도 블록) |

OVERFLOW가 존재하면 PK로 조회할 때 특정 컬럼이 OVERFLOW에 있으면 추가 블록 접근이 발생한다. 따라서 **자주 조회되는 컬럼이 PCTTHRESHOLD 이내**에 들어오도록 컬럼 순서를 설계해야 한다.

```sql
-- OVERFLOW 포함 여부 확인
SELECT table_name, iot_type, overflow
FROM   user_tables
WHERE  table_name = 'POSTAL_CODES';

-- IOT 전용 통계: 행 크기 분포
SELECT blocks, empty_blocks, avg_row_len
FROM   user_tables
WHERE  table_name = 'POSTAL_CODES';
```

---

## 보조 인덱스 (Secondary Index)

IOT에는 PK 이외의 컬럼에 대해 **보조 인덱스**를 추가로 생성할 수 있다.

```sql
-- city 컬럼 보조 인덱스
CREATE INDEX idx_postal_city ON postal_codes (city);
```

힙 테이블의 인덱스는 물리적 `ROWID`를 저장하지만, IOT 보조 인덱스는 **UROWID(논리 ROWID)**를 저장한다. UROWID는 해당 행의 PK 값으로 구성된다. 보조 인덱스로 city를 찾으면 UROWID에서 PK를 추출하고, 다시 IOT B-Tree를 탐색해 전체 행을 반환한다. 이 때문에 보조 인덱스를 통한 조회는 PK 직접 조회보다 한 단계 더 필요하다.

![IOT 생성·조회·보조 인덱스](/assets/posts/oracle-iot-sql.svg)

---

## 적합한 사용 시나리오

IOT는 모든 테이블에 어울리지 않는다.

**적합**:
- 우편번호, 국가 코드, 상태 코드 같은 **소형 참조 테이블**
- PK 범위 스캔이 주 접근 패턴인 **이력·로그 테이블** (시간 기준 PK)
- 행 폭이 좁고 PK 비중이 높아 OVERFLOW가 거의 발생하지 않는 경우

**부적합**:
- PK 외 여러 컬럼으로 빈번하게 검색하는 테이블
- 광범위한 UPDATE — 행 크기가 커지면 Row Migration이 발생해 성능이 역전
- LOB 컬럼을 포함하는 대형 행
- FK로 다수 자식 테이블의 참조를 받는 마스터 테이블

---

## 힙 테이블로 전환

IOT를 힙 테이블로 전환하려면 `DBMS_REDEFINITION`을 사용해야 한다. `ALTER TABLE ... MOVE`만으로는 구조 자체를 변환할 수 없다.

```sql
-- 온라인 테이블 재정의 (서비스 중단 없이)
EXEC DBMS_REDEFINITION.START_REDEF_TABLE(
    uname    => 'HR',
    orig_table  => 'POSTAL_CODES',
    int_table   => 'POSTAL_CODES_HEAP'   -- 사전에 힙으로 생성
);
EXEC DBMS_REDEFINITION.FINISH_REDEF_TABLE('HR', 'POSTAL_CODES', 'POSTAL_CODES_HEAP');
```

IOT 도입 전에 **접근 패턴을 충분히 검토**해야 후에 구조 변환 작업이 필요 없다.

---

**지난 글:** [Oracle Function-Based Index (FBI)](/posts/oracle-function-based-index/)

**다음 글:** [Oracle RBO vs. CBO](/posts/oracle-rbo-vs-cbo/)

<br>
읽어주셔서 감사합니다. 😊
