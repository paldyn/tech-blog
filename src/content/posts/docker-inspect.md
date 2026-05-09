---
title: "docker inspect — 컨테이너·이미지 상세 정보 조회"
description: "docker inspect 명령으로 컨테이너·이미지·볼륨·네트워크의 상세 정보를 JSON으로 조회하고, -f Go 템플릿으로 원하는 값만 추출하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker inspect", "Go 템플릿", "디버깅", "JSON"]
featured: false
draft: false
---

[지난 글](/posts/docker-logs/)에서 컨테이너 로그를 조회하는 방법을 익혔습니다. 이번에는 컨테이너의 설정, 상태, 네트워크, 마운트 등 **전체 메타데이터를 JSON으로 조회**하는 `docker inspect`를 살펴봅니다.

## 기본 사용법

```bash
docker inspect web             # 컨테이너 전체 메타데이터 JSON 출력
docker image inspect nginx     # 이미지 메타데이터
docker volume inspect mydata   # 볼륨 정보
docker network inspect bridge  # 네트워크 정보
```

기본 출력은 수백 줄에 달하는 JSON 배열이므로, 실무에서는 `-f (--format)` 옵션으로 필요한 값만 추출합니다.

## 출력 구조

![docker inspect 출력 구조](/assets/posts/docker-inspect-structure.svg)

컨테이너 inspect의 최상위 섹션은 다음과 같습니다.

| 섹션 | 주요 필드 |
|------|-----------|
| `State` | Status, Running, Pid, ExitCode, StartedAt, FinishedAt |
| `Config` | Image, Cmd, Env, Labels, ExposedPorts |
| `HostConfig` | PortBindings, Binds, RestartPolicy, Memory |
| `NetworkSettings` | IPAddress, Ports, Networks |
| `Mounts` | Type, Source, Destination, Mode |

## -f 옵션: Go 템플릿

![docker inspect 대상 종류](/assets/posts/docker-inspect-targets.svg)

`-f` 옵션은 Go 템플릿 문법을 사용합니다.

```bash
# IP 주소
docker inspect -f '{{.NetworkSettings.IPAddress}}' web

# 컨테이너 PID (nsenter 등에 활용)
docker inspect -f '{{.State.Pid}}' web

# 종료 코드 + 에러 메시지
docker inspect -f '{{.State.ExitCode}} / {{.State.Error}}' web

# 환경 변수 목록 (range 반복)
docker inspect -f '{{range .Config.Env}}{{.}}{{"\n"}}{{end}}' web

# 마운트 정보 (JSON으로 변환 후 jq 처리)
docker inspect -f '{{json .Mounts}}' web | jq .
```

### 중첩 네트워크 정보 접근

```bash
# 특정 네트워크의 IP (중첩 맵 접근)
docker inspect -f '{{.NetworkSettings.Networks.mynet.IPAddress}}' web
```

## 실전 패턴

### 종료된 컨테이너 원인 파악

```bash
docker inspect -f \
  'Status: {{.State.Status}} | Exit: {{.State.ExitCode}} | OOM: {{.State.OOMKilled}}' \
  failed_container
```

OOMKilled가 `true`이면 메모리 부족으로 강제 종료된 것입니다.

### 볼륨 마운트 경로 확인

```bash
# 컨테이너 → 호스트 경로 매핑
docker inspect -f '{{range .Mounts}}{{.Destination}} → {{.Source}}{{"\n"}}{{end}}' web
```

### 포트 바인딩 확인

```bash
docker inspect -f '{{json .NetworkSettings.Ports}}' web | jq .
```

### 이미지 레이어 해시 목록

```bash
docker image inspect -f '{{range .RootFS.Layers}}{{.}}{{"\n"}}{{end}}' nginx:alpine
```

## 여러 객체 동시 조회

```bash
# 여러 컨테이너 동시 조회
docker inspect web db cache

# 모든 컨테이너 IP 일괄 출력
docker inspect -f '{{.Name}} → {{.NetworkSettings.IPAddress}}' \
  $(docker ps -q)
```

## jq와 함께 사용

```bash
# 전체 JSON을 jq로 파싱
docker inspect web | jq '.[0].State'

# 특정 키만 추출
docker inspect web | jq -r '.[0].NetworkSettings.IPAddress'
```

Go 템플릿보다 jq 문법이 익숙하다면 `docker inspect` 원본 JSON을 jq로 파싱하는 방식도 좋습니다.

## 정리

`docker inspect`는 Docker 객체의 모든 정보를 담고 있습니다. `-f`로 필요한 값만 추출하면 스크립트 자동화, 트러블슈팅, CI/CD 파이프라인 점검에 매우 유용합니다. `State.OOMKilled`, `State.ExitCode`, `State.Pid`는 특히 장애 분석에 자주 활용됩니다.

---

**지난 글:** [docker logs — 컨테이너 로그 조회 완전 정복](/posts/docker-logs/)

**다음 글:** [docker stats — 실시간 리소스 모니터링](/posts/docker-stats/)

<br>
읽어주셔서 감사합니다. 😊
