---
title: "GitHub Pages: 정적 사이트 배포하기"
description: "GitHub Pages로 저장소를 무료 정적 사이트로 배포하는 법. 브랜치 소스와 GitHub Actions 소스의 차이, 워크플로우 설정, 커스텀 도메인과 흔한 404·경로 문제 해결까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "Pages", "배포", "정적사이트", "Actions"]
featured: false
draft: false
---

[지난 글](/posts/github-cli-gh/)에서 `gh` CLI로 터미널을 떠나지 않고 저장소를 다루는 법을 익혔다. 이제 그 저장소에 담긴 결과물을 세상에 공개할 차례다. **GitHub Pages**는 저장소의 파일을 그대로, 혹은 빌드한 결과를 무료로 정적 웹사이트로 호스팅해 주는 기능이다. 개인 블로그, 프로젝트 문서, 포트폴리오, 라이브러리 데모 페이지를 별도 서버 비용 없이 올릴 수 있어 널리 쓰인다.

핵심은 단순하다. 어떤 파일을 어디서 가져와 게시할지 **소스(source)**를 지정하면, GitHub가 그 결과를 `https://<사용자>.github.io/<저장소>/` 형태의 URL로 공개한다. push 한 번이 곧 배포가 되는 흐름이다.

![GitHub Pages 배포 파이프라인](/assets/posts/github-pages-deploy-flow.svg)

## 두 가지 배포 소스

Pages 설정에서 가장 먼저 고를 것은 배포 소스다. 두 방식이 있고, 사이트가 빌드 단계를 필요로 하는지에 따라 갈린다.

![브랜치 소스와 Actions 소스 비교](/assets/posts/github-pages-deploy-sources.svg)

**Deploy from a branch**는 지정한 브랜치(예: `main` 또는 `gh-pages`)의 루트나 `/docs` 폴더에 있는 파일을 그대로 게시한다. 순수 HTML/CSS/JS로 이루어진 사이트에 적합하다. 빌드 과정이 없으므로 `index.html`만 있으면 바로 동작한다.

**GitHub Actions**는 워크플로우로 사이트를 빌드한 뒤 그 결과물(artifact)을 Pages에 배포한다. Astro, React, Vue, Jekyll처럼 소스를 빌드해야 최종 HTML이 나오는 프레임워크에 필요하다. 빌드 환경과 단계를 워크플로우로 자유롭게 제어할 수 있다.

## 브랜치 소스로 빠르게 시작하기

가장 단순한 경우다. 저장소에 `index.html`을 두고 push한 뒤, 저장소의 **Settings → Pages**에서 소스를 브랜치로 지정한다.

```bash
echo '<h1>Hello Pages</h1>' > index.html
git add index.html
git commit -m "docs: add landing page"
git push origin main
```

설정에서 `main` 브랜치, `/(root)` 폴더를 고르면 잠시 뒤 사이트가 게시된다. `/docs` 폴더를 소스로 지정하면 프로젝트 문서를 코드와 같은 브랜치에 깔끔하게 분리해 둘 수 있다.

## Actions 소스로 빌드 후 배포하기

빌드가 필요한 사이트는 워크플로우를 작성한다. 아래는 Node 기반 정적 사이트 생성기를 빌드해 Pages에 올리는 전형적인 예다.

```yaml
name: Deploy to Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

여기서 핵심은 `permissions` 블록이다. `pages: write`와 `id-token: write`가 없으면 배포 단계가 권한 오류로 실패한다. 빌드 결과 디렉터리(`./dist`)는 사용하는 프레임워크에 맞게 바꾼다.

## 커스텀 도메인과 흔한 함정

기본 도메인 대신 자신의 도메인을 연결하려면 Settings → Pages의 Custom domain에 도메인을 입력하고, DNS에 CNAME(또는 A) 레코드를 추가한다. 저장소 루트에 `CNAME` 파일이 자동 생성되며, 이 파일이 사라지면 도메인 연결이 풀리므로 빌드 산출물에 포함되도록 주의한다.

가장 자주 겪는 문제는 **CSS·이미지가 깨지는 404**다. 원인은 대개 base 경로다. 사이트가 `https://user.github.io/repo/`처럼 하위 경로에 게시되는데 자산을 `/style.css`처럼 절대 경로로 참조하면, 브라우저는 도메인 루트에서 파일을 찾다 실패한다. 프레임워크의 base 옵션을 저장소 이름으로 맞춰야 한다.

```js
// astro.config.mjs 예시
export default {
  site: 'https://user.github.io',
  base: '/repo',
};
```

또 하나, SPA에서 새로고침 시 404가 나는 것은 Pages가 서버 측 라우팅을 모르기 때문이다. 빌드 시 `404.html`을 함께 생성하거나 해시 라우팅을 쓰면 우회할 수 있다. 배포가 끝났는데도 변경이 안 보인다면 브라우저·CDN 캐시를 의심하고 강력 새로고침으로 확인한다.

배포까지 갖췄으니, 이제 그 저장소에 아무나 함부로 push하지 못하도록 지키는 일이 남았다. 다음 글에서는 **브랜치 보호 규칙(Protected Branch)**을 다룬다.

---

**지난 글:** [GitHub CLI(gh): 터미널에서 GitHub 다루기](/posts/github-cli-gh/)

**다음 글:** [Protected Branch: 브랜치 보호 규칙 설정](/posts/github-protected-branch/)

<br>
읽어주셔서 감사합니다. 😊
