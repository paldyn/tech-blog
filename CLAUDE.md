# PALDYN Tech Blog — Claude 작업 규칙

## 포스트 작성
- 새 글 frontmatter에는 항상 `archiveOrder`(양의 정수)를 넣는다.
- 같은 `pubDate` 안에서는 **시리즈 학습 순서(입문 → 심화)** 로 정렬한다. 발행 시각순 아님. 카테고리 우선순위는 두지 않는다.
- 같은 날짜에 다른 글이 없어도 기본 `archiveOrder: 1`을 부여. 형제 글이 있으면 시리즈상 위치에 맞춰 1부터 연속된 정수를 매긴다. 기존 번호가 꼬이면 해당 날짜 그룹 전체를 1부터 다시 부여.
- 변경 후 `npm run validate:posts` 통과 확인.

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
