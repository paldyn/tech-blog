---
title: "VS Code Dev Containers로 팀 개발 환경 표준화하기"
description: "Dev Containers의 개념과 작동 원리, devcontainer.json 주요 필드, features로 도구 추가, Compose 기반 복합 환경 구성, GitHub Codespaces 연동, 팀 온보딩 시간 단축 실전 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "devcontainer", "vscode", "codespaces", "개발환경", "팀협업"]
featured: false
draft: false
---

[지난 글](/posts/docker-dev-environments/)에서 Docker Compose로 로컬 개발 환경을 구성하는 방법을 살펴봤다. 한 단계 더 나아가면 **Dev Containers**다. VS Code가 직접 컨테이너 안에 접속해 편집·디버깅·터미널 작업 전부를 컨테이너 환경에서 처리한다. `.devcontainer/devcontainer.json` 파일 하나만 저장소에 커밋하면 팀 전체가 동일한 환경에서 개발할 수 있다.

## Dev Containers 작동 원리

![Dev Containers 아키텍처](/assets/posts/docker-devcontainer-architecture.svg)

VS Code UI는 호스트에서 실행되지만 **VS Code Server**(언어 서버, 디버거, 터미널, 확장 기능)는 컨테이너 안에서 동작한다. 덕분에 Python이나 Node.js가 호스트에 설치되어 있지 않아도 컨테이너 안의 런타임을 그대로 사용한다.

## devcontainer.json 기본 구조

![devcontainer.json 주요 필드](/assets/posts/docker-devcontainer-json.svg)

```json
// .devcontainer/devcontainer.json
{
  "name": "Node.js 20 개발 환경",
  "image": "mcr.microsoft.com/devcontainers/node:20",

  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-vscode.vscode-typescript-next"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode"
      }
    }
  },

  "postCreateCommand": "npm install",
  "forwardPorts": [3000, 9229],
  "remoteUser": "node"
}
```

저장소에 이 파일만 있으면 VS Code에서 **"Reopen in Container"** 명령으로 환경이 자동 구성된다.

## 자체 Dockerfile 사용

```json
// .devcontainer/devcontainer.json
{
  "name": "Python 개발",
  "build": {
    "dockerfile": "Dockerfile",
    "context": ".."
  },
  "postCreateCommand": "pip install -r requirements-dev.txt",
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "ms-python.black-formatter"
      ]
    }
  }
}
```

```dockerfile
# .devcontainer/Dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    git curl jq \
    && rm -rf /var/lib/apt/lists/*

# non-root 사용자 생성
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME

USER $USERNAME
WORKDIR /workspace
```

## Compose 기반 복합 환경

DB·Redis 같은 부속 서비스가 필요한 경우 Compose와 연동한다.

```json
// .devcontainer/devcontainer.json
{
  "name": "Full Stack Dev",
  "dockerComposeFile": [
    "../compose.yaml",
    "docker-compose.devcontainer.yml"
  ],
  "service": "app",
  "workspaceFolder": "/app",
  "shutdownAction": "stopCompose",
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    }
  }
}
```

```yaml
# .devcontainer/docker-compose.devcontainer.yml
services:
  app:
    volumes:
      - ..:/app:cached    # 소스 bind mount
      - /app/node_modules # 익명 볼륨
    command: sleep infinity   # VS Code가 프로세스 관리
```

`sleep infinity`로 컨테이너를 유지한다. VS Code Server가 연결되면 터미널에서 직접 개발 서버를 실행한다.

## features — 추가 도구 한 줄 설치

```json
{
  "features": {
    "ghcr.io/devcontainers/features/kubectl-helm-minikube:1": {
      "version": "latest",
      "helm": "latest"
    },
    "ghcr.io/devcontainers/features/aws-cli:1": {},
    "ghcr.io/devcontainers/features/terraform:1": {
      "version": "1.7.0"
    }
  }
}
```

feature는 OCI 이미지 기반의 설치 스크립트다. `https://containers.dev/features`에서 공식 목록을 확인할 수 있다.

## lifecycle 명령

```json
{
  "onCreateCommand": "git config --global core.autocrlf false",
  "updateContentCommand": "npm ci",
  "postCreateCommand": "npm run db:migrate",
  "postStartCommand": "npm run db:seed",
  "postAttachCommand": "echo '컨테이너 연결됨'"
}
```

| 명령 | 실행 시점 |
|---|---|
| `onCreateCommand` | 컨테이너 최초 생성 시 (1회) |
| `updateContentCommand` | 소스 업데이트 후 |
| `postCreateCommand` | 컨테이너 생성 완료 후 (1회) |
| `postStartCommand` | 컨테이너 시작 때마다 |
| `postAttachCommand` | VS Code가 연결될 때마다 |

## GitHub Codespaces 호환

`.devcontainer/devcontainer.json`은 GitHub Codespaces에서도 그대로 동작한다. 저장소 페이지에서 **"Code → Open with Codespaces"**를 클릭하면 클라우드에 동일한 개발 환경이 생성된다. 로컬 Docker 설치 없이도 개발 환경에 접근할 수 있어 온보딩이 극적으로 빨라진다.

```bash
# 새 팀원 온보딩 절차
git clone https://github.com/myorg/myapp
# VS Code에서 "Reopen in Container" 클릭
# → 자동으로: 이미지 빌드 → npm install → DB 마이그레이션 → 확장 설치
# → 개발 준비 완료
```

---

**지난 글:** [Docker로 개발 환경 구성하기](/posts/docker-dev-environments/)

**다음 글:** [.dockerignore — 빌드 컨텍스트를 최소화하는 방법](/posts/docker-dockerignore/)

<br>
읽어주셔서 감사합니다. 😊
