---
title: "docker port — 포트 매핑 확인"
description: "docker port 명령으로 실행 중인 컨테이너의 포트 매핑을 조회하는 방법, -p 옵션의 동작 방식, 임의 포트 할당 패턴, docker inspect와의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "port", "networking", "port-mapping"]
featured: false
draft: false
---

[지난 글](/posts/docker-events/)에서 Docker 이벤트 스트림을 구독하는 방법을 살펴봤다. 이번에는 컨테이너가 어떤 포트로 서비스를 노출하는지 확인하는 `docker port` 명령을 정리한다. 단순하지만 실제 운영 환경에서 빠르게 포트 상태를 점검할 때 매우 유용한 도구다.

## 포트 매핑이란?

Docker 컨테이너는 기본적으로 격리된 네트워크 네임스페이스 안에서 동작하므로, 외부에서 컨테이너 내부 서비스에 접근하려면 **포트 매핑(NAT)** 설정이 필요하다. `-p 호스트포트:컨테이너포트` 옵션이 이 역할을 한다.

```bash
docker run -d -p 8080:80 --name web nginx:alpine
```

이 명령은 호스트의 8080 포트로 들어오는 트래픽을 컨테이너 내부 80 포트로 전달한다.

![포트 매핑 구조](/assets/posts/docker-port-mapping-diagram.svg)

## docker port 기본 사용

`docker port`는 현재 컨테이너에 설정된 포트 매핑을 조회한다.

```bash
# 컨테이너 전체 매핑 조회
docker port web

# 출력
# 80/tcp -> 0.0.0.0:8080
# 80/tcp -> [::]:8080
```

IPv4와 IPv6 바인딩이 모두 표시된다. 특정 컨테이너 포트만 조회하려면 포트 번호를 인자로 추가한다.

```bash
# 80번 포트 매핑만 조회
docker port web 80

# 프로토콜 명시
docker port web 80/tcp
```

출력은 간결하게 `0.0.0.0:8080` 형태로만 표시된다.

## 주요 -p 옵션 패턴

```bash
# 특정 호스트 포트 → 컨테이너 포트
docker run -p 8080:80 nginx

# localhost에만 바인딩 (외부 노출 차단)
docker run -p 127.0.0.1:8080:80 nginx

# 임의 호스트 포트 할당 (호스트 포트 자동 선택)
docker run -p 80 nginx

# 모든 EXPOSE된 포트 임의 매핑
docker run -P nginx
```

임의 포트 할당(`-p 80` 또는 `-P`) 패턴은 호스트 포트 충돌을 피하고 싶을 때 유용하다. 할당된 포트 번호는 `docker port`로 확인한다.

```bash
docker port $(docker ps -q -l)
```

![docker port 명령 패턴](/assets/posts/docker-port-commands.svg)

## docker inspect와의 차이

동일한 정보를 `docker inspect`로도 얻을 수 있지만 훨씬 복잡하다.

```bash
# inspect를 이용한 포트 조회 (번거롭다)
docker inspect web \
  --format '{{json .NetworkSettings.Ports}}' | jq .

# docker port가 압도적으로 간결
docker port web
```

`docker inspect`는 컨테이너 전체 메타데이터를 반환하므로 포트 하나 확인하기에는 과도하다. 반면 `docker port`는 매핑 정보만 즉시 출력한다. 스크립트에서 특정 포트의 호스트 번호를 추출할 때도 편리하다.

```bash
HOST_PORT=$(docker port web 80 | grep '0.0.0.0' | cut -d: -f2)
echo "http://localhost:$HOST_PORT"
```

## 주의 사항

`docker port`는 **실행 중인 컨테이너에만 동작**한다. 중지된 컨테이너에 실행하면 아무 출력 없이 종료된다. 컨테이너가 실행 중이어도 해당 포트에 매핑이 없다면 역시 출력이 없다.

```bash
# 중지된 컨테이너 — 출력 없음
docker stop web
docker port web   # (아무것도 출력 안 됨)
```

포트 매핑이 없는 컨테이너, 즉 `--network host`로 실행하거나 `-p` 없이 실행한 컨테이너도 출력이 비어 있다. 이 경우 실제 포트 상태는 `ss -tlnp` 또는 `docker inspect`로 확인해야 한다.

---

**지난 글:** [docker events — 실시간 이벤트 스트림 모니터링](/posts/docker-events/)

**다음 글:** [docker cp — 컨테이너와 호스트 간 파일 복사](/posts/docker-cp/)

<br>
읽어주셔서 감사합니다. 😊
