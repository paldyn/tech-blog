---
title: "PgBouncer — PostgreSQL 커넥션 풀링"
description: "PostgreSQL은 연결마다 새 프로세스를 생성합니다. PgBouncer가 커넥션을 풀링해 이 오버헤드를 줄이는 원리, 세 가지 풀링 모드(Session/Transaction/Statement)의 차이, pgbouncer.ini 핵심 설정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["postgresql", "pgbouncer", "connection-pool", "커넥션풀", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/pg-pgbackrest-barman/)에서 PostgreSQL 백업 솔루션을 비교했습니다. 이번에는 운영 환경에서 또 다른 병목이 되는 **커넥션 관리** 문제를 다룹니다. PostgreSQL은 연결마다 별도 프로세스를 생성하는 **프로세스 per 연결** 모델을 사용합니다. 수백 개의 동시 연결은 수백 개의 프로세스를 의미하고, 이는 메모리와 CPU 컨텍스트 스위칭 비용을 폭발적으로 증가시킵니다.

## 왜 커넥션 풀링이 필요한가?

![PgBouncer 커넥션 풀링 아키텍처](/assets/posts/pg-pgbouncer-arch.svg)

PostgreSQL 프로세스 하나는 약 5~10MB의 메모리를 사용합니다. 200개 연결이면 약 1~2GB가 연결 프로세스만으로 소비됩니다. PgBouncer는 클라이언트 연결을 대신 받아 소수의 서버 연결을 재사용합니다. 200개 클라이언트 연결을 20개 서버 연결로 처리하면 PostgreSQL 프로세스가 90% 줄어듭니다.

## 세 가지 풀링 모드

| 모드 | 연결 해제 시점 | 효율 | 제한 |
|------|---------------|------|------|
| Session Pool | 클라이언트 연결 종료 시 | 낮음 | 없음 |
| Transaction Pool | 트랜잭션 커밋/롤백 시 | **높음 (권장)** | SET, LISTEN 제한 |
| Statement Pool | 쿼리 완료 시 | 최고 | 트랜잭션 사용 불가 |

**Transaction Pool**이 대부분의 웹 애플리케이션에 최적입니다. 웹 요청 하나가 보통 트랜잭션 단위로 처리되므로, 요청이 끝나면 서버 연결이 즉시 풀로 반환됩니다.

## 설정

![pgbouncer.ini 핵심 설정](/assets/posts/pg-pgbouncer-config.svg)

```ini
[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb

[pgbouncer]
listen_port         = 6432
pool_mode           = transaction
max_client_conn     = 1000
default_pool_size   = 20
min_pool_size       = 5
server_idle_timeout = 600
auth_type           = scram-sha-256
```

애플리케이션은 PostgreSQL 5432 대신 **PgBouncer 6432**로 연결합니다. PgBouncer가 내부에서 실제 PostgreSQL에 연결하므로 애플리케이션 코드 변경이 거의 없습니다.

## 주요 운영 명령어

```bash
# 연결 풀 상태 확인 (psql로 pgbouncer에 접속)
psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer

SHOW POOLS;     -- 풀별 연결 수, 대기 수 확인
SHOW STATS;     -- 초당 쿼리 수, 바이트 수
SHOW CLIENTS;   -- 클라이언트 연결 목록
SHOW SERVERS;   -- 서버 연결 목록

-- 설정 파일 리로드 (재시작 없이)
RELOAD;
```

`SHOW POOLS`에서 `cl_waiting`(대기 중인 클라이언트 수)이 지속적으로 0보다 크다면 `default_pool_size`를 늘려야 합니다.

## Transaction Pool 주의사항

Transaction Pool 모드에서는 트랜잭션 사이에 연결이 바뀔 수 있으므로, 다음은 사용할 수 없습니다.

```sql
-- 사용 불가: 트랜잭션 간 상태 유지 필요
SET search_path = myschema;  -- 세션 상태
LISTEN channel_name;          -- 세션 연결 유지 필요

-- 해결책: 연결 문자열에 search_path 지정
-- postgresql://...?options=-csearch_path=myschema
```

Prepared Statement도 주의가 필요합니다. PgBouncer 1.21+부터 `max_prepared_statements` 옵션으로 일부 지원하지만, 완전한 호환은 아닙니다.

## Odyssey: 대안 커넥션 풀러

Yandex가 개발한 **Odyssey**는 PgBouncer와 유사하지만 멀티스레드 구조로 더 높은 동시성을 처리합니다. PgBouncer가 단일 스레드라 CPU 1코어만 사용하는 반면, Odyssey는 여러 코어를 활용합니다. 매우 높은 연결 수(수천 개 이상)에서는 Odyssey를 검토합니다.

---

**지난 글:** [pgBackRest와 Barman — PostgreSQL 백업 솔루션](/posts/pg-pgbackrest-barman/)

**다음 글:** [postgresql.conf 핵심 파라미터 튜닝 가이드](/posts/pg-postgresql-conf/)

<br>
읽어주셔서 감사합니다. 😊
