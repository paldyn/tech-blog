---
title: "AppArmor 기초 — 경로 기반 MAC으로 앱 격리하기"
description: "AppArmor의 프로파일 구조, enforce/complain 모드 전환, aa-genprof로 프로파일 생성하는 방법, SELinux와의 차이점을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "apparmor", "security", "mac", "profile", "enforce", "complain", "aa-genprof", "ubuntu"]
featured: false
draft: false
---

[지난 글](/posts/linux-selinux-basics/)에서 SELinux로 컨텍스트 기반 강제 접근 제어를 구현하는 방법을 살펴봤습니다. Ubuntu와 Debian 계열에서는 SELinux 대신 **AppArmor**가 기본으로 활성화되어 있습니다. AppArmor는 SELinux보다 설정이 직관적이어서 처음 MAC을 도입하기에 좋습니다.

## SELinux vs AppArmor

두 도구 모두 LSM(Linux Security Module) 위에서 동작하는 MAC 시스템입니다. 주요 차이는 정책 방식입니다.

| 항목 | SELinux | AppArmor |
|------|---------|----------|
| 정책 방식 | 컨텍스트(inode 라벨) | 경로(파일 경로) |
| 설정 난이도 | 복잡 | 상대적으로 쉬움 |
| 기본 배포판 | RHEL/CentOS/Fedora | Ubuntu/Debian/SUSE |
| 감사 로그 | audit.log | syslog/kern.log |

AppArmor는 **파일 경로**를 기준으로 정책을 적용합니다. SELinux처럼 inode에 라벨을 붙이지 않으므로 파일을 이동하면 경로가 바뀌어 다른 정책이 적용될 수 있습니다.

## 상태 확인

```bash
# AppArmor 활성화 여부 및 프로파일 목록
aa-status

# systemd 서비스 확인
systemctl status apparmor

# 패키지 설치 (없다면)
sudo apt install apparmor apparmor-utils
```

## 두 가지 모드

- **enforce**: 정책 위반 시 실제 차단 + 로그
- **complain**: 정책 위반을 차단하지 않고 로그만 기록 (학습 모드)

```bash
# 특정 앱을 complain 모드로
sudo aa-complain /usr/sbin/nginx

# enforce 모드로 전환
sudo aa-enforce /usr/sbin/nginx

# 전체 프로파일 일괄 처리
sudo aa-complain /etc/apparmor.d/*
```

![AppArmor 프로파일 적용 구조](/assets/posts/linux-apparmor-architecture.svg)

## 프로파일 문법

프로파일 파일은 `/etc/apparmor.d/` 디렉터리에 있습니다. 파일명은 대상 실행 파일의 경로에서 `/`를 `.`으로 바꾼 형식입니다(`/usr/sbin/nginx` → `usr.sbin.nginx`).

![AppArmor 프로파일 문법 예제](/assets/posts/linux-apparmor-profile.svg)

권한 기호:
- `r`: 읽기, `w`: 쓰기, `x`: 실행
- `rw`: 읽기+쓰기, `ix`: 상속 실행 (부모 프로파일 유지)
- `**`: 재귀 경로 (하위 디렉터리 포함), `*`: 단일 레벨

## aa-genprof로 프로파일 자동 생성

처음부터 프로파일을 작성하는 것은 어렵습니다. `aa-genprof`는 앱을 실행하면서 접근 패턴을 학습해 초안을 만들어줍니다.

```bash
# 1. 프로파일 생성 시작
sudo aa-genprof /usr/local/bin/myapp

# 2. 별도 터미널에서 앱 실행 (정상적인 사용 시나리오 수행)
/usr/local/bin/myapp --config /etc/myapp.conf

# 3. aa-genprof 창에서 (S)can 후 허용/거부 대화형 선택

# 4. 이후 로그를 학습해 프로파일 업데이트
sudo aa-logprof
```

## 프로파일 로드와 관리

```bash
# 프로파일 로드 (수정 후 적용)
sudo apparmor_parser -r /etc/apparmor.d/usr.sbin.nginx

# 프로파일 비활성화
sudo ln -s /etc/apparmor.d/usr.sbin.nginx \
  /etc/apparmor.d/disable/
sudo apparmor_parser -R /etc/apparmor.d/usr.sbin.nginx

# 로그 확인 (거부 내역)
sudo journalctl -xe | grep apparmor
sudo dmesg | grep apparmor
```

## Docker와 AppArmor

Docker는 컨테이너에 기본 AppArmor 프로파일(`docker-default`)을 자동 적용합니다. 커스텀 프로파일을 적용하려면 `--security-opt`를 사용합니다.

```bash
# 커스텀 프로파일 로드
sudo apparmor_parser -r /etc/apparmor.d/my_container_profile

# 컨테이너에 적용
docker run --security-opt apparmor=my_container_profile myimage
```

AppArmor는 Docker/LXC 컨테이너 격리에도 사용되므로, 컨테이너 보안을 강화할 때 알아두면 유용합니다.

---

**지난 글:** [SELinux 기초 — 강제 접근 제어(MAC) 입문](/posts/linux-selinux-basics/)

**다음 글:** [fail2ban — 무차별 대입 공격 자동 차단](/posts/linux-fail2ban/)

<br>
읽어주셔서 감사합니다. 😊
