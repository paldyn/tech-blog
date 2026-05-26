---
title: "Token vs Password: GitHub 인증 방식 변천사와 PAT 관리"
description: "GitHub이 2021년 패스워드 인증을 종료한 배경, Classic PAT와 Fine-grained PAT의 차이, 스코프 최소 권한 원칙, 토큰 유출 시 대응 방법, CI/CD 환경에서 PAT를 안전하게 사용하는 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "PAT", "GitHub", "인증", "보안", "토큰", "Fine-grained-PAT"]
featured: false
draft: false
---

[지난 글](/posts/git-credential-storage/)에서 credential helper로 인증 정보를 저장하는 방법을 다뤘다. 이번에는 저장하는 인증 정보 자체, 즉 **패스워드 vs 토큰**의 차이와 PAT를 올바르게 관리하는 방법을 살펴본다.

## GitHub 패스워드 인증 종료

2021년 8월 13일, GitHub은 HTTPS 방식의 패스워드 인증을 종료했다. 그 이후로 `git push` 등에서 HTTPS를 사용할 경우 반드시 **Personal Access Token(PAT)**을 사용해야 한다. 이전처럼 계정 비밀번호를 입력하면 인증 실패 오류가 발생한다.

종료 이유는 보안이다. 계정 비밀번호는 모든 권한을 한꺼번에 노출하지만, PAT는 스코프를 제한하고 개별 취소가 가능하다.

![Password vs PAT 비교](/assets/posts/git-token-vs-password-compare.svg)

## Classic PAT vs Fine-grained PAT

GitHub는 두 종류의 PAT를 제공한다.

**Classic PAT**: 기존 방식. `repo`, `workflow`, `read:org` 등 카테고리 단위로 권한을 선택한다. 특정 레포에만 제한하는 기능이 없어 조직 전체 레포에 접근할 수 있다.

**Fine-grained PAT** (2022년 도입, 현재 권장): 특정 레포만 선택 가능. 읽기/쓰기를 리소스 유형별로 세밀하게 설정할 수 있다. 만료일 설정이 필수이고, 조직 관리자가 승인해야 사용 가능한 옵션도 있다.

```bash
# GitHub Settings 경로
# Settings → Developer settings → Personal access tokens
# → Tokens (classic) 또는 Fine-grained tokens
```

## Fine-grained PAT 스코프 설계

![Fine-grained PAT 스코프](/assets/posts/git-token-vs-password-pat.svg)

최소 권한 원칙에 따라 필요한 스코프만 선택한다.

| 용도 | 필요 스코프 |
|------|------|
| `git clone/push` (개인 레포) | Contents: Read & Write |
| PR 생성 | Pull requests: Read & Write |
| CI 워크플로 트리거 | Actions: Read & Write |
| 패키지 배포 | Packages: Read & Write |
| 레포 생성·삭제 | Administration: Read & Write |

단순 코드 push/pull이 목적이라면 **Contents: Read & Write**만 부여하면 된다. 불필요한 스코프는 선택하지 않는다.

## PAT 만료와 교체

Fine-grained PAT는 만료일이 필수이다 (최대 1년). 만료 14일 전 GitHub이 이메일로 알린다. 만료 전 새 PAT를 발급하고, 저장된 credential을 교체한다.

```bash
# 저장된 credential 삭제 (macOS Keychain)
git credential reject <<EOF
protocol=https
host=github.com
EOF

# 이후 git push 시 새 PAT 입력 프롬프트 표시
git push origin main
```

## CI/CD에서 PAT 사용

GitHub Actions에서는 PAT를 Secrets에 저장해 워크플로에서 참조한다.

```yaml
# .github/workflows/deploy.yml
- name: Clone private repo
  env:
    GIT_TOKEN: ${{ secrets.MY_PAT }}
  run: |
    git clone https://x-access-token:$GIT_TOKEN@github.com/org/repo.git
```

기본 제공되는 `GITHUB_TOKEN`도 있다. 워크플로 실행 중 자동으로 생성되며, 해당 레포에만 접근 가능하고 워크플로가 끝나면 만료된다. 가능하면 `GITHUB_TOKEN`을 우선 사용하고, 다른 레포 접근이 필요할 때만 별도 PAT를 사용한다.

```yaml
- name: Push changes
  run: git push
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 토큰 유출 시 대응

PAT가 실수로 코드에 포함되거나 로그에 노출됐다면:

1. **즉시 revoke**: GitHub Settings → PAT 목록 → 해당 토큰 삭제
2. **새 PAT 발급** 후 사용 중인 모든 곳에 교체
3. **커밋 히스토리 정리**: `git filter-repo` 또는 BFG로 토큰 문자열 제거
4. **git-secrets, truffleHog** 등으로 전체 히스토리 스캔

코드에 토큰을 하드코딩하지 않는 것이 최선이다. `.env` 파일을 사용하고 반드시 `.gitignore`에 추가한다.

```bash
# 토큰이 포함된 커밋 히스토리 정리 (후속 글에서 상세 설명)
git filter-repo --replace-text <(echo 'ghp_실제토큰==>REMOVED')
```

## 보안 체크리스트

- Classic PAT보다 Fine-grained PAT를 사용한다
- 만료일을 반드시 설정한다 (30~90일 권장)
- 스코프는 최소 권한으로 설정한다
- PAT를 코드·로그에 절대 노출하지 않는다
- 유출 즉시 revoke하고 새 토큰으로 교체한다

---

**지난 글:** [Git Credential Helper: 인증 정보 안전하게 저장하기](/posts/git-credential-storage/)

**다음 글:** [Git 공급망 보안(Supply Chain Security)](/posts/git-supply-chain-security/)

<br>
읽어주셔서 감사합니다. 😊
