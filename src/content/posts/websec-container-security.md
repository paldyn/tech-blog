---
title: "컨테이너 보안: Docker·Kubernetes 취약점과 방어 전략"
description: "Dockerfile 하드닝, 비루트 컨테이너, 이미지 서명·스캔, K8s RBAC, NetworkPolicy, Pod Security Admission, 컨테이너 탈출 방어까지 실전 설정을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["컨테이너보안", "Docker", "Kubernetes", "RBAC", "PodSecurity", "이미지스캔"]
featured: false
draft: false
---

[지난 글](/posts/websec-web-application-firewall/)에서 WAF의 원리와 배포 전략을 살펴봤다. 이번 글은 컨테이너 환경 특유의 보안 위협과 Docker·Kubernetes 하드닝 방법을 다룬다.

![컨테이너 보안 위협 모델](/assets/posts/websec-container-security-threats.svg)

## 컨테이너 보안이 특별한 이유

컨테이너는 VM과 달리 호스트 커널을 공유한다. 컨테이너가 탈출(escape)에 성공하면 호스트 전체를 장악할 수 있다. 또한 이미지는 레이어로 쌓이기 때문에 중간 레이어에 남긴 시크릿이 `docker history`로 노출된다.

주요 공격 경로:

- **이미지 취약점**: 공개 레지스트리의 베이스 이미지에 포함된 CVE
- **과도한 권한**: `--privileged` 플래그 또는 root 실행으로 컨테이너 탈출 가능
- **시크릿 노출**: `ENV DB_PASS=...` 하드코딩 또는 빌드 레이어 잔류
- **etcd 무인증 노출**: K8s 클러스터 시크릿 전체 탈취

## Dockerfile 하드닝

![Dockerfile 취약 vs 보안 강화 비교](/assets/posts/websec-container-security-hardening.svg)

핵심 원칙 4가지:

**1. 다이제스트로 베이스 이미지 고정**

```dockerfile
# 취약: latest는 언제든 변경될 수 있음
FROM python:3.12-slim

# 안전: SHA-256 다이제스트로 정확한 버전 고정
FROM python:3.12-slim@sha256:a1b2c3d4e5f6...
```

**2. 비루트 사용자로 실행**

```dockerfile
RUN groupadd -r appgroup && useradd -r -g appgroup -u 1001 appuser
COPY --chown=appuser:appgroup . /app
WORKDIR /app
USER appuser
```

**3. 멀티 스테이지 빌드로 공격 표면 최소화**

```dockerfile
# 빌드 스테이지 (컴파일러, 도구 포함)
FROM golang:1.22 AS builder
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o app .

# 실행 스테이지 (최소 이미지)
FROM gcr.io/distroless/static-debian12
COPY --from=builder /src/app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

Distroless 이미지에는 셸, 패키지 매니저가 없어 공격자가 명령을 실행할 수 없다.

**4. 시크릿을 이미지에 넣지 않기**

```bash
# 잘못된 방법: 이미지 레이어에 시크릿 남음
RUN curl -H "Authorization: Bearer $TOKEN" https://api.example.com/config

# 올바른 방법: 런타임에 환경 변수로 주입
# docker-compose.yml
environment:
  - DB_PASSWORD_FILE=/run/secrets/db_password
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

## Kubernetes 보안 설정

### Pod Security Context

```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: myapp:1.2.3@sha256:abc...
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]  # 필요한 경우만
    resources:
      limits:
        memory: "256Mi"
        cpu: "500m"
```

### NetworkPolicy: 기본 거부 정책

```yaml
# 네임스페이스 내 모든 인그레스/이그레스 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
# 필요한 연결만 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
spec:
  podSelector:
    matchLabels:
      app: backend
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
```

### RBAC 최소 권한

```yaml
# ServiceAccount에 필요한 권한만 부여
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]  # create/delete/patch 금지
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
subjects:
- kind: ServiceAccount
  name: my-app-sa
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

## 이미지 취약점 스캔

```bash
# Trivy로 이미지 스캔
trivy image --severity HIGH,CRITICAL \
  --exit-code 1 \
  myapp:latest

# CI/CD 파이프라인 통합 (GitHub Actions)
# .github/workflows/security.yml
- name: Scan image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}
    format: sarif
    exit-code: 1
    severity: CRITICAL,HIGH

# Grype로 SBOM 기반 스캔
grype myapp:latest --fail-on high
```

## 컨테이너 런타임 보안

```bash
# Falco 실시간 이상 탐지 규칙 예시
# /etc/falco/falco_rules.yaml
- rule: Container Shell
  desc: 컨테이너 내부에서 셸이 실행됨
  condition: >
    spawned_process and
    container and
    proc.name in (shell_binaries)
  output: >
    Shell spawned in container
    (user=%user.name container=%container.name
     cmd=%proc.cmdline)
  priority: WARNING

# 실행 중 특권 마운트 감지
- rule: Mount Sensitive Host Path
  condition: >
    mount and
    (evt.arg.dev startswith "/dev" or
     evt.arg.target in ("/etc", "/proc", "/sys"))
  priority: CRITICAL
```

---

**지난 글:** [WAF: 웹 애플리케이션 방화벽 원리, 배포 전략, 우회 방어](/posts/websec-web-application-firewall/)

**다음 글:** [클라우드 IAM 잘못된 설정: 과도한 권한과 방어 전략](/posts/websec-cloud-iam-misconfig/)

<br>
읽어주셔서 감사합니다. 😊
