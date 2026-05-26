---
title: "Buildah — 데몬 없이 컨테이너 이미지 빌드"
description: "Buildah로 Docker 데몬 없이 OCI 이미지를 빌드하는 방법, Dockerfile 방식과 스크립트 방식의 차이, 레이어 세밀 제어와 rootless 빌드를 실습합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "buildah", "oci", "image-build", "rootless", "podman", "container-tools"]
featured: false
draft: false
---

[지난 글](/posts/docker-nerdctl/)에서 nerdctl로 containerd에 직접 접근하는 방법을 살펴봤다. 이번에는 **Buildah**를 다룬다. Buildah는 Docker 데몬 없이 OCI 컨테이너 이미지를 빌드하는 도구로, Podman과 함께 Red Hat의 컨테이너 툴킷을 구성한다.

## Buildah란

Buildah(빌다)는 OCI 이미지 빌드에 특화된 도구다. Docker와 달리 **데몬이 없으며**, 이미지를 빌드한 후 실행하는 기능은 포함하지 않는다. 빌드만 전담한다는 단일 책임 원칙을 따른다.

```bash
# Buildah 설치 (RHEL/CentOS/Fedora)
sudo dnf install buildah

# Ubuntu (containers 저장소)
sudo apt install buildah

# 버전 확인
buildah version
```

## Dockerfile 방식 — bud (Build Using Dockerfile)

기존 Dockerfile을 그대로 사용할 수 있다.

```bash
# Dockerfile로 빌드 (Docker 없이)
buildah bud -t myapp:latest .

# 특정 Dockerfile 지정
buildah bud -f Dockerfile.prod -t myapp:prod .

# 빌드 결과 확인
buildah images

# OCI 형식으로 내보내기
buildah push myapp:latest \
  oci-archive:/tmp/myapp.tar
```

## 스크립트 방식 — 레이어 세밀 제어

Buildah의 진가는 **쉘 스크립트로 이미지를 조립**하는 방식이다. Dockerfile의 각 명령이 레이어를 생성하는 것과 달리, 스크립트 방식에서는 커밋 시점을 직접 제어한다.

![Buildah 빌드 방식 비교](/assets/posts/docker-buildah-workflow.svg)

![Buildah 스크립트 빌드 예시](/assets/posts/docker-buildah-script.svg)

```bash
# 작업 컨테이너 생성
CTR=$(buildah from ubuntu:22.04)

# 컨테이너 마운트 포인트 얻기
MNT=$(buildah mount $CTR)

# 마운트에 직접 파일 복사 (RUN 레이어 없이)
cp -r ./myapp $MNT/opt/myapp
chmod +x $MNT/opt/myapp/start.sh

# 마운트 해제
buildah umount $CTR

# 패키지 설치
buildah run $CTR -- apt-get update -q
buildah run $CTR -- apt-get install -y --no-install-recommends \
  ca-certificates curl
buildah run $CTR -- apt-get clean
buildah run $CTR -- rm -rf /var/lib/apt/lists/*

# 이미지 메타데이터 설정
buildah config --entrypoint '["/opt/myapp/start.sh"]' $CTR
buildah config --workingdir /opt/myapp $CTR
buildah config --env APP_ENV=production $CTR
buildah config --port 8080 $CTR

# 커밋 (레이어 수 최소화)
buildah commit $CTR myapp:latest

# 정리
buildah rm $CTR
```

## buildah mount의 강점

`buildah mount`는 컨테이너 파일시스템을 호스트에 직접 마운트한다. 이를 이용하면 `RUN` 명령 없이 파일을 조작할 수 있어 **별도 레이어가 생성되지 않는다**.

```bash
CTR=$(buildah from scratch)
MNT=$(buildah mount $CTR)

# Go 바이너리만 복사 (scratch 기반 최소 이미지)
cp ./myapp-linux-amd64 $MNT/myapp
ls -la $MNT/

buildah umount $CTR
buildah config --entrypoint '["/myapp"]' $CTR
buildah commit $CTR myapp:scratch

# 결과 이미지 크기 확인 (수 MB 수준)
buildah images myapp:scratch
```

## Rootless 빌드

Buildah는 기본적으로 일반 사용자 권한으로 빌드할 수 있다.

```bash
# root 없이 빌드
buildah bud -t myapp .

# 사용자 Namespace 매핑 확인
buildah unshare cat /proc/self/uid_map

# rootless 스토리지 위치
buildah info | grep graphRoot
# ~/.local/share/containers/storage
```

## Podman·Skopeo와의 연동

Buildah, Podman, Skopeo는 같은 **containers/storage** 라이브러리를 공유한다. Buildah로 빌드한 이미지를 Podman이 바로 실행할 수 있다.

```bash
# Buildah로 빌드
buildah bud -t myapp:latest .

# Podman으로 실행 (별도 push 없이)
podman run -d myapp:latest

# Skopeo로 레지스트리에 복사
skopeo copy containers-storage:myapp:latest \
  docker://myregistry.io/myapp:latest
```

## CI/CD 파이프라인에서 활용

```dockerfile
# GitHub Actions / GitLab CI 예시
# 데몬 없이 이미지 빌드 가능 → DinD(Docker-in-Docker) 불필요
# steps:
#   - run: buildah bud -t myapp:$CI_COMMIT_SHA .
#   - run: buildah push myapp:$CI_COMMIT_SHA \
#              docker://registry.io/myapp:$CI_COMMIT_SHA
```

```bash
# 이미지 검사 (빌드 후 확인)
buildah inspect myapp:latest | python3 -m json.tool | head -30

# 레이어 수 확인 (최소화 검증)
buildah history myapp:latest
```

---

**지난 글:** [nerdctl — containerd용 Docker 호환 CLI](/posts/docker-nerdctl/)

**다음 글:** [Skopeo — 이미지 복사·검사 도구](/posts/docker-skopeo/)

<br>
읽어주셔서 감사합니다. 😊
