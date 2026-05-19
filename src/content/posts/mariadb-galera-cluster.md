---
title: "MariaDB Galera Cluster — 동기식 다중 Primary 클러스터 완전 가이드"
description: "MariaDB Galera Cluster의 wsrep 복제 원리, 3노드 클러스터 설정, SST/IST 조인, 쓰기 충돌·흐름 제어·DDL 주의사항, 모니터링 쿼리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["MariaDB", "Galera", "클러스터", "다중Primary", "고가용성", "wsrep", "동기복제"]
featured: false
draft: false
---

[지난 글](/posts/mariadb-aria-columnstore/)에서 MariaDB의 스토리지 엔진 Aria와 ColumnStore를 살펴봤다. 이번 글에서는 MariaDB의 가장 강력한 고가용성 기능인 **Galera Cluster**를 다룬다. MySQL의 비동기 리플리케이션과 달리 Galera는 모든 노드에 동기적으로 쓰기를 복제해 데이터 유실 없는 무중단 서비스를 가능하게 한다.

## Galera Cluster 개요

Galera는 Codership이 개발한 동기식 멀티 Primary 복제 라이브러리다. MariaDB에 wsrep(Write Set Replication) API를 통해 통합되어 있다. 핵심 특성은 다음과 같다.

- **모든 노드에서 읽기/쓰기**: Primary/Replica 구분 없음
- **동기 복제**: 쓰기 성공 = 모든 노드에 적용됨 (RPO=0)
- **자동 Failover**: 노드 장애 시 클러스터 자동 재구성
- **자동 노드 조인**: 신규 노드 추가 시 SST로 자동 동기화

![Galera Cluster 아키텍처](/assets/posts/mariadb-galera-architecture.svg)

## wsrep 복제 원리

Galera는 트랜잭션을 **Writeset**으로 패키징해 클러스터 전체에 브로드캐스트한다. Writeset에는 변경된 행 데이터와 행 인증에 필요한 키가 포함된다.

```sql
-- Writeset 복제 과정
-- 1. 트랜잭션 실행 (로컬에서만)
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
-- COMMIT 시점에 wsrep 개입

-- 2. COMMIT 직전: Writeset 브로드캐스트
-- 3. 모든 노드: 충돌 검사 (인증 키 비교)
-- 4. 충돌 없음: 모든 노드 COMMIT
-- 5. 충돌 있음: 나중에 커밋한 트랜잭션 ROLLBACK
```

충돌 감지는 **낙관적 잠금** 방식이다. 커밋 전까지는 잠금을 걸지 않고, 커밋 시점에 같은 행을 수정한 동시 트랜잭션이 있으면 하나를 자동 롤백한다.

## 3노드 클러스터 설치 및 구성

```bash
# 설치 (RHEL/CentOS 7+ 기준)
# MariaDB 저장소 추가 후
yum install MariaDB-server galera-4

# 방화벽 포트 허용
firewall-cmd --add-port=3306/tcp --permanent   # MySQL
firewall-cmd --add-port=4567/tcp --permanent   # Galera 복제
firewall-cmd --add-port=4568/tcp --permanent   # IST (Incremental State Transfer)
firewall-cmd --add-port=4444/tcp --permanent   # SST (State Snapshot Transfer)
firewall-cmd --reload
```

![Galera Cluster 설정 & 주의사항](/assets/posts/mariadb-galera-config.svg)

```ini
# /etc/my.cnf.d/galera.cnf — Node 1
[mysqld]
binlog_format            = ROW
default_storage_engine   = InnoDB
innodb_autoinc_lock_mode = 2     # Galera 필수 설정

wsrep_on                 = ON
wsrep_provider           = /usr/lib64/galera/libgalera_smm.so
wsrep_cluster_name       = "production_cluster"
wsrep_cluster_address    = "gcomm://192.168.1.10,192.168.1.11,192.168.1.12"
wsrep_node_address        = "192.168.1.10"
wsrep_node_name           = "node1"
wsrep_sst_method          = mariabackup
wsrep_sst_auth            = sst_user:sst_password
```

```bash
# 첫 번째 노드 부트스트랩 (새 클러스터 생성)
galera_new_cluster
# 또는: mysqld --wsrep-new-cluster &

# 나머지 노드는 일반 시작 (클러스터에 조인)
systemctl start mariadb
```

## SST와 IST — 노드 동기화 방식

새 노드가 클러스터에 참가하거나 오랫동안 분리된 노드가 복귀할 때 데이터를 동기화해야 한다.

```sql
-- SST (State Snapshot Transfer): 전체 데이터 복사
-- 기준 노드(donor)가 전체 스냅샷을 전달
-- wsrep_sst_method = mariabackup  → XtraBackup/MariaBackup 기반 (권장)
-- wsrep_sst_method = rsync        → 단순 파일 복사 (donor 잠금 발생)
-- wsrep_sst_method = mysqldump    → 느림 (소규모만)

-- IST (Incremental State Transfer): 증분 동기화
-- Galera 캐시(gcache)에 누락 트랜잭션이 있으면 IST 사용
-- 빠르고 donor에 부하 없음

-- gcache 크기 (클수록 IST 성공률 높아짐)
-- wsrep_provider_options = "gcache.size=1G"
```

```sql
-- SST 진행 상태 확인
SHOW STATUS LIKE 'wsrep_local_state_comment';
-- Synced: 정상 동작
-- Donor/Desynced: SST 제공 중
-- Joiner: SST 수신 중
-- Joined: SST 완료, IST 진행 중
```

## 클러스터 모니터링

```sql
-- 핵심 wsrep 상태 변수
SHOW GLOBAL STATUS WHERE Variable_name IN (
  'wsrep_cluster_size',          -- 클러스터 노드 수
  'wsrep_cluster_status',        -- Primary / Non-Primary
  'wsrep_connected',             -- ON/OFF
  'wsrep_ready',                 -- ON이면 쿼리 처리 가능
  'wsrep_local_state_comment',   -- 현재 노드 상태
  'wsrep_flow_control_paused',   -- 0에 가까울수록 좋음
  'wsrep_local_cert_failures',   -- 인증 실패 (충돌) 수
  'wsrep_local_send_queue',      -- 전송 대기 Writeset 수
  'wsrep_local_recv_queue'       -- 수신 대기 Writeset 수
);

-- 복제 지연 확인
SELECT
  wsrep_last_applied,
  wsrep_last_committed,
  wsrep_last_applied - wsrep_last_committed AS lag
FROM wsrep_status;
```

`wsrep_flow_control_paused`가 0보다 크면 클러스터 내 느린 노드가 전체 속도를 제한하고 있다는 신호다. 해당 노드의 I/O, 메모리, 네트워크를 점검해야 한다.

## 주요 운영 패턴

### 노드 순차 재시작 (Rolling Restart)

```bash
# 한 번에 한 노드씩 재시작 (서비스 중단 없음)
# 1. 트래픽을 다른 노드로 이동 (MaxScale/HAProxy에서)
# 2. 해당 노드 정상 종료
systemctl stop mariadb

# 3. 설정 변경 후 재시작
systemctl start mariadb

# 4. Synced 상태 확인 후 다음 노드 진행
mysql -e "SHOW STATUS LIKE 'wsrep_local_state_comment';"
```

### RSU (Rolling Schema Upgrade) — 무중단 DDL

```sql
-- 기본 DDL (TOI): 전체 클러스터 잠금 → 운영 중 부적합
ALTER TABLE orders ADD COLUMN note TEXT;

-- RSU: 노드별 순차 적용, 잠금 없음
-- my.cnf 또는 세션에서 설정
SET wsrep_OSU_method = 'RSU';
ALTER TABLE orders ADD COLUMN note TEXT;
SET wsrep_OSU_method = 'TOI';   -- 복원

-- RSU 주의: 다른 노드에 컬럼이 없는 상태로 쿼리하면 에러 발생 가능
-- 신규 컬럼 추가처럼 후방 호환 DDL에만 RSU 사용
```

### Split-Brain 방지

네트워크 분리로 클러스터가 둘로 나뉘면 각 파티션이 독립 쓰기를 받을 수 있다. Galera는 쿼럼(과반수) 노드를 가진 파티션만 Primary로 남겨 Split-Brain을 방지한다.

```bash
# 짝수 노드 환경에서는 Arbitrator(garbd) 추가
garbd \
  --group="production_cluster" \
  --address="gcomm://192.168.1.10,192.168.1.11,192.168.1.12" \
  --daemon

# garbd는 데이터를 저장하지 않지만 투표권을 가짐
# 2노드 + garbd = 홀수 효과
```

Galera Cluster는 MariaDB의 가장 강력한 HA 옵션이지만 올바르게 운영하려면 wsrep 상태 모니터링, gcache 크기 관리, DDL 전략, 노드 추가/제거 절차를 숙지해야 한다. 다음 글에서는 MariaDB MaxScale을 통한 지능형 프록시 구성을 살펴본다.

---

**지난 글:** [MariaDB Aria & ColumnStore — 스토리지 엔진 심층 분석](/posts/mariadb-aria-columnstore/)

**다음 글:** [MariaDB MaxScale — 지능형 데이터베이스 프록시](/posts/mariadb-maxscale/)

<br>
읽어주셔서 감사합니다. 😊
