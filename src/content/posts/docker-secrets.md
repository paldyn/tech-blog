---
title: "Docker Secrets: 시크릿 안전하게 관리하기"
description: "환경변수 대신 Docker Secrets를 써야 하는 이유, Compose 파일 기반 시크릿, Swarm external secret, 애플리케이션에서 /run/secrets 읽기 패턴, BuildKit 빌드 시크릿까지 실전 가이드입니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "secrets", "보안", "환경변수", "swarm", "compose", "시크릿"]
featured: false
draft: false
---

[지난 글](/posts/docker-non-root-user/)에서 컨테이너를 비루트 사용자로 실행하는 방법을 다뤘다. 이번에는 **패스워드·API 키·인증서 같은 시크릿(secret)을 안전하게 컨테이너에 전달하는 방법**을 살펴본다. 환경변수로 시크릿을 전달하는 것은 편리하지만 심각한 보안 위협을 내포한다.

## 환경변수가 위험한 이유

```bash
# 이렇게 하면 안 됩니다
docker run -e DB_PASSWORD=mysecret123 myapp
```

환경변수로 전달된 시크릿은 여러 경로로 노출된다.

```bash
# 1. docker inspect로 평문 확인 가능
docker inspect mycontainer | grep -A 20 '"Env"'
# → "DB_PASSWORD=mysecret123"

# 2. /proc/{pid}/environ에서 읽기 가능
cat /proc/1/environ | tr '\0' '\n' | grep DB_PASSWORD

# 3. docker history에도 레이어로 남을 수 있음
docker history myimage
```

CI/CD 로그, 모니터링 도구, 컨테이너 런타임 메타데이터 — 어디서든 환경변수 값이 흘러나올 수 있다.

## Docker Secrets 개요

Docker Secrets는 시크릿을 **tmpfs(메모리 파일 시스템)에만** 마운트한다. 이미지 레이어, `docker inspect` 출력, 디스크 어디에도 값이 저장되지 않는다.

![Docker Secrets 동작 방식](/assets/posts/docker-secrets-flow.svg)

시크릿은 컨테이너 내부에서 `/run/secrets/{secret-name}` 경로의 파일로 읽힌다.

## Compose에서 파일 기반 시크릿

로컬 개발과 프로덕션 모두에서 가장 흔히 쓰이는 패턴이다.

```yaml
# docker-compose.yml
services:
  web:
    image: myapp:latest
    secrets:
      - db_password
      - api_key
    environment:
      # 앱이 _FILE 규칙을 따르는 경우 편리
      DB_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt  # 호스트 파일 경로
  api_key:
    file: ./secrets/api_key.txt
```

`./secrets/` 디렉터리는 반드시 `.gitignore`에 추가해야 한다.

```bash
# .gitignore
secrets/
*.secret
*.key
```

시크릿 파일을 생성하는 방법:

```bash
mkdir -p secrets
echo -n "my-db-password" > secrets/db_password.txt
echo -n "sk-api-key-here" > secrets/api_key.txt
chmod 600 secrets/*.txt
```

`echo -n`을 써서 줄바꿈 문자가 포함되지 않게 한다.

## 애플리케이션에서 시크릿 읽기

### Node.js

```javascript
const fs = require('fs');

function readSecret(name) {
  const secretPath = `/run/secrets/${name}`;
  const envFallback = process.env[name.toUpperCase()];

  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
  // 로컬 개발용 환경변수 폴백
  return envFallback || '';
}

const dbPassword = readSecret('db_password');
```

### Python

```python
import os

def read_secret(name: str) -> str:
    secret_path = f'/run/secrets/{name}'
    if os.path.exists(secret_path):
        with open(secret_path) as f:
            return f.read().strip()
    # 로컬 개발 폴백
    return os.environ.get(name.upper(), '')

db_password = read_secret('db_password')
```

### _FILE 환경변수 규칙

PostgreSQL, MySQL 공식 이미지 등 많은 이미지가 `POSTGRES_PASSWORD_FILE` 같은 `_FILE` 환경변수를 지원한다.

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

이 경우 앱 코드를 수정할 필요 없이 공식 이미지가 파일에서 값을 읽는다.

## Docker Swarm external secret

Swarm 모드에서는 시크릿을 클러스터 수준에서 관리한다.

```bash
# 시크릿 생성
echo "my-db-password" | docker secret create db_password -
docker secret create api_key ./api_key.txt

# 목록 확인 (값은 볼 수 없음)
docker secret ls

# 상세 정보 (값 제외)
docker secret inspect db_password
```

Compose 파일에서 external secret을 참조한다.

```yaml
secrets:
  db_password:
    external: true           # docker secret create로 사전 등록 필요
  api_key:
    external: true
    name: myapp_api_key      # 실제 secret 이름이 다를 때
```

![Compose와 Swarm Secrets 설정](/assets/posts/docker-secrets-compose.svg)

## BuildKit 빌드 시크릿

빌드 과정(Dockerfile)에서도 시크릿이 필요한 경우가 있다. 예를 들어 사설 npm 레지스트리 토큰, private pip 인덱스 인증 등.

BuildKit의 `--secret` 플래그를 사용하면 빌드 시크릿이 **이미지 레이어에 포함되지 않는다**.

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./

# --mount=type=secret으로 빌드 중에만 시크릿 접근
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --only=production

COPY . .
CMD ["node", "server.js"]
```

```bash
# 빌드 시 시크릿 파일 전달
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .
```

빌드가 끝나면 `/root/.npmrc`는 해당 `RUN` 레이어에만 존재하며 최종 이미지에 포함되지 않는다.

## 환경변수 대 시크릿 비교

| 항목 | 환경변수 | Docker Secrets |
|------|---------|----------------|
| 이미지 레이어 노출 | 위험 | 없음 |
| `docker inspect` 노출 | 노출됨 | 노출 안 됨 |
| 디스크 저장 | 컨테이너 메타데이터 | 없음(tmpfs) |
| 설정 복잡도 | 단순 | 파일 관리 필요 |
| Swarm 클러스터 배포 | 각 노드마다 관리 | 클러스터 수준 관리 |
| Kubernetes 연동 | Secret 오브젝트 별도 필요 | Kubernetes Secret과 유사 패턴 |

## 시크릿 관리 체크리스트

- 시크릿 파일은 `.gitignore`에 추가했는가?
- `docker inspect`로 환경변수에 시크릿이 노출되지 않는가?
- Dockerfile의 `ENV`, `ARG`에 시크릿 값을 직접 넣지 않았는가?
- 빌드 시크릿은 `--mount=type=secret`을 사용했는가?
- 시크릿 파일의 파일 권한이 600으로 설정되었는가?

---

**지난 글:** [Docker 비루트 사용자: 컨테이너 권한 최소화](/posts/docker-non-root-user/)

**다음 글:** [Docker Content Trust: 이미지 서명으로 공급망 공격 방지](/posts/docker-content-trust/)

<br>
읽어주셔서 감사합니다. 😊
