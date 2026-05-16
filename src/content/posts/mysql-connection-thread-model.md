---
title: "MySQL 커넥션과 스레드 모델 — Thread-per-Connection 구조"
description: "MySQL의 Thread-per-Connection 모델이 어떻게 동작하는지, 스레드 캐시와 max_connections의 의미, 그리고 실무에서 커넥션 풀을 어떻게 설계해야 하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 11
type: "knowledge"
category: "SQL"
tags: ["mysql", "커넥션", "스레드모델", "thread-per-connection", "커넥션풀", "max-connections"]
featured: false
draft: false
---

[지난 글](/posts/mysql-storage-engines/)에서 MySQL의 스토리지 엔진 구조와 InnoDB·MyISAM의 차이를 살펴봤습니다. 이번 글에서는 클라이언트가 MySQL 서버에 연결할 때 내부에서 무슨 일이 일어나는지를 다룹니다. PostgreSQL이 프로세스 per 연결을 사용하는 반면, MySQL은 **스레드 per 연결(Thread-per-Connection)** 모델로 동작합니다. 이 차이는 메모리 구조, 병렬 처리 특성, 최대 연결 수 설계에 직접적인 영향을 줍니다.

## Thread-per-Connection 모델

MySQL에서 클라이언트가 접속하면 서버는 **전용 스레드를 하나 생성**하고 그 스레드가 해당 연결의 모든 쿼리를 처리합니다.

- 연결 1 → Thread 1
- 연결 2 → Thread 2
- 연결 N → Thread N

스레드는 연결이 끊어질 때까지 그 클라이언트만을 담당합니다. InnoDB Buffer Pool, Table Cache 같은 자원은 모든 스레드가 공유하고, sort_buffer_size·join_buffer_size 같은 세션 메모리는 스레드마다 독립적으로 할당됩니다.

![Thread-per-Connection 모델](/assets/posts/mysql-connection-thread-model-arch.svg)

PostgreSQL의 프로세스 모델과 비교하면:

| 항목 | MySQL (Thread) | PostgreSQL (Process) |
|------|---------------|---------------------|
| 연결당 메모리 | 수백 KB (세션 버퍼) | 수 MB (프로세스 오버헤드) |
| 컨텍스트 스위치 비용 | 낮음 | 높음 |
| 공유 메모리 접근 | 동일 프로세스 내 직접 | IPC 필요 |
| 연결 장애 격리 | 스레드 크래시 → 프로세스 영향 가능 | 프로세스 격리 |

## 스레드 캐시

스레드를 매번 OS에서 생성·파괴하는 비용은 무시할 수 없습니다. MySQL은 **스레드 캐시(Thread Cache)** 로 이 비용을 줄입니다.

```sql
-- 스레드 캐시 설정
SET GLOBAL thread_cache_size = 16;

-- 현재 스레드 상태 모니터링
SHOW STATUS LIKE 'Threads%';
-- Threads_connected: 현재 연결된 클라이언트 수
-- Threads_running:   현재 쿼리를 실행 중인 스레드 수
-- Threads_cached:    캐시에서 대기 중인 스레드 수
-- Threads_created:   서버 시작 후 총 생성된 스레드 수

-- 스레드 캐시 적중률 계산
SHOW STATUS LIKE 'Connections';
-- 적중률 = (Connections - Threads_created) / Connections
-- 이 값이 낮으면 thread_cache_size 증가 고려
```

연결이 끊어지면 스레드는 `thread_cache_size` 개수 한도 내에서 캐시에 보관됩니다. 새 연결 요청이 오면 캐시에서 스레드를 꺼내 재사용합니다. `Threads_created`가 `Connections`에 비해 지나치게 크다면 캐시 크기를 늘리는 것이 좋습니다.

## max_connections와 메모리 설계

`max_connections`는 MySQL이 동시에 처리할 수 있는 최대 연결 수입니다. 기본값은 151입니다.

```sql
-- 현재 설정 확인
SHOW VARIABLES LIKE 'max_connections';

-- 동시 접속 피크를 추적
SHOW STATUS LIKE 'Max_used_connections';

-- 글로벌 변경 (my.cnf 또는 런타임)
SET GLOBAL max_connections = 300;
```

![커넥션 풀과 max_connections 설계](/assets/posts/mysql-connection-thread-model-pool.svg)

**메모리 계산 공식**:

```
총 메모리 필요량 = innodb_buffer_pool_size
                 + max_connections × (sort_buffer_size
                                    + join_buffer_size
                                    + read_buffer_size
                                    + read_rnd_buffer_size
                                    + ...)
```

예를 들어 `max_connections = 500`, 세션 버퍼 합계가 1MB라면 세션 메모리만 500MB입니다. Buffer Pool이 8GB라면 최소 8.5GB 이상의 RAM이 필요합니다.

`max_connections`를 무한정 늘리는 것은 금물입니다. 연결 수가 늘수록 Global Mutex 경합, CPU 컨텍스트 스위치, 메모리 사용량이 모두 증가합니다.

## 커넥션 풀 전략

실무에서는 애플리케이션 레벨 커넥션 풀을 사용해 MySQL의 스레드 생성 부담을 줄입니다.

```yaml
# HikariCP (Java) 설정 예시
spring:
  datasource:
    hikari:
      maximum-pool-size: 20          # 풀 최대 크기
      minimum-idle: 5                # 최소 유지 연결
      idle-timeout: 600000           # 유휴 연결 제거 (10분)
      connection-timeout: 30000      # 획득 대기 최대 (30초)
      max-lifetime: 1800000          # 연결 최대 수명 (30분)
```

**권장 설계 공식 (HikariCP)**:
```
pool_size = (core_count * 2) + effective_spindle_count
```

CPU 4코어 + SSD(spindle=0) 서버라면 `(4 × 2) + 0 = 8` 정도가 적절합니다. 이 값의 몇 배로 `max_connections`를 설정하고, 나머지는 모니터링 용도로 남겨둡니다.

## 연결 타임아웃 설정

장시간 아무것도 하지 않는 "좀비 연결"이 쌓이면 max_connections를 잠식합니다.

```sql
-- 비대화형 연결 타임아웃 (초)
SET GLOBAL wait_timeout = 300;          -- 기본 28800 (8시간)

-- 대화형(CLI) 연결 타임아웃
SET GLOBAL interactive_timeout = 300;

-- 현재 연결 목록 확인 (Time: 유휴 시간 초)
SHOW PROCESSLIST;

-- 좀비 연결 정리
KILL CONNECTION {id};
```

`wait_timeout`은 기본값이 8시간으로 너무 깁니다. 웹 애플리케이션 환경에서는 5~10분으로 줄이는 것이 일반적입니다.

## Thread Pool 플러그인

MySQL Enterprise Edition과 MariaDB에는 **Thread Pool** 옵션이 있습니다. 연결 수가 스레드 수보다 많아도 고정 크기의 스레드 풀로 처리해, 컨텍스트 스위치와 메모리 사용을 줄입니다. 커넥션 수만 수천 개인 SaaS 환경에서 효과적입니다.

```sql
-- MariaDB Thread Pool 상태
SHOW STATUS LIKE 'threadpool%';
-- Threadpool_threads: 풀 내 스레드 수
-- Threadpool_idle_threads: 유휴 스레드
```

Community Edition에서는 ProxySQL 같은 미들웨어로 비슷한 효과를 낼 수 있습니다.

---

**지난 글:** [MySQL 스토리지 엔진 — InnoDB·MyISAM·Memory](/posts/mysql-storage-engines/)

**다음 글:** [MySQL 쿼리 캐시가 사라진 이유 — 글로벌 Mutex의 함정](/posts/mysql-query-cache-removed/)

<br>
읽어주셔서 감사합니다. 😊
