---
title: "SSH 설정 파손 복구"
description: "sshd_config 편집 실수로 SSH 접속이 차단됐을 때 sshd -t 문법 검사, 호스트 키 권한 복구, 직렬 콘솔 접근으로 원격 서버를 복구하는 방법을 설명합니다. 잠금 방지 워크플로도 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "ssh", "sshd", "troubleshooting", "recovery", "sshd_config"]
featured: false
draft: false
---

[지난 글](/posts/linux-fs-readonly-recover/)에서 파일 시스템 읽기 전용 상태를 복구했다. 이번에는 시리즈 마지막 편으로, SSH 설정을 잘못 편집해서 접속 자체가 차단되는 최악의 상황을 다룬다. `/etc/ssh/sshd_config`에 오타 한 줄이 있으면 sshd가 시작을 거부하고, 그 순간부터 원격 서버에 접근할 수 없다. 이 상황을 빠져나오는 방법을 단계별로 살펴본다.

## 사고 발생 전 방지 워크플로

설정 변경 전 반드시 아래 순서를 따른다.

```bash
# 1. 설정 파일 백업
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# 2. 설정 수정
sudo vim /etc/ssh/sshd_config

# 3. 문법 검사 (재시작 전 반드시 실행)
sudo sshd -t
# 오류 없으면 아무것도 출력하지 않음
# 오류 시: /etc/ssh/sshd_config line 42: Bad configuration option: PermitRoootLogin

# 4. 기존 세션을 유지한 채로 재시작
sudo systemctl restart sshd

# 5. 별도 터미널에서 접속 테스트 후 기존 세션 닫기
```

**절대 금지**: 기존 SSH 세션을 닫은 상태에서 설정을 변경하고 재시작하는 것. 접속이 차단되면 콘솔 접근이 필요하다.

![SSH 설정 파손 복구 흐름](/assets/posts/linux-corrupt-ssh-config-flow.svg)

## 1단계 — 서비스 상태 확인

이미 잠긴 상황이라면 콘솔(또는 클라우드 직렬 콘솔)에서:

```bash
sudo systemctl status sshd
# ● sshd.service - OpenBSD Secure Shell server
#   Loaded: loaded
#   Active: failed (Result: exit-code)
```

실패 메시지에서 에러 원인을 확인한다.

```bash
journalctl -u sshd --since "5 min ago"
# error: /etc/ssh/sshd_config line 42: Bad configuration option: PermitRoootLogin
```

## 2단계 — 문법 검사로 오류 위치 파악

```bash
sudo sshd -t
# /etc/ssh/sshd_config: line 42: Bad configuration option: PermitRoootLogin
```

`sshd -t`는 설정 파일을 로드하고 문법 오류만 검사한 후 종료한다. 실제로 데몬을 시작하지 않으므로 안전하게 사용할 수 있다.

에러 줄 번호를 확인하고 수정한다:

```bash
sudo sed -n '40,44p' /etc/ssh/sshd_config
sudo vim +42 /etc/ssh/sshd_config
```

![SSH 설정 진단 및 복구 명령어](/assets/posts/linux-corrupt-ssh-config-commands.svg)

## 3단계 — 백업에서 복원

오류가 많거나 원래 설정이 필요하면 백업에서 복원한다.

```bash
# 백업에서 복원
sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config

# 패키지 기본 설정으로 초기화 (Debian/Ubuntu)
sudo dpkg-reconfigure openssh-server

# 패키지 재설치 (기본값 복원)
sudo apt reinstall openssh-server   # Debian/Ubuntu
sudo dnf reinstall openssh-server   # RHEL/Rocky
```

## 4단계 — 호스트 키 문제 처리

sshd가 시작되지만 클라이언트에서 "WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!" 메시지가 나오면 서버의 호스트 키가 바뀐 것이다.

```bash
# 호스트 키 확인
ls -la /etc/ssh/ssh_host_*
# 권한이 600 (소유자 root만 읽기)이어야 함

# 호스트 키 권한 복구
sudo chmod 600 /etc/ssh/ssh_host_*_key
sudo chmod 644 /etc/ssh/ssh_host_*_key.pub
sudo chown root:root /etc/ssh/ssh_host_*

# 호스트 키 전체 재생성 (기존 키 모두 삭제 후 재생성)
sudo ssh-keygen -A
```

클라이언트에서 known_hosts 초기화:

```bash
ssh-keygen -R server_ip
ssh-keygen -R server_hostname
```

## 5단계 — sshd 재시작 및 포트 확인

```bash
sudo systemctl restart sshd
sudo systemctl status sshd

# sshd가 포트를 리슨하는지 확인
ss -tlnp | grep :22
# 출력: LISTEN  0  128  0.0.0.0:22  *:*  users:(("sshd",pid=...))
```

## 클라우드 VM — 직렬 콘솔 접근

SSH가 완전히 차단됐을 때 클라우드 직렬 콘솔로 접근한다:
- AWS: EC2 Instance Connect (브라우저 기반 SSH) 또는 Systems Manager Session Manager
- GCP: gcloud compute ssh --tunnel-through-iap 또는 직렬 콘솔
- Azure: Azure Bastion 또는 직렬 콘솔

## 자주 발생하는 설정 오류 패턴

```bash
# 자주 틀리는 설정 예
PermitRootLogin prohibit-password   # 올바른 값
PermitRootLogin prohibit_password   # 언더스코어 오류 → 거부

# 허용 목록 형식 오류
AllowUsers alice bob             # 올바름 (공백 구분)
AllowUsers alice,bob             # 콤마 구분 불가 → 거부

# 포트 설정 오류
Port 22222                       # 방화벽 허용 없으면 차단됨
```

## 사고 후 재발 방지

```bash
# systemd의 조건부 재시작 활용
# sshd_config 변경 후 테스트가 실패하면 자동으로 이전 설정 복원
sudo sshd -t && sudo systemctl reload sshd || sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
```

또는 `ExecStartPre=-/usr/sbin/sshd -t`를 서비스 파일에 추가하면 문법 오류 시 sshd가 시작을 거부해 명시적 에러를 남긴다.

SSH 설정 파손 복구의 핵심은 **편집 전 백업 + sshd -t 검사 + 기존 세션 유지** 세 가지 습관이다. 이미 잠긴 후라면 콘솔 접근이 유일한 탈출구이므로, 중요 서버는 항상 콘솔 접근 수단을 미리 확인해 두어야 한다.

---

**지난 글:** [파일 시스템 읽기 전용 복구](/posts/linux-fs-readonly-recover/)

<br>
읽어주셔서 감사합니다. 😊
