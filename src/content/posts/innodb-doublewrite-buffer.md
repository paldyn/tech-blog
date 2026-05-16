---
title: "InnoDB Doublewrite Buffer — 부분 쓰기(Partial Page Write) 방지"
description: "InnoDB Doublewrite Buffer가 왜 필요한지, Partial Page Write 문제가 무엇인지, 두 단계 쓰기 과정이 어떻게 데이터 손상을 막는지, 그리고 성능 영향을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 16
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "doublewrite-buffer", "데이터무결성", "충돌복구", "partial-write"]
featured: false
draft: false
---

[지난 글](/posts/innodb-redo-undo-log/)에서 Redo Log와 Undo Log가 어떻게 충돌 복구와 MVCC를 담당하는지 살펴봤습니다. Redo Log는 충돌 후 변경을 재실행합니다. 그런데 이를 위해 반드시 전제 조건이 있습니다. 바로 **디스크의 기존 페이지가 온전해야 한다**는 것입니다. 페이지가 반쯤 쓰다가 깨진 상태라면 Redo Log도 적용할 수 없습니다. 이 문제를 **Partial Page Write**라고 하고, InnoDB의 **Doublewrite Buffer**가 이를 해결합니다.

## 왜 페이지가 반쯤 쓰일 수 있는가

OS와 파일시스템의 I/O 단위는 512 bytes 또는 4KB입니다. InnoDB 페이지는 16KB입니다. 즉, 16KB 페이지 하나를 디스크에 쓰려면 여러 번의 물리 I/O가 필요합니다.

만약 16KB의 절반(8KB)을 쓰다가 전원이 나가거나 OS가 충돌하면, 디스크에는 이도저도 아닌 **8KB짜리 반쪽 페이지**가 남습니다. 이전 값도, 새 값도 아닌 손상된 상태입니다.

Redo Log는 "이 페이지에서 이렇게 변경하라"는 지시를 저장합니다. 베이스 페이지 자체가 손상됐다면 이 지시를 적용할 기반이 없습니다.

## Doublewrite Buffer의 작동 원리

![Partial Page Write 문제와 Doublewrite Buffer 해결책](/assets/posts/innodb-doublewrite-buffer-problem.svg)

Doublewrite Buffer는 두 단계로 쓰기를 수행합니다.

**1단계: Doublewrite Area에 순차 기록**

Buffer Pool에서 Dirty Page를 플러시할 때, 실제 위치에 바로 쓰지 않습니다. 먼저 System Tablespace 내의 **Doublewrite Area**(또는 8.0.20+에서는 전용 파일)에 순차적으로 씁니다. 이 구역은 연속된 공간이므로 순차 I/O로 빠르게 쓸 수 있습니다.

**2단계: 실제 위치에 기록**

Doublewrite Area에 완전히 기록된 것을 확인한 후, 각 페이지를 실제 테이블스페이스의 해당 위치에 씁니다.

**충돌 복구 시**: 2단계 도중 충돌이 나더라도, Doublewrite Area에는 온전한 버전이 있습니다. 재시작 시 InnoDB는 Doublewrite Area와 실제 위치를 비교해 손상된 페이지를 Doublewrite Area의 내용으로 덮어씁니다. 그 뒤 Redo Log를 적용합니다.

```sql
-- Doublewrite 설정 확인
SHOW VARIABLES LIKE 'innodb_doublewrite%';
-- innodb_doublewrite: ON
-- innodb_doublewrite_batch_size: 0 (자동)
-- innodb_doublewrite_files: 2 (8.0.20+)
-- innodb_doublewrite_pages: 128

-- Doublewrite 쓰기 횟수 통계
SHOW STATUS LIKE 'Innodb_dblwr%';
-- Innodb_dblwr_pages_written: Doublewrite에 기록된 페이지 수
-- Innodb_dblwr_writes:        Doublewrite I/O 횟수
-- 비율 pages_written / writes → 한 번의 I/O에 몇 페이지씩 묶어 쓰는지
```

## MySQL 8.0.20+의 개선

MySQL 8.0.20 이전에는 Doublewrite Area가 ibdata1(System Tablespace) 내부에 있었습니다. ibdata1은 단일 파일이므로 Doublewrite 쓰기가 다른 I/O와 경합했습니다.

8.0.20부터는 독립된 `#ib_16384_0.dblwr` 파일을 사용합니다. 병렬 배치 기록도 지원해 오버헤드가 추가로 감소했습니다.

![Doublewrite Buffer 성능 영향](/assets/posts/innodb-doublewrite-buffer-perf.svg)

## 성능 트레이드오프

```sql
-- Doublewrite 비활성화 (테스트 환경에서만!)
-- my.cnf에 설정 후 재시작 필요
-- innodb_doublewrite = OFF

-- 또는 런타임 변경 (MySQL 8.0.23+)
SET GLOBAL innodb_doublewrite = OFF;
```

Doublewrite로 인한 쓰기 증폭은 **약 5~10%**입니다. SSD 환경에서는 순차 쓰기인 Doublewrite Area 기록이 매우 빠르므로 실질 영향은 더 작습니다.

비활성화가 안전한 경우:
- **ZFS, Btrfs** 등 원자적 쓰기(Atomic Write)를 보장하는 파일시스템
- **Fusion-io**, **NVMe**처럼 atomic write를 하드웨어 수준에서 보장하는 스토리지
- **복제 슬레이브**에서 Primary로부터 언제든 재동기 가능한 경우

프로덕션 Primary 서버에서는 특별한 이유가 없다면 **반드시 ON**을 유지합니다.

## 정리

Doublewrite Buffer는 두 번 쓰는 것처럼 보이지만, 그 덕분에 InnoDB는 Partial Page Write로 인한 데이터 손상을 원천 차단합니다. Redo Log가 "무엇을 복구할지"를 알려준다면, Doublewrite Buffer는 "복구할 기반 페이지가 항상 온전함"을 보장합니다. 이 두 메커니즘이 함께 ACID의 Durability를 완성합니다.

---

**지난 글:** [InnoDB Redo Log와 Undo Log — 복구와 MVCC의 두 기둥](/posts/innodb-redo-undo-log/)

**다음 글:** [InnoDB Adaptive Hash Index — 자동으로 만들어지는 해시 인덱스](/posts/innodb-adaptive-hash-index/)

<br>
읽어주셔서 감사합니다. 😊
