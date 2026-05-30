---
title: "GitHub Secrets: 민감 정보 안전하게 관리"
description: "GitHub Actions에서 API 키·토큰 같은 민감 정보를 Secrets로 암호화 저장하고 워크플로우에 안전하게 주입하는 법. 저장소·조직·환경 범위의 차이, 로그 마스킹, 포크 PR 주의점과 OIDC 대안까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "Secrets", "Actions", "보안", "CI"]
featured: false
draft: false
---

[지난 글](/posts/github-protected-branch/)에서 브랜치 보호 규칙으로 `main`을 지키고, CI 검사를 머지 조건으로 거는 법을 다뤘다. 그런데 그 CI 워크플로우가 배포를 하거나 외부 서비스를 호출하려면 API 키, 배포 토큰, DB 비밀번호 같은 **민감 정보**가 필요하다. 이런 값을 코드나 워크플로우 파일에 그대로 적으면 저장소를 보는 누구나 읽을 수 있고, 한 번 커밋되면 히스토리에 영원히 남는다. **GitHub Secrets**는 이 문제를 해결하는 암호화된 보관소다.

Secrets는 값을 암호화해 저장하고, 워크플로우가 실행되는 순간에만 메모리로 주입한다. 한 번 저장한 값은 다시 평문으로 꺼내 볼 수 없으며, 실행 로그에 우연히 출력되더라도 자동으로 `***`로 가려진다. 즉, 저장·주입·로그 노출의 세 단계 모두에서 값을 보호한다.

![Secret은 실행 시점에만 주입되고 로그에서 마스킹된다](/assets/posts/github-secrets-flow.svg)

## Secret 등록하기

웹에서는 저장소 **Settings → Secrets and variables → Actions → New repository secret**에서 이름과 값을 입력한다. 이름은 대문자와 밑줄 관례(`API_KEY`, `DEPLOY_TOKEN`)를 따른다. `gh` CLI를 쓰면 터미널에서 바로 등록할 수 있다.

```bash
# 값을 직접 입력 (대화형)
gh secret set API_KEY

# 파일이나 명령 출력에서 읽어 등록
gh secret set DEPLOY_TOKEN < token.txt

# 등록된 secret 목록 확인 (값은 보이지 않음)
gh secret list
```

## 워크플로우에서 사용하기

저장한 secret은 `secrets` 컨텍스트로 참조한다. 환경 변수로 노출하거나, 액션의 `with` 입력으로 전달한다.

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        env:
          API_KEY: ${{ secrets.API_KEY }}
        run: ./deploy.sh
```

여기서 `API_KEY` 값은 `deploy.sh` 안에서 환경 변수로 읽히지만, 화면 로그에는 `***`로만 표시된다. 의도적으로 `echo "$API_KEY"`를 해도 마스킹되므로, 디버깅 목적으로 값을 출력하려는 시도는 통하지 않는다 — 이는 버그가 아니라 의도된 보호다.

## 세 가지 범위: 저장소·조직·환경

Secret은 적용 범위에 따라 세 종류가 있다. 넓게 공유할수록 편하지만 노출 위험도 함께 커지므로, 필요한 만큼만 넓히는 것이 원칙이다.

![Secret의 저장소·조직·환경 범위](/assets/posts/github-secrets-scope.svg)

**Repository secret**이 가장 흔한 단위로, 해당 저장소의 워크플로우에서만 쓸 수 있다. **Organization secret**은 여러 저장소가 공유하는 공통 토큰(예: 사내 패키지 레지스트리 자격)에 적합하며, 어떤 저장소가 접근할지 선택할 수 있다. **Environment secret**은 `production`, `staging` 같은 환경별로 분리되며, 환경에 **승인 게이트**나 배포 가능 브랜치 제한을 걸 수 있어 프로덕션 자격 증명을 보호하는 데 유용하다.

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    environment: production   # 이 환경의 secret과 보호 규칙 적용
    steps:
      - run: echo "deploying with ${{ secrets.PROD_TOKEN }}"
```

## 포크 PR과 OIDC: 두 가지 주의점

가장 흔한 함정은 **포크에서 온 PR**이다. 외부 기여자의 포크에서 트리거된 `pull_request` 워크플로우에는 기본적으로 secret이 주입되지 않는다. 악의적인 PR이 secret을 빼내가는 것을 막기 위해서다. 따라서 포크 PR의 CI가 "secret이 비어 있다"며 실패한다면, 그것은 설정 실수가 아니라 보안 설계다. 배포처럼 secret이 필요한 작업은 머지 후 `push` 트리거로 분리하는 것이 안전하다.

또 하나, 장기 보관되는 정적 토큰 자체가 위험 요소라는 점이다. 클라우드 배포라면 secret으로 영구 키를 저장하는 대신 **OIDC**로 단기 토큰을 발급받는 방식이 더 안전하다. 워크플로우가 실행될 때마다 클라우드 제공자에게 짧은 수명의 자격을 받아 쓰고 버리므로, 유출되더라도 피해 범위가 작다.

```yaml
permissions:
  id-token: write   # OIDC 토큰 발급에 필요
  contents: read
```

정리하면, 비밀은 코드에 적지 말고 Secrets에 맡기되 범위는 최소로 두고, 가능하면 정적 토큰 대신 단기 자격을 쓰는 것이 좋다. 혹시 실수로 키가 커밋되었다면 즉시 폐기·교체하고 히스토리에서 제거해야 한다 — 이 정리 작업은 시리즈 후반의 secret 유출 대응 글에서 더 깊이 다룬다.

지금까지 GitHub 플랫폼 기능을 살펴봤다. 다음 글부터는 다시 Git 도구 자체로 돌아가, 테스트로 버그를 도입한 커밋을 자동 추적하는 **`git bisect run`**을 다룬다.

---

**지난 글:** [Protected Branch: 브랜치 보호 규칙 설정](/posts/github-protected-branch/)

**다음 글:** [git bisect run: 테스트로 버그 커밋 자동 추적](/posts/git-bisect-with-test/)

<br>
읽어주셔서 감사합니다. 😊
