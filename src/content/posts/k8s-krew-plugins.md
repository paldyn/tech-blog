---
title: "kubectl 플러그인 매니저 krew 완전 정리"
description: "kubectl 플러그인 매니저 krew 설치 방법과 ctx, ns, neat, stern, view-secret 등 실무에서 필수인 인기 플러그인 사용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "kubectl", "krew", "plugins", "ctx", "stern", "neat"]
featured: false
draft: false
---

[지난 글](/posts/k8s-declarative-vs-imperative/)에서 선언형과 명령형의 철학적 차이를 살펴봤다. 이번 글은 kubectl의 생산성을 크게 높여주는 **플러그인 매니저 krew**와 실무에서 매일 사용하게 되는 필수 플러그인들을 소개한다. krew는 K8s 공식 SIG-CLI 프로젝트로, 250개 이상의 커뮤니티 플러그인을 apt/brew처럼 관리한다.

## krew 설치

```bash
# 공식 설치 스크립트 (Linux/macOS)
(
  set -x; cd "$(mktemp -d)" &&
  OS="$(uname | tr '[:upper:]' '[:lower:]')" &&
  ARCH="$(uname -m | sed -e 's/x86_64/amd64/' -e 's/\(arm\)\(64\)\?.*/\1\2/' -e 's/aarch64$/arm64/')" &&
  KREW="krew-${OS}_${ARCH}" &&
  curl -fsSLO "https://github.com/kubernetes-sigs/krew/releases/latest/download/${KREW}.tar.gz" &&
  tar zxvf "${KREW}.tar.gz" &&
  ./"${KREW}" install krew
)

# PATH에 추가 (~/.bashrc 또는 ~/.zshrc)
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

# 설치 확인
kubectl krew version
```

krew 자체도 kubectl 플러그인으로 동작한다. `kubectl krew` 명령으로 플러그인을 관리한다.

![krew 설치 및 플러그인 관리](/assets/posts/k8s-krew-plugins-install.svg)

## 플러그인 관리 기본 명령어

```bash
# 플러그인 검색
kubectl krew search ctx
kubectl krew search     # 전체 목록

# 플러그인 설치
kubectl krew install ctx ns neat stern view-secret

# 설치된 플러그인 목록
kubectl krew list

# 플러그인 정보
kubectl krew info stern

# 전체 업그레이드
kubectl krew upgrade

# 플러그인 제거
kubectl krew uninstall neat

# krew 자체 업그레이드
kubectl krew upgrade krew
```

## 필수 플러그인 상세 소개

![꼭 설치해야 할 인기 플러그인](/assets/posts/k8s-krew-plugins-list.svg)

### ctx: 빠른 context 전환

```bash
# 설치
kubectl krew install ctx

# 인터랙티브 context 선택 (fzf 필요)
kubectl ctx

# 직접 전환
kubectl ctx prod-cluster

# 이전 context로
kubectl ctx -

# 현재 context 표시
kubectl ctx current
```

fzf가 설치되어 있으면 목록에서 화살표로 선택 가능하다. `brew install fzf`로 먼저 설치하면 된다.

### ns: 네임스페이스 전환

```bash
# 설치
kubectl krew install ns

# 인터랙티브 네임스페이스 선택
kubectl ns

# 직접 전환
kubectl ns kube-system

# 이전 네임스페이스로
kubectl ns -
```

전환 후에는 kubectl 명령에 `-n` 플래그 없이도 해당 네임스페이스를 대상으로 동작한다.

### neat: 깔끔한 YAML 출력

```bash
# 설치
kubectl krew install neat

# 기본 사용 (파이프)
kubectl get pod my-pod -o yaml | kubectl neat

# Deployment의 불필요 필드 제거
kubectl get deployment my-app -o yaml | kubectl neat > my-app-clean.yaml
```

`kubectl get` 출력에는 `managedFields`, `status`, `generation`, `uid` 같은 런타임 필드가 가득하다. neat는 이를 제거해 GitOps에 저장할 깔끔한 YAML을 만들어준다.

### stern: 멀티 파드 로그

```bash
# 설치
kubectl krew install stern

# 레이블로 여러 파드 동시 로그
kubectl stern -l app=nginx

# 이름 패턴으로 (정규식)
kubectl stern "my-app-.*"

# 모든 네임스페이스
kubectl stern ".*" -A

# 특정 컨테이너만
kubectl stern my-app -c sidecar

# 최근 1시간
kubectl stern my-app --since 1h

# 색상 비활성화 (파일 저장용)
kubectl stern my-app --no-color > logs.txt
```

여러 파드의 로그가 파드 이름 색상으로 구분되어 표시된다. 마이크로서비스 디버깅에서 가장 많이 사용하는 도구다.

### view-secret: Secret 디코딩

```bash
# 설치
kubectl krew install view-secret

# 모든 키 디코딩
kubectl view-secret my-secret

# 특정 키만
kubectl view-secret my-secret username

# 전체 키 값 보기
kubectl view-secret my-secret -a
```

`kubectl get secret -o yaml`로 가져온 값을 `base64 -d`로 수동 디코딩하는 번거로움을 없애준다.

### 그 외 유용한 플러그인

```bash
# node-shell: 노드에 직접 접속
kubectl krew install node-shell
kubectl node-shell worker-1

# who-can: RBAC 역방향 조회 (누가 이 권한을 가졌나)
kubectl krew install who-can
kubectl who-can create pods
kubectl who-can get secrets -n production

# resource-capacity: 클러스터 리소스 현황
kubectl krew install resource-capacity
kubectl resource-capacity --sort cpu.limit

# rolloput-restart (내장 기능이지만 알아두면 좋음)
kubectl rollout restart deployment/my-app
```

## 커스텀 플러그인 만들기

kubectl 플러그인은 PATH에 있는 `kubectl-*` 형식의 실행 파일이면 된다.

```bash
# 간단한 커스텀 플러그인 예시
cat > /usr/local/bin/kubectl-pods-all <<'EOF'
#!/bin/bash
kubectl get pods --all-namespaces -o wide "$@"
EOF
chmod +x /usr/local/bin/kubectl-pods-all

# 사용
kubectl pods-all
kubectl plugin list  # 인식 확인
```

krew를 쓰면 kubectl을 단순한 CLI를 넘어 자신만의 K8s 운영 도구로 확장할 수 있다. 다음 글부터는 K8s의 가장 기본 실행 단위인 파드(Pod)의 생명주기를 깊이 살펴본다.

---

**지난 글:** [선언형 vs 명령형: kubectl apply와 create의 철학적 차이](/posts/k8s-declarative-vs-imperative/)

**다음 글:** [파드(Pod) 생명주기 완전 이해](/posts/k8s-pod-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
