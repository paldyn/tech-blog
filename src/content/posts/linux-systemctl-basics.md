---
title: "systemctl 기본 — 서비스 관리의 핵심"
description: "systemctl로 서비스를 시작·중지·재시작하고, enable/disable로 부팅 설정을 제어하며, status 출력을 해석하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "systemctl", "systemd", "service", "enable", "disable", "daemon-reload", "linux-admin"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-overview/)에서 systemd의 전체 구조를 살펴봤습니다. 이번에는 **systemctl**을 집중적으로 다룹니다. systemctl은 systemd와 대화하는 CLI 도구로, 서비스 관리 업무의 90%가 이 명령 하나로 이루어집니다.

## 서비스 시작·중지·재시작

```bash
# 즉시 시작
sudo systemctl start nginx

# 즉시 중지
sudo systemctl stop nginx

# 재시작 (stop → start)
sudo systemctl restart nginx

# 설정만 다시 읽기 (무중단)
sudo systemctl reload nginx

# reload 지원 여부 모르면 (지원하면 reload, 아니면 restart)
sudo systemctl reload-or-restart nginx
```

`restart`는 서비스를 완전히 내렸다가 다시 올립니다. `reload`는 프로세스를 유지한 채 설정 파일만 다시 읽습니다(SIGHUP 전송). nginx, Apache 같은 웹 서버는 `reload`를 지원해 무중단 설정 변경이 가능합니다.

## 부팅 자동 시작 설정

```bash
# 부팅 시 자동 시작 설정
sudo systemctl enable nginx

# 자동 시작 해제
sudo systemctl disable nginx

# enable + 즉시 start (가장 자주 쓰는 패턴)
sudo systemctl enable --now nginx

# disable + 즉시 stop
sudo systemctl disable --now nginx
```

`enable`과 `start`는 **독립적**입니다. `enable`은 `/etc/systemd/system/multi-user.target.wants/nginx.service` 같은 심볼릭 링크를 만들어 다음 부팅에 자동 시작하게 할 뿐, 지금 당장 시작하지 않습니다.

![systemctl 핵심 명령어](/assets/posts/linux-systemctl-basics-commands.svg)

## mask — 완전 비활성화

```bash
# 완전 비활성화 (/dev/null 링크)
sudo systemctl mask nginx

# 해제
sudo systemctl unmask nginx
```

`disable`한 서비스는 다른 서비스가 의존성으로 시작시킬 수 있습니다. `mask`는 `/dev/null`로 링크해 **어떤 경우에도 시작 불가**하게 합니다. 보안상 절대 실행되지 않아야 할 서비스에 사용합니다.

## status 출력 해석

```bash
systemctl status nginx
```

![systemctl status 출력 분석](/assets/posts/linux-systemctl-basics-status.svg)

**Active 상태 값:**

| 상태 | 의미 |
|------|------|
| `active (running)` | 정상 실행 중 |
| `active (exited)` | 일회성 작업 완료 (Type=oneshot) |
| `inactive (dead)` | 중지됨 |
| `failed` | 에러로 종료 |
| `activating` | 시작 중 |

`failed` 상태에서는 `journalctl -u nginx --since "5 min ago"` 로 자세한 로그를 확인합니다.

## 빠른 상태 확인 (스크립트용)

```bash
# 실행 중인지 확인 (종료 코드로)
systemctl is-active nginx && echo "실행 중"

# 자동 시작 설정 여부 확인
systemctl is-enabled nginx

# 실패한 서비스 목록
systemctl --failed

# 특정 유형 유닛 목록
systemctl list-units --type=service --state=running
```

`is-active`와 `is-enabled`는 출력 없이 종료 코드로만 결과를 알려줍니다(`0`이면 성공). 스크립트에서 `if systemctl is-active nginx` 형태로 사용합니다.

## 유닛 파일 확인 및 편집

```bash
# 유닛 파일 위치와 내용
systemctl cat nginx

# 유닛 속성 전체 (key=value)
systemctl show nginx

# 특정 속성만
systemctl show nginx -p MainPID
systemctl show nginx -p ActiveState

# 안전한 유닛 파일 편집 (drop-in 생성)
sudo systemctl edit nginx
# /etc/systemd/system/nginx.service.d/override.conf 생성

# 전체 유닛 파일 직접 편집
sudo systemctl edit --full nginx
```

`systemctl edit`은 원본 파일을 수정하지 않고 override.conf를 만듭니다. 배포판 업데이트 후에도 커스텀 설정이 유지됩니다.

## daemon-reload — 잊지 말것

유닛 파일을 변경하면 **반드시** `daemon-reload`를 실행해야 systemd가 새 파일을 읽습니다.

```bash
# 유닛 파일 수정 후
sudo systemctl daemon-reload

# 이후 서비스 재시작
sudo systemctl restart myapp
```

`daemon-reload` 없이 `restart`하면 **이전 파일 내용**으로 실행됩니다. 파일을 수정했는데 변경이 반영 안 된다면 이 단계를 빠뜨린 경우가 많습니다.

## 시스템 전체 제어

```bash
# 재시작
sudo systemctl reboot

# 종료
sudo systemctl poweroff

# 일시 중단
sudo systemctl suspend

# 현재 기본 타겟 확인
systemctl get-default

# 기본 타겟 변경 (영구)
sudo systemctl set-default multi-user.target
```

---

**지난 글:** [systemd 개요 — 현대 Linux의 init 시스템](/posts/linux-systemd-overview/)

**다음 글:** [systemd 유닛 파일 — 서비스 정의의 모든 것](/posts/linux-systemd-unit-files/)

<br>
읽어주셔서 감사합니다. 😊
