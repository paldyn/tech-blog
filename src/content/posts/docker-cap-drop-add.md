---
title: "Docker cap-drop/add: Linux Capability 최소화"
description: "Linux Capability 개념, 컨테이너 기본 capability 집합, --cap-drop ALL로 전체 제거 후 필요한 것만 추가하는 최소 권한 패턴, 앱 유형별 권장 설정을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "capability", "cap-drop", "cap-add", "보안", "권한최소화"]
featured: false
draft: false
---

[지난 글](/posts/docker-readonly-rootfs/)에서 파일 시스템 불변성으로 공격자의 파일 변조를 막는 방법을 다뤘다. 이번에는 **Linux Capability**를 다룬다. 컨테이너가 커널에게 요청할 수 있는 권한 목록을 최소화하면 exploit이 성공하더라도 할 수 있는 일이 제한된다.

## Linux Capability란

전통적인 Unix 권한 모델은 root(UID 0)와 non-root로 이분된다. root는 모든 권한을 갖는다. Linux Capability는 이 "모든 권한"을 약 40개의 독립된 단위로 쪼갠다.

```bash
# 현재 프로세스의 capability 확인
cat /proc/1/status | grep Cap
# CapInh: 00000000000005fb
# CapPrm: 00000000000005fb
# CapEff: 00000000000005fb

# capability 비트마스크 해석
capsh --decode=00000000000005fb
# → cap_chown, cap_dac_override, cap_fowner, cap_kill, cap_net_bind_service...
```

## 컨테이너 기본 Capability

Docker는 컨테이너에 약 14개의 기본 capability를 부여한다. 전체 호스트 root 권한(~40개)보다 적지만 여전히 일부는 위험하다.

![Docker 기본 Capability 집합](/assets/posts/docker-cap-drop-add-overview.svg)

`NET_RAW`는 raw 소켓을 열어 ARP 스푸핑이나 ICMP 플러딩에 악용될 수 있다. `MKNOD`는 디바이스 노드를 만들 수 있어 /dev/sda 같은 블록 장치 접근이 가능해진다. 대부분의 웹 앱은 이 두 capability가 필요 없다.

## --cap-drop과 --cap-add

```bash
# 특정 capability 제거
docker run --cap-drop=NET_RAW myapp

# 여러 개 제거
docker run --cap-drop=NET_RAW --cap-drop=MKNOD --cap-drop=AUDIT_WRITE myapp

# 전체 제거
docker run --cap-drop=ALL myapp

# 전체 제거 후 필요한 것만 추가 (권장 패턴)
docker run --cap-drop=ALL --cap-add=CHOWN --cap-add=SETUID myapp

# 현재 컨테이너의 effective capabilities 확인
docker exec mycontainer sh -c "cat /proc/1/status | grep CapEff"
```

## 현재 컨테이너 capability 확인

```bash
# capsh로 capability 목록 확인
docker exec mycontainer sh -c \
  "apk add -q libcap && capsh --print 2>/dev/null | grep 'Current:'"

# 또는 /proc 직접 확인
docker exec mycontainer sh -c \
  "cat /proc/1/status | grep Cap"

# inspect로 추가/삭제된 capability 확인
docker inspect mycontainer | \
  python3 -c "import sys,json; c=json.load(sys.stdin)[0]; \
  print('Add:', c['HostConfig']['CapAdd']); \
  print('Drop:', c['HostConfig']['CapDrop'])"
```

## 최소 권한 패턴: --cap-drop=ALL

가장 안전한 접근법은 전체 capability를 제거한 후 필요한 것만 추가하는 것이다.

```bash
# 비루트 사용자, 고번호 포트 앱 — capability 불필요
docker run \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --user=1000:1000 \
  --read-only \
  myapp:latest
```

![cap-drop/add 실전 패턴](/assets/posts/docker-cap-drop-add-examples.svg)

## 앱 유형별 최소 Capability

### 일반 웹 앱 (비루트 + 8080 포트)

```yaml
services:
  web:
    image: myapp:latest
    user: "1000:1000"
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
```

비루트 사용자와 고번호 포트를 사용하면 capability가 전혀 필요 없다.

### Nginx (80 포트)

```yaml
services:
  nginx:
    image: nginx:alpine
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE   # 80 포트 바인딩
      - CHOWN              # 파일 소유자 변경
      - SETUID             # worker 프로세스 UID 변경
      - SETGID             # worker 프로세스 GID 변경
      - DAC_OVERRIDE       # 파일 권한 우회 (일부 버전 필요)
```

### cron을 사용하는 앱

```bash
docker run \
  --cap-drop=ALL \
  --cap-add=SETUID \
  --cap-add=SETGID \
  --cap-add=SYS_NICE \    # cron: nice 값 조정
  myapp-with-cron
```

### 네트워크 진단 도구 포함

```bash
docker run \
  --cap-drop=ALL \
  --cap-add=NET_RAW \      # ping, traceroute
  network-tools:latest
```

## privileged 플래그는 사용하지 않는다

```bash
# 절대 하지 말 것
docker run --privileged myapp

# --privileged는 모든 capability를 부여하고
# 디바이스 접근, AppArmor/Seccomp 비활성화까지 한다
# → 컨테이너 탈출 거의 보장된 상황이 됨
```

`--privileged`가 필요한 것처럼 보이는 경우, 실제로 어떤 capability가 필요한지 파악해 그것만 추가한다.

## Capability 문제 디버깅

```bash
# 앱이 "Operation not permitted" 오류를 낼 때
# strace로 어떤 syscall이 실패하는지 확인
docker run --cap-add=SYS_PTRACE myapp strace -e trace=process myapp-binary

# 또는 audit 로그 확인 (호스트에서)
dmesg | grep "avc: denied"
ausearch -m avc -ts recent
```

## 특정 Capability 필요 여부 판단

```bash
# 프로그램이 실제로 필요한 capability를 파일 속성으로 확인
getcap /usr/bin/ping
# → /usr/bin/ping = cap_net_raw+ep

# 실행 파일에 capability 부여 (capability 추가 대신 파일에 부여)
setcap cap_net_bind_service=+ep /usr/local/bin/myapp
```

파일에 capability를 부여하면 컨테이너 전체에 `--cap-add`를 주는 것보다 범위가 작다. 단, Dockerfile에서 `RUN setcap ...`을 실행하려면 `cap_setfcap` capability가 필요하다.

## Kubernetes SecurityContext 연동

```yaml
spec:
  containers:
  - name: web
    securityContext:
      capabilities:
        drop:
          - ALL
        add:
          - NET_BIND_SERVICE
          - CHOWN
      allowPrivilegeEscalation: false
      runAsNonRoot: true
```

---

**지난 글:** [Docker 읽기 전용 루트 파일 시스템: --read-only 완전 활용](/posts/docker-readonly-rootfs/)

**다음 글:** [Docker seccomp 프로파일: 허용 syscall 화이트리스트](/posts/docker-seccomp-profile/)

<br>
읽어주셔서 감사합니다. 😊
