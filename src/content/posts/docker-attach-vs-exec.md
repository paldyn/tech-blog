---
title: "docker attach vs exec — 차이점과 올바른 활용법"
description: "docker attach와 docker exec의 근본적인 차이, STDIN/STDOUT 연결 방식, 안전한 분리(detach) 방법, 그리고 각 명령이 적합한 상황을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker attach", "docker exec", "stdin", "stdout", "detach"]
featured: false
draft: false
---

[지난 글](/posts/docker-exec/)에서 `docker exec`로 실행 중인 컨테이너에 명령을 보내는 방법을 살펴봤습니다. 이번에는 비슷해 보이지만 동작 원리가 전혀 다른 `docker attach`와 `docker exec`를 비교합니다.

## 핵심 차이 한 줄 요약

- `docker attach`: 컨테이너의 **PID 1 (메인 프로세스) stdin/stdout에 직접 연결**
- `docker exec`: 컨테이너에 **새 프로세스를 실행**해서 연결

![docker attach vs exec 비교](/assets/posts/docker-attach-vs-exec-comparison.svg)

## docker attach

```bash
docker attach web            # PID 1에 터미널 연결
docker attach --no-stdin web # 출력만 감시 (입력 없음)
```

`attach`는 `docker run -d`로 시작한 컨테이너의 PID 1 프로세스(예: nginx, node 등)에 현재 터미널을 붙입니다. 새 프로세스를 만들지 않으며, PID 1의 stdin/stdout/stderr를 그대로 터미널에 연결합니다.

**중요한 주의사항**: 이 상태에서 `Ctrl+C`를 누르면 PID 1에 SIGINT가 전송되어 컨테이너 자체가 종료될 수 있습니다. 반드시 안전한 분리 방법을 사용해야 합니다.

## 안전하게 attach에서 빠져나오기

![attach 안전 분리 방법](/assets/posts/docker-attach-vs-exec-detach.svg)

기본 분리 키 시퀀스는 `Ctrl+P → Ctrl+Q`입니다. 컨테이너를 종료하지 않고 터미널만 분리합니다.

```bash
# 분리 키를 커스텀으로 변경해서 attach
docker attach --detach-keys "ctrl-d" web

# 또는 ~/.docker/config.json 에서 기본값 영구 변경
# { "detachKeys": "ctrl-e,e" }
```

## attach가 유용한 경우

1. **컨테이너가 인터랙티브 앱 자체인 경우**: PID 1이 CLI 게임, REPL 인터프리터 등
2. **컨테이너 stdout 실시간 감시**: `--no-stdin`으로 출력만 스트리밍

```bash
# stdout 스트리밍 (logs -f 와 유사하지만 버퍼 없음)
docker attach --no-stdin web
```

## docker exec가 더 나은 이유

대부분의 컨테이너 접근은 `docker exec -it`가 더 안전하고 유연합니다.

```bash
docker exec -it web bash    # 새 bash 세션, exit해도 컨테이너 유지
docker exec -it web sh      # bash 없을 때
docker exec web nginx -s reload  # 단건 명령 후 자동 종료
```

| 항목 | attach | exec |
|------|--------|------|
| 새 프로세스 생성 | ✗ | ✓ |
| Ctrl+C 위험 | ⚠ 컨테이너 종료 가능 | ✓ exec 프로세스만 종료 |
| 실행 중 컨테이너 필요 | ✓ | ✓ |
| 명령 실행 가능 | ✗ (PID 1에 따라 다름) | ✓ |

## 여러 터미널에서 동시 접속

```bash
# 터미널 A에서 attach
docker attach web

# 터미널 B에서 별도 bash
docker exec -it web bash
```

`attach`는 같은 컨테이너에 여러 터미널이 동시에 연결될 수 있으며, 모든 터미널에 같은 출력이 표시됩니다. `exec`는 각자 독립된 세션을 갖습니다.

## 정리

`docker attach`는 PID 1에 직접 붙으므로 잘못 사용하면 컨테이너를 종료시킬 수 있습니다. 일상적인 디버깅과 접근에는 `docker exec -it`를 쓰고, attach는 컨테이너 자체가 인터랙티브한 특수 상황에서만 사용합니다.

---

**지난 글:** [docker exec — 실행 중인 컨테이너에 명령 실행](/posts/docker-exec/)

**다음 글:** [docker logs — 컨테이너 로그 조회 완전 정복](/posts/docker-logs/)

<br>
읽어주셔서 감사합니다. 😊
