---
title: "docker rm — 컨테이너 삭제 완전 정복"
description: "docker rm 명령의 옵션(-f, -v), 컨테이너 일괄 삭제 패턴(prune, xargs), 그리고 실수 없이 안전하게 정리하는 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker rm", "컨테이너 삭제", "prune", "클린업"]
featured: false
draft: false
---

[지난 글](/posts/docker-stop-start-restart/)에서 컨테이너를 중지하는 법을 배웠습니다. 중지된 컨테이너는 디스크를 계속 점유하므로, 불필요한 컨테이너를 제때 삭제하는 습관이 중요합니다.

## docker rm 기본 사용법

```bash
docker rm web                    # 중지된 컨테이너 삭제
docker rm web db cache           # 여러 컨테이너 동시 삭제
docker rm $(docker ps -aq)       # 모든 중지된 컨테이너 삭제
```

`docker rm`은 **중지(Exited) 상태**의 컨테이너만 삭제합니다. 실행 중인 컨테이너를 삭제하려 하면 오류가 반환됩니다.

```text
Error response from daemon: You cannot remove a running container ...
```

## 주요 옵션

![docker rm 주요 옵션](/assets/posts/docker-rm-options.svg)

### -f (Force)

```bash
docker rm -f web     # SIGKILL → 즉시 종료 후 삭제
```

실행 중인 컨테이너에 SIGKILL을 보내 강제 종료하고 삭제합니다. grace period가 없으므로 데이터 유실 가능성이 있습니다. 개발 환경에서 빠르게 정리할 때는 편리하지만 프로덕션에서는 주의해야 합니다.

### -v (Volumes)

```bash
docker rm -v temp_container
```

컨테이너와 함께 **익명(anonymous) 볼륨**도 함께 삭제합니다. `docker volume create`나 `-v myname:/path`로 생성한 **명명된 볼륨**은 삭제되지 않습니다. 임시 컨테이너 실행 후 깔끔하게 정리할 때 유용합니다.

## 일괄 삭제 패턴

![컨테이너 일괄 정리 패턴](/assets/posts/docker-rm-prune.svg)

### docker container prune (권장)

```bash
docker container prune           # 중지된 모든 컨테이너 삭제 (확인 프롬프트)
docker container prune -f        # 확인 없이 바로 삭제
docker container prune --filter until=24h   # 24시간 이전 종료 컨테이너만
```

`docker system prune`과 달리 컨테이너만 선택적으로 정리합니다. CI/CD 파이프라인에서 `prune -f`를 주기적으로 실행하면 좀비 컨테이너가 쌓이지 않습니다.

### $(...) 패턴

```bash
# 종료 상태인 컨테이너 ID만 추출해서 삭제
docker rm $(docker ps -aqf status=exited)

# 특정 이미지 기반 컨테이너만 삭제
docker rm $(docker ps -aqf ancestor=nginx)
```

`docker ps -q`로 ID 목록을 셸 치환으로 전달하는 방식입니다. 필터를 조합해 세밀하게 제어할 수 있습니다.

## 삭제 전 확인 습관

컨테이너에 볼륨이나 중요 데이터가 남아 있을 수 있으므로 삭제 전에 확인합니다.

```bash
# 컨테이너 마운트 볼륨 확인
docker inspect web --format '{{json .Mounts}}'

# 컨테이너 종료 코드 확인
docker inspect web --format '{{.State.ExitCode}}'
```

종료 코드가 `0`이 아닌 컨테이너는 비정상 종료된 것이므로 로그를 먼저 확인합니다.

```bash
docker logs web
docker rm web    # 확인 후 삭제
```

## --rm 옵션과의 차이

`docker run --rm`은 컨테이너가 종료될 때 **자동으로** 삭제합니다. 일회성 작업(테스트, 빌드, 스크립트)에는 `--rm`을 붙여두면 별도 정리가 필요 없습니다.

```bash
# 종료와 동시에 자동 삭제
docker run --rm alpine sh -c "echo done"
```

## 정리

`docker rm`은 중지된 컨테이너를 삭제하는 기본 명령이고, `-f`로 강제 삭제, `-v`로 익명 볼륨 함께 삭제가 가능합니다. 일상적인 정리에는 `docker container prune -f`가 가장 간편하고, 세밀한 조건은 `docker ps -qf` 필터와 조합합니다.

---

**지난 글:** [컨테이너 중지·시작·재시작 — stop, start, restart 명령](/posts/docker-stop-start-restart/)

**다음 글:** [docker exec — 실행 중인 컨테이너에 명령 실행](/posts/docker-exec/)

<br>
읽어주셔서 감사합니다. 😊
