---
title: "logrotate — 로그 파일 로테이션 자동화"
description: "logrotate 설정 파일 문법, daily/weekly 주기, compress·delaycompress·postrotate 옵션으로 로그를 자동 관리하고 디스크를 절약하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "logrotate", "logging", "rotation", "compress", "postrotate", "cron", "syslog"]
featured: false
draft: false
---

[지난 글](/posts/linux-var-log-tour/)에서 `/var/log` 디렉터리의 주요 파일을 둘러봤습니다. 로그 파일은 방치하면 디스크를 가득 채웁니다. **logrotate**는 로그 파일을 주기적으로 잘라내고 압축하며 오래된 파일을 삭제하는 도구입니다. 대부분의 배포판에서 cron daily 잡(`/etc/cron.daily/logrotate`)으로 매일 실행됩니다.

## logrotate 동작 원리

logrotate가 실행되면 다음 순서로 처리합니다.

1. 설정 파일 읽기 (`/etc/logrotate.conf` + `/etc/logrotate.d/*`)
2. 마지막 로테이션 시각 확인 (`/var/lib/logrotate/status`)
3. 조건 충족 시 현재 파일을 `.1`, `.2`... 로 이름 변경
4. 새 빈 파일 생성 (또는 copytruncate)
5. 압축·삭제·훅 스크립트 실행

![로그 파일 로테이션 라이프사이클](/assets/posts/linux-logrotate-lifecycle.svg)

## 설정 파일 구조

전역 기본값은 `/etc/logrotate.conf`에 있고, 앱별 설정은 `/etc/logrotate.d/` 하위 파일로 분리합니다. 패키지 설치 시 앱이 자동으로 자신의 설정 파일을 추가합니다.

```bash
/etc/logrotate.conf
/etc/logrotate.d/
├── nginx
├── mysql
├── syslog
└── rsyslog
```

![logrotate 설정 파일](/assets/posts/linux-logrotate-config.svg)

## 핵심 옵션 정리

```
# 로테이션 주기
daily        # 매일
weekly       # 매주
monthly      # 매월
size 100M    # 파일 크기 초과 시 즉시

# 보존 개수
rotate 7     # 7개 유지 (날짜별 기준이면 7일치)

# 파일 처리
compress              # gzip으로 압축
delaycompress         # 이번에 만든 .1은 다음에 압축 (쓰기 중일 수 있으므로)
copytruncate          # 파일 복사 후 원본 비우기 (재시작 불가 앱에 사용)
create 0640 root adm  # 새 파일 권한과 소유자

# 조건
missingok     # 대상 파일이 없어도 오류 없음
notifempty    # 빈 파일은 로테이션 건너뜀
ifempty       # 빈 파일도 로테이션

# 파일 이름
dateext           # 숫자 대신 날짜로 이름 (app.log-20260518.gz)
dateformat -%Y%m%d
```

## 실전 설정 예시: 애플리케이션 로그

```
/var/log/myapp/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 myapp adm
    sharedscripts
    postrotate
        /bin/kill -HUP $(cat /run/myapp.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
```

`postrotate`에서 프로세스에 `SIGHUP`을 보내면 대부분의 데몬이 로그 파일을 다시 엽니다. nginx는 `nginx -s reopen`, rsyslog는 `systemctl reload rsyslog`를 씁니다.

## 테스트와 수동 실행

```bash
# 설정 검사 (실제 실행하지 않고 무엇을 할지 출력)
logrotate -d /etc/logrotate.d/nginx

# 강제 즉시 실행 (날짜 조건 무시)
sudo logrotate -f /etc/logrotate.d/nginx

# 전체 설정으로 실행
sudo logrotate /etc/logrotate.conf

# 마지막 실행 시각 확인
cat /var/lib/logrotate/status | grep nginx
```

## systemd 타이머로 전환

최신 배포판에서는 cron daily 대신 systemd 타이머로 logrotate를 실행합니다.

```bash
systemctl list-timers | grep logrotate
# logrotate.timer

systemctl cat logrotate.timer   # 타이머 설정 확인
```

타이머가 있다면 cron의 `/etc/cron.daily/logrotate`는 실행되지 않습니다. 두 방식이 동시에 실행되지 않도록 주의합니다.

---

**지난 글:** [/var/log 주요 파일 탐방 — 어떤 로그가 어디에 있나](/posts/linux-var-log-tour/)

**다음 글:** [dmesg — 커널 링 버퍼와 부팅 메시지](/posts/linux-dmesg/)

<br>
읽어주셔서 감사합니다. 😊
