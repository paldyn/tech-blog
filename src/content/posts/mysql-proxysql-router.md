---
title: "ProxySQL & MySQL Router — MySQL 연결 프록시 완전 가이드"
description: "ProxySQL과 MySQL Router의 아키텍처, 읽기/쓰기 분리, 커넥션 풀링, 쿼리 규칙, 헬스체크, 장애 조치 설정을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["MySQL", "ProxySQL", "MySQL Router", "읽기쓰기분리", "커넥션풀링", "고가용성", "로드밸런싱"]
featured: false
draft: false
---

[지난 글](/posts/mysql-backup-mysqldump-xtrabackup/)에서 MySQL 백업 전략을 다뤘다. 리플리케이션 토폴로지를 구성했다면 애플리케이션이 Primary와 Replica를 자동으로 구분해 연결하게 만드는 **연결 프록시**가 필요하다. **ProxySQL**과 **MySQL Router**가 이 역할을 담당한다.

## 연결 프록시가 필요한 이유

리플리케이션 환경에서 애플리케이션이 Primary/Replica IP를 직접 관리하면 Failover 시 코드 변경이 필요하고, 읽기 부하를 Replica에 분산하는 로직도 애플리케이션 코드에 들어간다. 프록시는 이를 인프라 계층에서 투명하게 처리한다.

- **읽기/쓰기 분리**: SELECT → Replica, DML → Primary
- **커넥션 풀링**: 수천 개의 앱 연결을 수십 개의 백엔드 연결로 다중화
- **헬스체크 & 자동 Failover**: 장애 서버 자동 제거
- **쿼리 미러링/캐싱**: ProxySQL의 고급 기능

## ProxySQL 아키텍처

![ProxySQL 아키텍처](/assets/posts/mysql-proxysql-architecture.svg)

ProxySQL은 두 개의 포트를 사용한다. `:6033`은 MySQL 프로토콜 호환 포트로 애플리케이션이 연결하고, `:6032`는 Admin 인터페이스로 MySQL 클라이언트로 접속해 설정을 관리한다.

내부는 3계층 설정 구조다.
- **Runtime**: 현재 동작 중인 설정 (메모리)
- **Memory**: 편집 중인 설정 (반영 전)
- **Disk**: 재시작 후에도 유지되는 설정 (SQLite)

`LOAD … TO RUNTIME`으로 Memory → Runtime, `SAVE … TO DISK`로 Memory → Disk에 영구 저장한다.

## ProxySQL 기본 설치와 설정

```bash
# 설치 (Percona 저장소 기준)
yum install proxysql2
systemctl start proxysql

# Admin 접속
mysql -u admin -padmin -h 127.0.0.1 -P 6032 --prompt='ProxySQL> '
```

![ProxySQL 핵심 설정](/assets/posts/mysql-proxysql-config.svg)

```sql
-- 백엔드 서버 등록
INSERT INTO mysql_servers (hostgroup_id, hostname, port, max_connections)
VALUES
  (10, '192.168.1.10', 3306, 100),   -- Primary (Write: HG 10)
  (20, '192.168.1.11', 3306, 100),   -- Replica 1 (Read: HG 20)
  (20, '192.168.1.12', 3306, 100);   -- Replica 2 (Read: HG 20)

-- 모니터링 유저 생성 (MySQL Primary에서 먼저 실행)
-- CREATE USER 'monitor'@'%' IDENTIFIED BY 'monpass';
-- GRANT SELECT ON sys.* TO 'monitor'@'%';

SET mysql-monitor_username = 'monitor';
SET mysql-monitor_password = 'monpass';

-- 애플리케이션 유저 등록
INSERT INTO mysql_users (username, password, default_hostgroup)
VALUES ('appuser', 'apppass', 10);   -- 기본은 Primary(HG 10)

-- 읽기/쓰기 분리 쿼리 규칙
INSERT INTO mysql_query_rules (rule_id, active, match_digest, destination_hostgroup, apply)
VALUES
  (1, 1, '^SELECT.*FOR UPDATE', 10, 1),   -- SELECT FOR UPDATE는 Primary로
  (2, 1, '^SELECT',             20, 1),   -- 일반 SELECT는 Replica로
  (3, 1, '.*',                  10, 1);   -- 나머지는 Primary로

-- 설정 적용
LOAD MYSQL SERVERS TO RUNTIME;
LOAD MYSQL USERS TO RUNTIME;
LOAD MYSQL QUERY RULES TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;
SAVE MYSQL USERS TO DISK;
SAVE MYSQL QUERY RULES TO DISK;
```

## ProxySQL 모니터링

```sql
-- 백엔드 서버 상태 확인
SELECT hostgroup_id, hostname, port, status, ConnUsed, ConnFree
FROM stats_mysql_connection_pool;

-- 쿼리 다이제스트 분석 (성능 분석의 핵심)
SELECT digest_text, count_star, sum_time, min_time, max_time
FROM stats_mysql_query_digest
ORDER BY sum_time DESC
LIMIT 20;

-- 현재 연결 수
SELECT * FROM stats_mysql_global WHERE Variable_Name LIKE '%Connections%';

-- 쿼리 라우팅 확인
SELECT rule_id, match_digest, destination_hostgroup, hits
FROM stats_mysql_query_rules
ORDER BY rule_id;
```

## ProxySQL Multiplexing

커넥션 멀티플렉싱은 ProxySQL의 핵심 가치다. 앱 서버에서 수천 개의 연결이 들어와도 ProxySQL은 백엔드에 훨씬 적은 수의 연결을 유지하며 재사용한다.

```sql
-- 커넥션 풀 최적화
UPDATE mysql_servers SET max_connections = 50
WHERE hostgroup_id = 10;

UPDATE mysql_servers SET max_connections = 100
WHERE hostgroup_id = 20;

-- 트랜잭션 중에는 멀티플렉싱 비활성화 (자동)
-- SET autocommit=0 이후 → 해당 연결이 백엔드에 고정됨
-- COMMIT/ROLLBACK 후 → 커넥션 풀로 반환
```

## ProxySQL 헬스체크와 장애 조치

```sql
-- 헬스체크 설정
SET mysql-monitor_connect_interval = 2000;   -- 2초마다
SET mysql-monitor_ping_interval    = 1000;   -- 1초마다
SET mysql-monitor_read_only_interval = 1000;

-- read_only 체크로 Primary/Replica 자동 분류
-- Primary: read_only=0 → HG 10
-- Replica: read_only=1 → HG 20

-- 장애 서버는 SHUNNED 상태로 전환 후 자동 제거
-- 복구 시 자동 재활성화

-- 장애 시뮬레이션 확인
SELECT hostgroup_id, hostname, status
FROM runtime_mysql_servers;
-- ONLINE / SHUNNED / OFFLINE_SOFT / OFFLINE_HARD
```

## MySQL Router

MySQL Router는 InnoDB Cluster(Group Replication 기반)와 통합되어 있어 설정이 훨씬 간단하다.

```bash
# InnoDB Cluster에 MySQL Router bootstrap
mysqlrouter \
  --bootstrap root@primary_host:3306 \
  --directory /etc/mysqlrouter \
  --conf-use-sockets \
  --account router_user \
  --force

# 서비스 시작
mysqlrouter --config /etc/mysqlrouter/mysqlrouter.conf &
```

```ini
# 자동 생성된 mysqlrouter.conf 일부
[routing:primary]
bind_address = 0.0.0.0
bind_port = 6446
destinations = metadata-cache://mycluster/?role=PRIMARY
routing_strategy = first-available

[routing:secondary]
bind_address = 0.0.0.0
bind_port = 6447
destinations = metadata-cache://mycluster/?role=SECONDARY
routing_strategy = round-robin-with-fallback
```

애플리케이션은 쓰기용으로 `:6446`, 읽기용으로 `:6447`에 연결한다. InnoDB Cluster 토폴로지 변경이 감지되면 Router가 자동으로 라우팅을 업데이트한다.

## ProxySQL vs MySQL Router 선택 기준

| 항목 | ProxySQL | MySQL Router |
|---|---|---|
| 쿼리 라우팅 규칙 | regex 기반, 세밀 제어 | 역할 기반 (Primary/Replica) |
| 커넥션 풀링 | 고급 멀티플렉싱 | 기본 풀링 |
| 쿼리 캐싱 | 지원 | 미지원 |
| InnoDB Cluster 연동 | 수동 설정 | 자동 bootstrap |
| 설정 복잡도 | 높음 | 낮음 |
| 성능 분석 | stats_mysql_query_digest | 제한적 |

단순 HA와 읽기/쓰기 분리만 필요하고 InnoDB Cluster를 사용한다면 MySQL Router가 운영 부담이 적다. 세밀한 쿼리 라우팅, 커넥션 최적화, 쿼리 성능 분석이 필요하다면 ProxySQL을 선택한다.

---

**지난 글:** [MySQL 백업 — mysqldump와 XtraBackup 완전 가이드](/posts/mysql-backup-mysqldump-xtrabackup/)

**다음 글:** [MySQL Performance Schema & sys 스키마 — 성능 진단 완전 가이드](/posts/mysql-performance-schema-sys/)

<br>
읽어주셔서 감사합니다. 😊
