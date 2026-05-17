---
title: "journalctl로 로그 읽기 — systemd 저널 완전 활용"
description: "journalctl 명령어의 핵심 옵션을 익히고, 유닛·시간·우선순위·필드 기반 필터링으로 원하는 로그를 빠르게 찾는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "journalctl", "logging", "journal", "syslog", "debugging"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-timers-vs-cron/)에서 systemd 타이머로 주기적 작업을 예약하는 방법을 배웠습니다. 타이머 실행 결과를 확인하거나 서비스 장애를 진단할 때 가장 먼저 열어야 하는 도구가 **journalctl**입니다. systemd는 모든 서비스 출력을 바이너리 저널에 기록하고, journalctl은 이를 조회하는 단일 인터페이스를 제공합니다.

## 기본 사용법

옵션 없이 실행하면 모든 로그를 최신순으로 보여주고 페이저(`less`)로 열립니다.

```bash
journalctl          # 전체 로그
journalctl -e       # 끝(최신)으로 바로 이동
journalctl -r       # 역순 출력 (최신 → 오래된 순)
```

실무에서 가장 자주 쓰는 패턴은 특정 유닛 로그를 실시간으로 보는 것입니다.

```bash
journalctl -u nginx.service -f
```

`-u`는 유닛 지정, `-f`는 follow 모드입니다. 두 유닛을 동시에 볼 수도 있습니다.

```bash
journalctl -u nginx.service -u php-fpm.service -f
```

![journalctl 주요 옵션](/assets/posts/linux-journalctl-options.svg)

## 시간 범위 필터

`--since`와 `--until`은 사람이 읽기 쉬운 형식을 모두 받아들입니다.

```bash
# 오늘 로그
journalctl --since today

# 특정 시각 범위
journalctl --since "2026-05-18 00:00:00" --until "2026-05-18 06:00:00"

# 상대적 시간
journalctl --since "1 hour ago"
journalctl --since "-30min"
```

## 우선순위 필터

syslog 우선순위 번호 또는 이름으로 필터링합니다. `-p err`은 err(3) 이상, 즉 err·crit·alert·emerg를 모두 포함합니다.

```bash
journalctl -p err            # 오류 이상
journalctl -p warning..err   # warning~err 범위
journalctl -p 0              # emerg만
```

| 번호 | 이름 | 의미 |
|------|------|------|
| 0 | emerg | 시스템 사용 불가 |
| 1 | alert | 즉각 조치 필요 |
| 2 | crit | 치명적 오류 |
| 3 | err | 오류 |
| 4 | warning | 경고 |
| 5 | notice | 일반 중요 메시지 |
| 6 | info | 정보 |
| 7 | debug | 디버그 |

## 출력 포맷

`-o` 옵션으로 출력 형식을 바꿉니다.

```bash
journalctl -u sshd -o json-pretty   # JSON (필드 전체 출력)
journalctl -u sshd -o short-iso     # ISO 타임스탬프
journalctl -u sshd -o cat           # 메시지만 (타임스탬프 없음)
```

JSON 출력은 `jq`와 조합해서 특정 필드만 추출할 때 유용합니다.

```bash
journalctl -u sshd -o json | jq '.MESSAGE' | head -20
```

## 부팅별 로그

systemd 저널은 부팅 기록을 보존합니다. `-b` 플래그로 특정 부팅의 로그만 볼 수 있습니다.

```bash
journalctl --list-boots      # 부팅 목록 (ID, 시작·종료 시각)
journalctl -b                # 현재 부팅
journalctl -b -1             # 이전 부팅
journalctl -b -2             # 그 이전 부팅
```

크래시 직후 디버깅할 때는 `-b -1`로 직전 부팅의 로그를 검토하는 것이 첫 번째 단계입니다.

## 필드 기반 필터링

journal 항목에는 `_SYSTEMD_UNIT`, `_PID`, `_UID`, `PRIORITY` 같은 구조화 필드가 있습니다. 필드=값 형태로 직접 지정할 수 있습니다.

```bash
journalctl _PID=1234
journalctl _UID=1000               # 특정 사용자의 로그
journalctl _TRANSPORT=kernel       # 커널 메시지 (= journalctl -k)
```

![journal 로그 항목 구조](/assets/posts/linux-journalctl-fields.svg)

## 디스크 사용량 확인

저널이 차지하는 용량을 확인하고 수동으로 정리할 수 있습니다.

```bash
journalctl --disk-usage            # 현재 저널 크기
journalctl --vacuum-size=500M      # 500MB 이하로 줄이기
journalctl --vacuum-time=30d       # 30일 이전 항목 삭제
```

저널 보존 정책은 `/etc/systemd/journald.conf`에서 설정합니다. 자세한 내용은 다음 글에서 다룹니다.

---

**지난 글:** [systemd 타이머 vs cron — 스케줄 작업의 현대적 대안](/posts/linux-systemd-timers-vs-cron/)

**다음 글:** [systemd 저널 로테이션과 보존 정책](/posts/linux-systemd-journal-rotation/)

<br>
읽어주셔서 감사합니다. 😊
