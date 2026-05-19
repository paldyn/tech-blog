---
title: "Docker 보안 개요: 컨테이너 보안의 핵심 원칙"
description: "Docker 보안의 5개 레이어(호스트·daemon·이미지·런타임·앱), 네임스페이스와 cgroup 격리 한계, 프로덕션 보안 체크리스트, 각 보안 주제의 로드맵을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "보안", "namespace", "cgroup", "rootless", "cap-drop", "seccomp"]
featured: false
draft: false
---

[지난 글](/posts/docker-disk-cleanup/)에서 Docker 디스크를 효율적으로 관리하는 방법을 정리했다. 이번에는 Docker 보안의 전체 그림을 그려본다. "컨테이너는 VM이 아니다"는 말의 의미, 어떤 격리가 제공되고 어떤 것은 제공되지 않는지, 그리고 실전에서 무엇을 챙겨야 하는지를 다룬다.

## 컨테이너는 격리된 프로세스다

Docker 컨테이너는 가상 머신이 아니다. 호스트 커널을 공유하며 실행되는 **격리된 프로세스 그룹**이다. 격리는 Linux 커널의 두 가지 메커니즘으로 구현된다.

**네임스페이스(Namespaces)** — 프로세스가 보는 시스템 뷰를 분리한다. PID 네임스페이스(컨테이너 안에서 PID 1이 보임), 네트워크 네임스페이스(독립적인 네트워크 스택), 마운트 네임스페이스(독립적인 파일 시스템 트리), UTS(호스트명 분리), IPC, 사용자 네임스페이스(UID 매핑)가 있다.

**cgroup** — CPU, 메모리, I/O 등 리소스 사용량을 제한하고 계측한다.

이 격리는 강력하지만 완벽하지 않다. 커널을 공유하므로 **커널 취약점은 컨테이너를 탈출할 수 있다**. VM처럼 하이퍼바이저 레이어가 없다.

## 보안의 5개 레이어

Docker 보안은 단일 도구로 해결하는 것이 아니라 여러 레이어를 겹쳐 방어 깊이(defense in depth)를 만드는 것이다.

![Docker 보안 레이어](/assets/posts/docker-security-overview-layers.svg)

**① 호스트 OS 보안** — 모든 것의 기반이다. 커널을 최신으로 유지하고, SELinux 또는 AppArmor를 활성화하며, 호스트에 접근하는 사용자를 최소화한다.

**② Docker daemon 보안** — daemon은 root로 실행된다. Docker socket(`/var/run/docker.sock`)에 접근할 수 있으면 root와 동등한 권한을 얻는다. TLS 원격 API 보호, rootless mode, socket 파일 권한 관리가 중요하다.

**③ 이미지 보안** — 신뢰할 수 있는 이미지를 사용하고, 취약점을 스캔하며, 불필요한 패키지와 파일을 제거한다. 빌드 과정에서 시크릿이 레이어에 포함되지 않도록 한다.

**④ 컨테이너 런타임 보안** — 비루트 사용자로 실행하고, read-only 루트 파일 시스템을 사용하며, Linux capability를 최소화하고, seccomp 프로파일로 허용할 syscall을 제한한다.

**⑤ 애플리케이션 보안** — 시크릿 관리, 네트워크 격리, 최소 포트 노출, 의존성 취약점 관리가 포함된다.

## 가장 중요한 기본 설정

### 비루트 사용자로 실행

```dockerfile
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
COPY --chown=app:app . .
CMD ["node", "server.js"]
```

대부분의 공식 이미지는 이미 비루트 사용자를 제공한다(`node`, `nginx` 등의 사용자명으로).

### Docker socket 마운트 금지

```yaml
# 절대 하지 말 것
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

이 마운트는 컨테이너에 호스트 root 권한과 동등한 접근을 준다.

### --no-new-privileges

```bash
docker run --security-opt=no-new-privileges myimage
```

setuid/setgid 바이너리를 통한 권한 상승을 막는다.

### 읽기 전용 루트 파일 시스템

```bash
docker run --read-only --tmpfs /tmp --tmpfs /run myimage
```

앱이 파일을 써야 하는 경로는 `--tmpfs`로 메모리에 마운트한다.

## 이미지 취약점 스캔

```bash
# Docker Scout (Docker 공식)
docker scout cves myimage:latest
docker scout quickview myimage:latest

# Trivy (오픈소스, CI에 통합하기 좋음)
trivy image myimage:latest
trivy image --severity HIGH,CRITICAL myimage:latest
```

CI 파이프라인에 취약점 스캔을 포함시켜 새로운 CVE가 있는 이미지가 프로덕션에 배포되는 것을 막는다.

## 네트워크 격리

컨테이너를 기본 bridge 네트워크에 모두 연결하면 같은 네트워크의 모든 컨테이너가 서로 통신할 수 있다. 서비스별로 전용 네트워크를 만들고 필요한 컨테이너만 연결한다.

```yaml
services:
  web:
    networks: [frontend, backend]
  api:
    networks: [backend]
  db:
    networks: [backend]   # web은 db에 직접 접근 불가

networks:
  frontend:
  backend:
    internal: true   # 외부 인터넷 차단
```

## 프로덕션 보안 체크리스트

![프로덕션 보안 체크리스트](/assets/posts/docker-security-overview-checklist.svg)

## 이후 주제 로드맵

이 시리즈에서 각 보안 주제를 깊이 다룬다.

- **비루트 사용자** — USER 지시어, 권한 문제 해결
- **Docker secrets** — 시크릿을 환경변수 대신 안전하게 관리
- **Content Trust** — 이미지 서명으로 공급망 공격 방지
- **이미지 스캔** — Trivy, Docker Scout 통합
- **read-only rootfs** — 파일 시스템 변경 방지
- **cap-drop/add** — Linux capability 최소화
- **seccomp 프로파일** — 허용 syscall 화이트리스트
- **AppArmor/SELinux** — 강제 접근 제어
- **Rootless Docker** — daemon 자체를 비루트로 실행

---

**지난 글:** [Docker 디스크 정리: 공간 확보 완전 가이드](/posts/docker-disk-cleanup/)

**다음 글:** [Docker 비루트 사용자: 컨테이너 권한 최소화](/posts/docker-non-root-user/)

<br>
읽어주셔서 감사합니다. 😊
