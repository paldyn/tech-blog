---
title: "Docker Compose environment: 환경 변수 완전 정복"
description: "compose.yaml에서 environment, env_file, 변수 치환 패턴, 우선순위 체계, .env 파일 관리 보안 원칙을 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "environment", "env_file", "변수치환", ".env", "보안"]
featured: false
draft: false
---

[지난 글](/posts/compose-networks/)에서 Compose 네트워크 격리를 살펴봤다. 이번에는 컨테이너에 환경 변수를 전달하는 방법과 우선순위 체계를 정리한다.

## 환경 변수 선언 방법

### environment 키

```yaml
services:
  api:
    environment:
      # 맵 형식
      NODE_ENV: production
      PORT: "3000"

      # 리스트 형식 (동일 효과)
      - NODE_ENV=production
      - PORT=3000

      # 값 없이 선언 → 호스트 셸 변수 전달
      - DEBUG
```

값 없이 변수 이름만 선언하면 호스트 셸의 동일 이름 변수가 컨테이너에 전달된다. `DEBUG` 변수가 셸에 설정되어 있으면 그 값이 컨테이너로 전달되고, 없으면 변수 자체가 설정되지 않는다.

### env_file 키

```yaml
services:
  api:
    env_file:
      - .env              # 공통 변수
      - .env.local        # 로컬 오버라이드 (git 제외)
      - .env.${NODE_ENV}  # 환경별 파일
```

`.env` 파일 형식:

```ini
NODE_ENV=production
DB_HOST=db
DB_PASSWORD=supersecret
REDIS_URL=redis://cache:6379
```

`#`으로 시작하는 줄은 주석이다. `export` 접두사가 있어도 인식한다.

## 우선순위 체계

![환경 변수 우선순위](/assets/posts/compose-environment-diagram.svg)

높은 우선순위가 낮은 값을 덮어쓴다.

1. 셸 환경 변수 (가장 높음)
2. `--env-file` 옵션으로 지정한 파일
3. 프로젝트 루트 `.env` 파일 (자동 로드)
4. `compose.yaml`의 `environment` 키
5. Dockerfile `ENV` 명령어 (가장 낮음)

```bash
# 셸 변수로 .env 값을 덮어씀
DB_PASSWORD=override docker compose up -d

# 다른 env 파일 사용
docker compose --env-file .env.staging up -d
```

## 변수 치환 패턴

```yaml
services:
  api:
    image: myapp:${TAG:-latest}        # TAG 없으면 latest
    image: myapp:${TAG:?TAG required}  # TAG 없으면 오류 발생
```

| 패턴 | 동작 |
|------|------|
| `${VAR}` | VAR 값, 없으면 빈 문자열 |
| `${VAR:-default}` | VAR 없거나 비어있으면 default |
| `${VAR:?error}` | VAR 없으면 error 메시지와 함께 종료 |
| `${VAR:+value}` | VAR 있을 때만 value 사용 |

## 선언 패턴

![환경 변수 선언 패턴](/assets/posts/compose-environment-code.svg)

## 환경별 분리 패턴

```bash
# 환경별 .env 파일 구조
.env                # 공통 (git 제외)
.env.example        # 예시 (git 포함)
.env.development    # 개발 환경
.env.staging        # 스테이징 환경
```

```bash
# 개발 환경 실행
docker compose --env-file .env.development up -d

# 스테이징 환경 실행
docker compose --env-file .env.staging up -d
```

## docker compose config로 값 확인

변수가 올바르게 치환되었는지 확인하는 명령이다.

```bash
# 변수 치환 후 최종 compose.yaml 출력
docker compose config

# 특정 서비스의 환경 변수 확인
docker compose run --rm api env | sort
```

## secrets 키: 민감 데이터 분리

패스워드·API 키는 `environment`가 아닌 `secrets`로 관리한다.

```yaml
services:
  db:
    image: postgres:16
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # 파일에서 로드
```

`secrets`는 컨테이너 파일시스템의 `/run/secrets/` 아래에 마운트된다. 환경 변수로 직접 노출하지 않아 `docker inspect`나 로그에 값이 노출되지 않는다.

## 보안 체크리스트

```bash
# .gitignore 확인
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo "secrets/" >> .gitignore

# .env.example 커밋 (값 없이 키만)
# .env.example 내용:
# DB_PASSWORD=
# API_KEY=
# JWT_SECRET=
```

- `.env`에는 실제 값을 넣되 git에 커밋하지 않는다.
- `.env.example`은 키 이름만 적어 팀원이 어떤 변수가 필요한지 알 수 있게 커밋한다.
- `compose.yaml`에 패스워드를 하드코딩하지 않는다.
- CI/CD에서는 환경 변수를 시크릿 관리자(AWS Secrets Manager, GitHub Secrets 등)에서 주입한다.

## 정리

- `environment`는 인라인 선언, `env_file`은 파일에서 로드한다. 함께 쓸 수 있다.
- 우선순위: 셸 변수 > `--env-file` > `.env` > `compose.yaml environment` > Dockerfile ENV.
- `${VAR:-default}` 변수 치환으로 기본값을 설정하고, `${VAR:?error}`로 필수 변수를 강제한다.
- 민감 데이터는 `secrets` 키로 분리해 파일시스템 마운트 방식으로 전달한다.
- `.env`는 반드시 `.gitignore`에 추가하고, `.env.example`만 커밋한다.

---

**지난 글:** [Docker Compose networks](/posts/compose-networks/)

<br>
읽어주셔서 감사합니다. 😊
