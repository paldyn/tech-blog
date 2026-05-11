---
title: "불변 파일 — 시스템 파일을 침입자로부터 보호"
description: "chattr +i로 불변 속성을 설정해 중요 파일을 보호하는 전략, 읽기 전용 마운트, systemd ProtectSystem, 불변 파일 운영 시 주의사항과 CI/CD 통합 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "immutable", "chattr", "security", "hardening", "filesystem", "read-only"]
featured: false
draft: false
---

[지난 글](/posts/linux-attributes-chattr/)에서 `chattr`로 파일 속성을 제어하는 방법을 배웠습니다. 이번에는 **불변 파일(Immutable File)** 개념을 더 깊이 파고들어, 시스템 하드닝의 관점에서 어떤 파일을 보호해야 하고, 어떻게 운영 자동화와 병행할지 살펴봅니다.

## 불변 파일이란

불변 파일은 `chattr +i` 속성이 걸린 파일입니다. 이 속성이 있으면:

- **수정 불가** — 파일 내용 변경 차단
- **삭제 불가** — `rm`으로 삭제 안 됨
- **이름 변경 불가** — `mv`로 이름 바꾸기 차단
- **하드 링크 생성 불가**
- **root도 적용됨** — `sudo rm`도 실패

```bash
# 불변 설정
sudo chattr +i /etc/ssh/sshd_config

# root가 삭제 시도
sudo rm /etc/ssh/sshd_config
# rm: cannot remove '/etc/ssh/sshd_config': Operation not permitted

# 수정 시도
sudo echo "test" > /etc/ssh/sshd_config
# -bash: /etc/ssh/sshd_config: Operation not permitted

# 속성 확인
lsattr /etc/ssh/sshd_config
# ----i---------e-- /etc/ssh/sshd_config
```

## 왜 불변 파일이 필요한가

권한 시스템만으로는 부족한 경우가 있습니다.

1. **root 탈취 시나리오**: 공격자가 root를 획득해도 `+i` 파일은 못 건드림
2. **잘못된 스크립트**: 실수로 시스템 파일 덮어쓰는 배포 스크립트 방지
3. **악성 소프트웨어**: 설치된 악성코드가 설정 파일 변조 방지
4. **감사 증거 보존**: 로그 파일을 추가 전용(`+a`)으로 설정해 증거 훼손 방지

![불변 파일 보호 계층](/assets/posts/linux-immutable-defense-layers.svg)

## 보호해야 할 파일 목록

```bash
# SSH 서버 설정
sudo chattr +i /etc/ssh/sshd_config

# 권한 상승 설정
sudo chattr +i /etc/sudoers
sudo chattr +i -R /etc/sudoers.d/

# PAM 인증 설정
sudo chattr +i /etc/pam.d/su
sudo chattr +i /etc/pam.d/sudo

# 커널 파라미터
sudo chattr +i /etc/sysctl.conf

# 중요 시스템 바이너리 (패키지 관리와 충돌 주의)
# sudo chattr +i /usr/bin/sudo   ← 신중히 결정

# 감사 로그 (추가 전용)
sudo chattr +a /var/log/auth.log
sudo chattr +a /var/log/syslog
sudo chattr +a /var/log/audit/audit.log
```

## 읽기 전용 마운트 — 파티션 레벨 보호

`chattr +i`는 개별 파일 수준 보호입니다. `/boot` 같은 파티션 전체를 보호하려면 읽기 전용 마운트를 씁니다.

![읽기 전용 마운트 및 불변 파일 명령어](/assets/posts/linux-immutable-ro-mount.svg)

```bash
# 부트 파티션을 ro로 재마운트
sudo mount -o remount,ro /boot

# /etc/fstab에 영구 설정
# /dev/sda1  /boot  ext4  ro,noexec,nosuid  0 1

# 업데이트 전 일시적으로 rw로
sudo mount -o remount,rw /boot
sudo apt upgrade
sudo mount -o remount,ro /boot
```

## systemd 서비스 파일시스템 격리

서비스 단위에서 `ProtectSystem`으로 서비스 프로세스의 쓰기 접근을 제한할 수 있습니다.

```ini
[Service]
# strict: /usr, /boot, /etc 읽기 전용
ProtectSystem=strict

# 특정 경로만 쓰기 허용
ReadWritePaths=/var/lib/myapp

# 홈 디렉터리 보호
ProtectHome=true
```

이 설정은 서비스가 탈취되더라도 `/etc`를 수정하지 못하게 합니다.

## 운영 자동화와 병행하기

불변 파일은 패키지 업데이트·배포 자동화와 충돌할 수 있습니다. 안전한 패턴:

```bash
#!/bin/bash
# deploy.sh — 배포 스크립트 예시

PROTECTED_FILES=(
    /etc/ssh/sshd_config
    /etc/sudoers
    /etc/sysctl.conf
)

# 1. 불변 속성 해제
for f in "${PROTECTED_FILES[@]}"; do
    sudo chattr -i "$f"
done

# 2. 업데이트 작업 수행
sudo apt upgrade -y
# ... 설정 파일 배포 ...

# 3. 불변 속성 재설정
for f in "${PROTECTED_FILES[@]}"; do
    sudo chattr +i "$f"
done

echo "배포 완료. 불변 속성 복원 완료."
```

## 불변 파일 감사

```bash
# 시스템 전체 불변 파일 목록
sudo find / -xdev -exec lsattr -d {} \; 2>/dev/null \
    | grep '\-\-\-\-i'

# 또는
sudo lsattr -R / 2>/dev/null | grep '^....i'
```

정기적으로 실행해 예상치 못한 불변 파일이 생기지 않았는지 확인하세요. 공격자가 영구화(persistence)를 위해 `+i`를 역으로 악용하기도 합니다.

## 권한 시리즈 마무리

지금까지 리눅스 권한 시스템의 전 계층을 살펴봤습니다.

| 계층 | 도구 | 역할 |
|------|------|------|
| 기본 권한 | chmod, chown | 소유자·그룹·기타 rwx |
| 기본 권한 마스크 | umask | 신규 파일 기본값 |
| 특수 비트 | SUID/SGID/Sticky | 권한 상승·공유 폴더 |
| 세밀한 제어 | ACL (setfacl) | 사용자별 차등 권한 |
| 파일 속성 | chattr | root도 차단하는 추가 보호 |
| 마운트 수준 | ro mount, ProtectSystem | 파티션·서비스 격리 |

이 계층들을 조합해 **심층 방어(Defence in Depth)**를 구현하는 것이 리눅스 보안의 핵심입니다.

---

**지난 글:** [chattr — 파일 속성으로 추가 보호](/posts/linux-attributes-chattr/)

<br>
읽어주셔서 감사합니다. 😊
