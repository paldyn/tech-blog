---
title: "/var/log 주요 파일 탐방 — 어떤 로그가 어디에 있나"
description: "/var/log 디렉터리의 주요 로그 파일 목적과 위치를 정리하고, syslog·auth.log·wtmp·dpkg.log 등을 읽고 분석하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "logging", "var-log", "syslog", "auth.log", "wtmp", "dpkg", "nginx", "lastlog"]
featured: false
draft: false
---

[지난 글](/posts/linux-syslog-rsyslog/)에서 rsyslog의 설정과 동작 방식을 배웠습니다. 이번에는 실제로 `/var/log` 디렉터리에 어떤 파일들이 있고, 각 파일이 무엇을 기록하는지 살펴봅니다. 장애 대응이나 보안 사고 분석에서 어느 파일을 먼저 열어야 하는지 아는 것이 핵심입니다.

## /var/log 디렉터리 개요

```bash
ls /var/log/
# auth.log  syslog  kern.log  dpkg.log  apt/  nginx/  mysql/  ...
```

파일마다 기록 내용과 포맷이 다릅니다. 일부는 텍스트(`cat`, `grep`으로 바로 볼 수 있음), 일부는 바이너리(전용 명령어 필요)입니다.

![/var/log 주요 파일](/assets/posts/linux-var-log-tour-map.svg)

## 시스템 로그

**syslog / messages**: rsyslog가 기록하는 전체 시스템 메시지입니다. Ubuntu/Debian은 `syslog`, RHEL/CentOS는 `messages`를 씁니다.

```bash
tail -100 /var/log/syslog
grep 'May 18' /var/log/syslog | grep -i error
```

**kern.log**: 커널 메시지만 분리한 파일입니다. 하드웨어 오류, 드라이버 문제, OOM 이벤트가 여기 기록됩니다.

```bash
grep -i 'oom\|segfault\|error' /var/log/kern.log
```

**dmesg**: 부팅 시 커널 링 버퍼 내용을 저장합니다. `dmesg` 명령으로도 볼 수 있으며, 파일은 이전 부팅 내용을 보존합니다.

## 보안·인증 로그

**auth.log (Ubuntu) / secure (RHEL)**: SSH 로그인, sudo 명령, PAM 인증이 모두 기록됩니다. 보안 사고 분석의 첫 번째 타깃입니다.

```bash
# 성공한 SSH 로그인
grep 'Accepted' /var/log/auth.log

# sudo 사용 이력
grep 'sudo' /var/log/auth.log | grep 'COMMAND'
```

**wtmp / btmp**: 바이너리 포맷입니다. `last`(wtmp)와 `lastb`(btmp)로 조회합니다.

```bash
last -n 20                  # 최근 20개 로그인·로그아웃
last -F                     # 전체 날짜·시각 출력
lastb -n 20                 # 최근 20개 실패 로그인
```

**lastlog**: 각 사용자의 마지막 로그인 기록입니다.

```bash
lastlog                     # 전체 사용자
lastlog -u alice            # 특정 사용자
```

## 패키지 관리 로그

**dpkg.log**: 패키지 설치·제거·업그레이드 이력입니다.

```bash
# 오늘 설치된 패키지
grep "$(date +%Y-%m-%d) .* install " /var/log/dpkg.log

# 특정 패키지 이력
grep 'nginx' /var/log/dpkg.log
```

**apt/history.log**: `apt` 명령어 단위로 기록합니다. `dpkg.log`보다 사람이 읽기 쉽습니다.

```bash
cat /var/log/apt/history.log | grep -A 5 'Start-Date'
```

## 애플리케이션 로그

nginx, Apache, MySQL은 `/var/log/<앱이름>/` 하위 디렉터리를 사용합니다.

```bash
# nginx 접근 로그 - 최신 100줄
tail -100 /var/log/nginx/access.log

# HTTP 5xx 오류 요청 수
awk '$9~/^5/' /var/log/nginx/access.log | wc -l

# MySQL 슬로우 쿼리
tail -50 /var/log/mysql/mysql-slow.log
```

![로그 분석 빠른 참조](/assets/posts/linux-var-log-tour-commands.svg)

## 주의: 로그 파일 크기 확인

운영 중에 디스크가 꽉 차는 사고의 절반 이상이 로그 파일 급증에서 비롯됩니다.

```bash
# 큰 로그 파일 찾기
du -sh /var/log/* | sort -rh | head -20

# 실시간 증가 모니터링
watch -n 5 'df -h /var/log'
```

로그 파일의 크기와 로테이션 주기는 다음 글에서 다루는 `logrotate`로 제어합니다.

---

**지난 글:** [syslog와 rsyslog — 전통적 로깅 인프라](/posts/linux-syslog-rsyslog/)

**다음 글:** [logrotate — 로그 파일 로테이션 자동화](/posts/linux-logrotate/)

<br>
읽어주셔서 감사합니다. 😊
