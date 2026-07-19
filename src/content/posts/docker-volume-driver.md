---
title: "Docker 볼륨 드라이버: 외부 스토리지 연결하기"
description: "Docker 볼륨 드라이버의 개념과 기본 local 드라이버로 NFS를 마운트하는 방법, 서드파티 드라이버 플러그인 설치 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "volume driver", "NFS", "스토리지"]
featured: false
draft: false
---

[지난 글](/posts/docker-tmpfs/)에서 메모리 기반 tmpfs 마운트를 살펴봤다. 이번에는 **볼륨 드라이버(Volume Driver)**를 다룬다. 기본 `local` 드라이버 외에도 NFS, AWS EBS, Ceph 등 다양한 스토리지 백엔드를 볼륨으로 연결할 수 있다.

## 볼륨 드라이버란

볼륨 드라이버는 Docker 볼륨 API와 실제 스토리지 백엔드 사이의 플러그인이다. 드라이버를 교체하더라도 컨테이너는 동일한 `-v` 문법으로 볼륨을 사용한다.

![Docker 볼륨 드라이버 구조](/assets/posts/docker-volume-driver-arch.svg)

```bash
# 볼륨 생성 시 드라이버 지정
docker volume create --driver DRIVER_NAME my-volume

# 드라이버 확인
docker volume inspect my-volume
# "Driver": "DRIVER_NAME"
```

## 기본 드라이버: local

설치 없이 사용할 수 있는 내장 드라이버다. 기본적으로 호스트 로컬 파일시스템에 데이터를 저장하지만, `--opt`로 마운트 옵션을 지정하면 NFS, CIFS(Samba) 같은 네트워크 파일시스템도 마운트할 수 있다.

![local 드라이버로 NFS 마운트](/assets/posts/docker-volume-driver-nfs.svg)

```bash
# NFS v4 마운트 예시
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.10,rw,nfsvers=4 \
  --opt device=:/exports/mydata \
  nfs-data

# CIFS (Windows 공유) 마운트
docker volume create \
  --driver local \
  --opt type=cifs \
  --opt o=username=user,password=pass,vers=3.0 \
  --opt device=//fileserver/share \
  cifs-data
```

`--opt type`은 Linux `mount` 명령의 `-t` 옵션에 해당한다. `--opt o`는 `-o` 옵션 문자열이다.

## 서드파티 드라이버 플러그인

더 많은 기능이 필요하면 Docker 플러그인을 설치한다.

```bash
# 설치된 플러그인 확인
docker plugin ls

# 예시: vieux/sshfs 플러그인 (SSH 마운트)
docker plugin install vieux/sshfs

# SSHFS 볼륨 생성
docker volume create \
  --driver vieux/sshfs \
  --opt sshcmd=user@host:/remote/path \
  --opt password=mypass \
  ssh-data
```

## 클라우드 스토리지 연결

### AWS ECS / EKS: EBS

AWS ECS에서는 EBS 볼륨을 태스크 정의(task definition)에서 직접 지정한다. 로컬 Docker로 EBS를 마운트하려면 `aws-ebs` 플러그인이 필요하다.

```bash
# AWS EBS 플러그인 (구버전 접근 방식)
docker plugin install --alias aws rexray/ebs:latest

docker volume create \
  --driver aws \
  --opt size=20 \
  --opt volumetype=gp3 \
  my-ebs-vol
```

실제로는 Kubernetes, ECS 같은 오케스트레이터가 볼륨 프로비저닝을 담당하므로 로컬에서 직접 EBS 드라이버를 쓰는 경우는 드물다.

### Compose에서 드라이버 지정

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
    driver: local
    driver_opts:
      type: nfs
      o: addr=192.168.1.10,rw,nfsvers=4
      device: ":/exports/pgdata"
```

Compose 파일에서 `driver_opts`로 드라이버 옵션을 지정할 수 있다.

## 드라이버 선택 기준

| 상황 | 권장 드라이버 |
|------|-------------|
| 단일 호스트, 로컬 데이터 | `local` (기본) |
| NFS/Samba 공유 스토리지 | `local` + `--opt type=nfs/cifs` |
| SSH 원격 경로 | `vieux/sshfs` 플러그인 |
| AWS ECS/EKS | EBS CSI 드라이버 (Kubernetes) |
| 분산 파일 시스템 | `rexray/ceph`, `flocker` 등 |

## 주의사항

- 서드파티 플러그인은 네트워크 접근, 특수 권한이 필요할 수 있어 보안 감사 필요
- NFS 마운트는 네트워크 장애 시 컨테이너 I/O가 블로킹될 수 있음
- 플러그인은 Docker 데몬 재시작 후에도 유지되지만 의존하는 서비스(NFS 서버 등)가 준비되어야 함
- `docker volume prune`은 드라이버 종류와 무관하게 미사용 볼륨 모두 삭제

## 핵심 정리

- 볼륨 드라이버는 스토리지 백엔드를 추상화하는 플러그인
- 내장 `local` 드라이버로 NFS, CIFS 마운트 가능 (`--opt type=nfs`)
- 서드파티 드라이버는 `docker plugin install`로 추가
- Compose에서 `driver_opts`로 드라이버 옵션 설정
- 오케스트레이터 환경(K8s, ECS)에서는 CSI 드라이버가 역할 대체

---

**지난 글:** [tmpfs 마운트: 메모리 기반 임시 파일 시스템](/posts/docker-tmpfs/)

**다음 글:** [Docker 볼륨 백업과 복원: 데이터 보호 전략](/posts/docker-volume-backup-restore/)

<br>
읽어주셔서 감사합니다. 😊
