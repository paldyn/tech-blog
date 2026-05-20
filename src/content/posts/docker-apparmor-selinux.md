---
title: "Docker AppArmor/SELinux: 강제 접근 제어 적용"
description: "AppArmor와 SELinux를 이용해 컨테이너 프로세스의 파일 접근을 커널 레벨에서 제한하는 방법, Docker 기본 프로파일 구조, 커스텀 AppArmor 프로파일 작성, SELinux 컨테이너 레이블 설정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "apparmor", "selinux", "MAC", "보안", "접근제어"]
featured: false
draft: false
---

[지난 글](/posts/docker-seccomp-profile/)에서 seccomp로 허용 syscall을 제한하는 방법을 다뤘다. 이번에는 **강제 접근 제어(MAC, Mandatory Access Control)**를 제공하는 AppArmor와 SELinux를 컨테이너에 적용하는 방법을 살펴본다. 이 두 메커니즘은 root 권한이 있어도 정책 범위 밖의 파일에 접근하지 못하도록 커널이 강제한다.

## 강제 접근 제어(MAC)란

일반 Unix 권한(DAC, Discretionary Access Control)은 파일 소유자가 권한을 설정하고, root는 어떤 파일이든 접근할 수 있다. MAC은 이와 달리 **커널 정책**이 프로세스의 접근을 강제로 제한한다. root라도 정책이 허용하지 않으면 접근이 차단된다.

```bash
# DAC: root는 모든 파일 접근 가능
docker exec --user root mycontainer cat /etc/shadow   # 성공

# MAC(AppArmor): 프로파일에 /etc/shadow 접근 불허 시
# docker exec --user root mycontainer cat /etc/shadow  # 차단됨
```

![AppArmor vs SELinux 비교](/assets/posts/docker-apparmor-selinux-compare.svg)

## Docker 기본 AppArmor 프로파일

Docker는 컨테이너에 `docker-default` AppArmor 프로파일을 자동으로 적용한다(Ubuntu/Debian 계열).

```bash
# 현재 컨테이너의 AppArmor 프로파일 확인
docker inspect mycontainer | \
  python3 -c "import sys,json; c=json.load(sys.stdin)[0]; \
  print(c['AppArmorProfile'])"
# → docker-default

# 호스트에 로드된 AppArmor 프로파일 목록
aa-status
# → docker-default (enforce mode)

# docker-default 프로파일 내용 확인
cat /etc/apparmor.d/docker
```

`docker-default` 프로파일은 `/proc/sysrq-trigger`, `/proc/kcore`, `/sys` 일부에 대한 쓰기를 차단하고 마운트 작업을 제한한다.

## 커스텀 AppArmor 프로파일

더 강한 제한이 필요하면 커스텀 프로파일을 작성한다.

```bash
# 프로파일 파일 생성
cat > /etc/apparmor.d/docker-myapp << 'EOF'
#include <tunables/global>

profile docker-myapp flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>

  # 네트워크 허용
  network inet tcp,
  network inet udp,

  # 앱 코드 읽기 전용
  /app/** r,
  /app/uploads/** rw,       # 업로드 디렉터리만 쓰기 가능
  /tmp/** rw,
  /run/** rw,

  # 바이너리 실행 허용
  /usr/local/bin/node rix,
  /usr/bin/* rix,

  # 민감 경로 명시적 차단
  deny /proc/sysrq-trigger rwklx,
  deny /proc/mem rwklx,
  deny /proc/kcore rwklx,
  deny /sys/** wklx,
  deny /etc/cron.d/** w,

  # 마운트 차단
  deny mount,
}
EOF

# 프로파일 로드
apparmor_parser -r -W /etc/apparmor.d/docker-myapp

# 컨테이너에 적용
docker run \
  --security-opt apparmor=docker-myapp \
  myapp:latest
```

![AppArmor 프로파일 작성 및 적용](/assets/posts/docker-apparmor-selinux-profile.svg)

## complain 모드로 테스트

새 프로파일을 enforce 모드로 바로 적용하면 앱이 중단될 수 있다. complain 모드로 먼저 테스트한다.

```bash
# complain 모드로 전환 (차단하지 않고 로그만)
aa-complain /etc/apparmor.d/docker-myapp

# 앱 실행 후 위반 로그 확인
tail -f /var/log/syslog | grep apparmor
# → apparmor="ALLOWED" operation="open" profile="docker-myapp" name="/etc/hosts" ...

# 위반 없으면 enforce 모드로 전환
aa-enforce /etc/apparmor.d/docker-myapp
```

## aa-genprof로 프로파일 자동 생성

```bash
# 프로파일 생성 시작 (앱 실행 경로 지정)
aa-genprof /usr/local/bin/myapp

# 별도 터미널에서 앱 실행
docker run --security-opt apparmor=unconfined myapp:latest

# 생성된 프로파일 확인 및 수정
# 완료 후 'F(inish)'로 저장
```

## SELinux Docker 설정

SELinux는 RHEL/Fedora/CentOS에서 기본 활성화된다.

```bash
# SELinux 상태 확인
getenforce
# → Enforcing / Permissive / Disabled

# 컨테이너에 SELinux 레이블 적용
docker run \
  --security-opt label=type:container_t \
  myapp:latest

# 볼륨 마운트 시 SELinux 레이블 자동 설정 (:z)
docker run \
  -v /host/data:/app/data:z \    # 공유 레이블 적용
  myapp:latest

# 특정 컨테이너 전용 레이블 (:Z)
docker run \
  -v /host/data:/app/data:Z \   # 컨테이너 전용 레이블
  myapp:latest
```

`:z`와 `:Z`의 차이를 이해하는 것이 중요하다. `:z`는 여러 컨테이너가 공유할 수 있는 레이블을 설정하고, `:Z`는 해당 컨테이너만 접근할 수 있는 레이블을 설정한다.

## SELinux 거부 로그 분석

```bash
# SELinux 거부 로그
ausearch -m avc -ts recent
# → type=AVC msg=audit: avc: denied { read } for pid=...

# 거부 원인 분석
audit2why < /var/log/audit/audit.log

# 임시 허용 규칙 생성 (테스트용)
audit2allow -a -M mypol
semodule -i mypol.pp
```

## SELinux Permissive 모드로 테스트

```bash
# 전체 시스템 permissive (차단하지 않고 로그만)
setenforce 0

# 특정 도메인만 permissive
semanage permissive -a container_t
```

## Compose 설정

```yaml
services:
  web:
    image: myapp:latest
    security_opt:
      - apparmor=docker-myapp          # AppArmor 프로파일
      # SELinux 환경에서는:
      # - label=type:container_t
      # - label=level:s0:c100,c200
    volumes:
      - /host/data:/app/data:Z         # SELinux 레이블
```

## 보안 레이어 조합

AppArmor/SELinux는 다른 보안 메커니즘과 함께 사용할 때 최대 효과를 발휘한다.

| 레이어 | 도구 | 보호 대상 |
|--------|------|-----------|
| 사용자 | `USER` / `--user` | UID 권한 |
| 파일 시스템 | `--read-only` / tmpfs | 파일 변조 |
| 시스템 호출 | seccomp | syscall 남용 |
| Capability | `--cap-drop` | 커널 권한 |
| MAC | AppArmor/SELinux | 파일 접근 정책 |

이 다섯 레이어를 모두 적용하면 컨테이너 탈출 시나리오 대부분을 차단할 수 있다.

## Docker Desktop (Mac/Windows)에서

Docker Desktop은 LinuxKit VM에서 실행되므로 AppArmor/SELinux는 기본 비활성화다. 맥/윈도우 개발 환경에서는 seccomp와 capability 설정에 집중하고, AppArmor/SELinux는 Linux 프로덕션 환경에서 적용한다.

---

**지난 글:** [Docker seccomp 프로파일: 허용 syscall 화이트리스트](/posts/docker-seccomp-profile/)

**다음 글:** [Docker Rootless Mode: daemon 자체를 비루트로 실행](/posts/docker-rootless-security/)

<br>
읽어주셔서 감사합니다. 😊
