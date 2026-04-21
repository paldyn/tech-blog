# PALDYN Tech Blog — Claude 작업 규칙

## Git
- 항상 `main` 브랜치에서 직접 작업한다. 별도 브랜치나 worktree를 만들지 않는다.
- 푸시는 로컬 프록시 대신 GitHub 직접 URL로 한다:
  ```bash
  git push "https://x-access-token:${GITHUB_TOKEN}@github.com/paldyn/tech-blog.git" main
  ```
- 푸시 후 로컬 추적 정보 동기화:
  ```bash
  git update-ref refs/remotes/origin/main HEAD
  ```
