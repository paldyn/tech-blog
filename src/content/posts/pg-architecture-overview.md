---
title: "PostgreSQL 아키텍처 개요"
description: "PostgreSQL의 전체 아키텍처 — Postmaster 프로세스, Backend 프로세스 포크 모델, Shared Memory 구조, 그리고 Checkpointer·BGWriter·WAL Writer 등 핵심 백그라운드 프로세스의 역할을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["postgresql", "architecture", "postmaster", "backend-process", "shared-buffers", "wal", "bgwriter", "autovacuum", "checkpointer", "pg_stat_activity"]
featured: false
draft: false
---

[지난 글](/posts/oracle-multitenant-pdb-cdb/)에서 Oracle 멀티테넌트 아키텍처를 살펴봤다. 이제부터는 PostgreSQL 시리즈를 시작한다. PostgreSQL은 오픈소스 RDBMS 중 가장 강력한 기능 집합을 보유하며, Oracle과는 설계 철학이 크게 다르다. 첫 번째 주제는 전체 아키텍처 구조다.

## PostgreSQL의 프로세스 기반 설계

PostgreSQL은 멀티스레드가 아닌 **멀티프로세스** 아키텍처를 사용한다. 하나의 클라이언트 연결마다 서버가 독립된 OS 프로세스를 생성(fork)해 처리한다. 이는 Oracle의 Dedicated Server 모델과 유사하지만, Oracle처럼 공유 서버(Shared Server)가 없고 PgBouncer 같은 외부 커넥션 풀러에 의존한다.

이 방식의 장점은 **격리성** — 한 세션이 죽어도 다른 세션에 영향을 주지 않는다. 단점은 연결당 오버헤드가 크다는 것이다(기본 10MB 정도의 메모리 소비).

## Postmaster — 리스너 겸 감독자

**Postmaster**는 PostgreSQL의 최상위 프로세스다. TCP 포트 5432를 리슨하며, 새 클라이언트 연결 요청을 받으면 `fork()`로 **Backend Process**를 생성한다. 또한 모든 백그라운드 프로세스를 감독하고, 비정상 종료 시 재시작한다.

```bash
# Postmaster 프로세스 확인 (Linux)
ps aux | grep postgres | head -5

# PostgreSQL 시작/종료
pg_ctl start  -D /var/lib/postgresql/data
pg_ctl stop   -D /var/lib/postgresql/data -m fast
pg_ctl reload -D /var/lib/postgresql/data  # 설정 리로드
```

## Shared Memory 구조

Backend Process들이 데이터를 공유하는 영역이다.

| 구성 요소 | 역할 | 설정 파라미터 |
|---|---|---|
| **Shared Buffers** | 테이블·인덱스 페이지 캐시 | `shared_buffers` (기본 128MB, 권장 RAM의 25%) |
| **WAL Buffers** | WAL 레코드 임시 버퍼 | `wal_buffers` (기본 자동, 보통 16MB) |
| **Lock Table** | 잠금 정보 | - |
| **Proc Array** | 모든 백엔드의 트랜잭션 상태 | - |
| **CLOG** | 트랜잭션 커밋/롤백 기록 | `pg_xact/` 디렉토리 |

![PostgreSQL 아키텍처 개요](/assets/posts/pg-architecture-overview-arch.svg)

## Backend Process의 쿼리 처리

클라이언트가 SQL을 보내면 Backend Process가 다음 순서로 처리한다.

1. **Parser**: SQL → Parse Tree (문법 오류 검출)
2. **Rewriter**: 뷰 확장, 규칙(Rule) 적용
3. **Planner/Optimizer**: 실행 계획 생성 (통계 기반 CBO)
4. **Executor**: 계획대로 데이터 접근 · 반환

실행 계획은 `EXPLAIN ANALYZE`로 확인하고, `pg_stat_statements` 확장으로 누적 통계를 추적한다.

```sql
-- 현재 활성 세션 조회
SELECT pid, usename, application_name,
       state, wait_event_type, wait_event,
       query_start, query
FROM   pg_stat_activity
WHERE  state != 'idle'
ORDER  BY query_start;
```

## 주요 백그라운드 프로세스

PostgreSQL은 여러 백그라운드 프로세스가 협력해 데이터 무결성과 성능을 유지한다.

| 프로세스 | 기능 |
|---|---|
| **Checkpointer** | Shared Buffers의 더티 페이지를 주기적으로 디스크에 기록 |
| **BGWriter** | 체크포인트 사이에 더티 페이지를 선행 플러시 (I/O 분산) |
| **WAL Writer** | WAL 버퍼를 `pg_wal/` 디렉토리에 주기적으로 플러시 |
| **Autovacuum** | Dead Tuple 정리 및 통계 수집 자동화 |
| **Stats Collector** | `pg_stat_*` 뷰에 활동 통계 수집 |
| **Logger** | `postgresql.log`에 서버 로그 기록 |
| **Archiver** | WAL을 아카이브 위치에 복사 (PITR 지원) |

이들은 Postmaster의 자식 프로세스로 시작되어 전체 서버 수명 동안 실행된다.

## 디렉토리 구조 (PGDATA)

```bash
$PGDATA/
├── base/           # 데이터베이스별 디렉토리 (OID 기반)
│   └── 16384/      # 특정 DB의 테이블·인덱스 파일
├── global/         # 클러스터 전체 공유 테이블
├── pg_wal/         # WAL 세그먼트 파일 (기본 16MB씩)
├── pg_xact/        # 트랜잭션 커밋 로그 (CLOG)
├── postgresql.conf # 서버 설정
├── pg_hba.conf     # 인증 규칙
└── PG_VERSION      # 주 버전 번호
```

```sql
-- PGDATA 경로 확인
SHOW data_directory;

-- 설정 파일 경로
SHOW config_file;
SHOW hba_file;
```

![PostgreSQL 기본 관리 SQL](/assets/posts/pg-architecture-overview-sql.svg)

## Oracle과의 핵심 차이

| 항목 | PostgreSQL | Oracle |
|---|---|---|
| 프로세스 모델 | 멀티프로세스 (fork) | 멀티스레드 + 백그라운드 |
| 인스턴스 개념 | 없음 (클러스터 단위) | SGA + 프로세스 집합 |
| 커넥션 풀 | PgBouncer 등 외부 도구 | Dedicated/Shared Server |
| 통계 | pg_stat_* 뷰 | V$, DBA_HIST_* |
| 라이선스 | BSD (무료) | 상용 |

## 정리

PostgreSQL의 핵심은 **간결한 프로세스 기반 설계**다. 모든 연결이 독립적인 Backend Process로 실행되고, Shared Memory를 통해 협력한다. 다음 글에서는 프로세스 모델을 더 깊이 파고들어 각 프로세스의 메모리 구조를 살펴본다.

---

**지난 글:** [멀티테넌트 — CDB와 PDB](/posts/oracle-multitenant-pdb-cdb/)

**다음 글:** [PostgreSQL 프로세스 모델](/posts/pg-process-model/)

<br>
읽어주셔서 감사합니다. 😊
