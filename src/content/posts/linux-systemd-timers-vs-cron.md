---
title: "systemd 타이머 vs cron — 스케줄 작업의 현대적 대안"
description: "systemd 타이머 유닛의 구조와 OnCalendar 문법을 설명하고, cron과의 차이를 비교합니다. Persistent 옵션으로 누락 실행을 복구하는 방법도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "timer", "cron", "scheduling", "OnCalendar", "Persistent", "oneshot"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-targets/)에서 systemd 타겟으로 시스템 상태를 전환하는 방법을 배웠습니다. 이번에는 **주기적인 작업을 자동화하는 두 가지 방법** — systemd 타이머와 cron — 을 비교하고, 현대 리눅스에서 타이머를 선택해야 하는 이유를 살펴봅니다.

## cron이 여전히 쓰이는 이유

cron은 수십 년의 역사를 가진 UNIX 스케줄러입니다. `crontab -e` 한 줄로 작업을 등록할 수 있고, 5-field 표현식(`분 시 일 월 요일`)은 직관적입니다. 대부분의 배포판에 기본 설치돼 있고, 많은 레거시 스크립트가 cron을 전제로 작성돼 있습니다.

하지만 cron에는 몇 가지 구조적 한계가 있습니다. 실행 결과가 이메일로만 전달되고, 서비스 간 의존성을 설정할 수 없으며, 시스템이 꺼져 있는 동안 놓친 실행을 복구할 방법이 없습니다. systemd 타이머는 이 세 가지 문제를 모두 해결합니다.

![systemd 타이머 vs cron 비교](/assets/posts/linux-systemd-timers-vs-cron-compare.svg)

## systemd 타이머의 구조

타이머는 `.timer` 유닛과 `.service` 유닛이 **쌍**으로 동작합니다. 타이머가 시간을 측정하고, 조건이 맞으면 같은 이름의 서비스를 실행합니다. `backup.timer`는 `backup.service`를 기동합니다.

```
/etc/systemd/system/
├── backup.timer
└── backup.service
```

`.timer` 유닛의 핵심 섹션은 `[Timer]`입니다.

```ini
[Unit]
Description=Daily Backup Timer

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

`OnCalendar=daily`는 매일 자정을 의미합니다. `Persistent=true`를 추가하면 시스템이 꺼져 있는 동안 건너뛴 실행을 부팅 직후 자동으로 보완합니다. 서비스 유닛은 일반적인 oneshot 서비스로 작성합니다.

```ini
[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup.sh
```

![타이머 유닛 구조 예시](/assets/posts/linux-systemd-timers-vs-cron-unit.svg)

## OnCalendar 문법

`OnCalendar=` 는 사람이 읽기 쉬운 캘린더 표현식을 사용합니다.

```
daily          → 매일 00:00:00
weekly         → 매주 월요일 00:00:00
hourly         → 매시 00:00
*-*-* 02:30:00 → 매일 02:30
Mon *-*-* 08:00→ 매주 월요일 08:00
*-*-1 00:00    → 매월 1일 자정
```

표현식이 올바른지 확인하려면 `systemd-analyze calendar`를 사용합니다.

```bash
systemd-analyze calendar "Mon *-*-* 08:00:00"
# Normalized form: Mon *-*-* 08:00:00
# Next elapse: Mon 2026-05-18 08:00:00 KST
#   (in 5h 30min)
```

## Monotonic 타이머

캘린더 시간이 아닌 **상대적 시간**으로 트리거하려면 단조(monotonic) 키워드를 씁니다.

```ini
[Timer]
OnBootSec=5min        # 부팅 후 5분
OnUnitActiveSec=1h    # 마지막 활성화로부터 1시간
```

`OnBootSec` + `OnUnitActiveSec` 조합은 "부팅 5분 후 첫 실행, 이후 1시간마다"라는 패턴을 만듭니다. 데이터베이스 통계 수집이나 캐시 워밍처럼 절대 시각보다 간격이 중요한 작업에 적합합니다.

## 타이머 활성화와 관리

```bash
# 타이머 활성화
sudo systemctl enable --now backup.timer

# 등록된 타이머 목록 (다음 실행 시각 포함)
systemctl list-timers --all

# 실행 이력 확인
journalctl -u backup.service --since today

# 타이머 상태
systemctl status backup.timer
```

`systemctl list-timers` 출력에는 `NEXT`(다음 실행까지 남은 시간), `LAST`(마지막 실행 시각), `PASSED`(경과 시간)가 표시됩니다. cron에서는 이런 정보를 얻으려면 별도 로그를 파야 했습니다.

## 언제 cron을 유지할까

모든 상황에서 타이머가 우월한 것은 아닙니다. 다음 경우에는 cron이 더 간단합니다.

- 단순한 일회성 스크립트를 빠르게 등록할 때
- 컨테이너 없이 사용자 홈 디렉터리에서 개인 작업을 예약할 때 (`crontab -e`)
- 기존 cron 기반 툴(예: logrotate의 `/etc/cron.daily`)과 연동할 때

새로 작성하는 시스템 수준 작업이라면 타이머를 선택하는 것이 권장됩니다. journald 로깅, 의존성 제어, 리소스 격리가 기본으로 제공됩니다.

---

**지난 글:** [systemd 타겟 — 런레벨의 현대적 대체](/posts/linux-systemd-targets/)

**다음 글:** [journalctl로 로그 읽기](/posts/linux-journalctl/)

<br>
읽어주셔서 감사합니다. 😊
