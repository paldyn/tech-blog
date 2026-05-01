---
title: "Import Maps — 빌드 없이 브라우저에서 bare specifier 사용하기"
description: "브라우저 네이티브 Import Maps API로 bare specifier를 URL에 매핑하는 방법, scopes·integrity 필드, 폴리필 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Import Maps", "ESM", "모듈", "브라우저", "bare specifier"]
featured: false
draft: false
---

[지난 글](/posts/js-tree-shaking/)에서 번들러가 사용하지 않는 코드를 제거하는 트리 쉐이킹을 살펴봤습니다. 그런데 번들러 없이, 브라우저가 직접 `"react"` 같은 짧은 경로를 실제 URL로 변환할 수 있다면 어떨까요? **Import Maps**는 바로 그 문제를 해결하는 브라우저 네이티브 기능입니다.

## bare specifier 문제

ES 모듈을 브라우저에서 직접 사용하려면 경로가 항상 명확해야 합니다.

```js
// 브라우저: 불가 — bare specifier
import _ from 'lodash';

// 브라우저: 가능 — 상대·절대 URL
import _ from '/libs/lodash.js';
import _ from 'https://esm.sh/lodash@4.17.21/lodash.js';
```

Node.js나 번들러는 `node_modules` 규약을 알고 있어서 `'lodash'`를 해석하지만, 브라우저는 그 규약을 모릅니다. Import Maps는 이 해석 테이블을 HTML 안에 직접 선언해서 브라우저에게 전달합니다.

## Import Maps 기본 문법

```html
<script type="importmap">
{
  "imports": {
    "lodash":  "/libs/lodash.js",
    "lodash/": "/libs/lodash/",
    "react":   "https://esm.sh/react@18"
  }
}
</script>

<script type="module">
  import _ from 'lodash';          // → /libs/lodash.js
  import chunk from 'lodash/chunk'; // → /libs/lodash/chunk.js
</script>
```

`"lodash/"` 처럼 트레일링 슬래시를 붙이면 서브패스 전체를 prefix로 매핑할 수 있습니다. `"lodash/chunk"`는 `"/libs/lodash/"` + `"chunk"`로 변환됩니다.

![Import Maps 브라우저 매핑 동작](/assets/posts/js-import-maps-browser.svg)

## scopes — 경로별 매핑 오버라이드

전역 `"imports"` 말고도 특정 경로 하위에만 적용되는 매핑을 선언할 수 있습니다.

```json
{
  "imports": {
    "lodash": "/libs/lodash-4.js"
  },
  "scopes": {
    "/legacy/": {
      "lodash": "/libs/lodash-3.js"
    }
  }
}
```

`/legacy/app.js`에서 `import _ from 'lodash'`를 호출하면 `/libs/lodash-3.js`로, 다른 경로에서는 `/libs/lodash-4.js`로 해석됩니다. 점진적 마이그레이션 때 유용합니다.

## integrity 필드 — SRI 결합

Chrome 119부터 `"integrity"` 필드로 CDN 파일의 해시를 검증할 수 있습니다.

```json
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1"
  },
  "integrity": {
    "https://esm.sh/react@18.3.1": "sha384-abc123xyz..."
  }
}
```

해시가 일치하지 않으면 브라우저가 로드를 차단합니다. CDN이 변조된 파일을 반환해도 실행을 막을 수 있습니다.

## 동적 import와의 호환

Import Maps는 정적 `import` 선언뿐 아니라 동적 `import()`에도 동일하게 적용됩니다.

```js
// importmap에 "utils": "/lib/utils.js" 선언되어 있을 때
const mod = await import('utils'); // → /lib/utils.js
```

`import.meta.resolve()`로 실제 URL을 미리 확인할 수도 있습니다.

```js
import.meta.resolve('lodash'); // → "https://example.com/libs/lodash.js"
```

## 폴리필 패턴

![integrity 필드와 폴리필 패턴](/assets/posts/js-import-maps-integrity.svg)

브라우저 지원(Chrome 89+, Firefox 108+, Safari 16.4+)이 넓어졌지만, 구형 환경을 위해 `es-module-shims` 폴리필을 사용할 수 있습니다.

```html
<script async src="https://ga.jspm.io/npm:es-module-shims@1.10.0/dist/es-module-shims.js"></script>
<script type="importmap"> ... </script>
<script type="module"> ... </script>
```

`es-module-shims`는 네이티브 ESM을 지원하는 브라우저에서도 Import Maps를 파싱·처리해주므로 기능 감지 없이 안전하게 사용 가능합니다.

## 제약 사항

Import Maps는 편리하지만 몇 가지 제약이 있습니다.

- HTML 문서당 importmap은 **하나만** 허용 (복수 선언 불가)
- 모듈 로드가 시작된 뒤에 선언하면 무시됨 — `<head>` 최상단에 위치해야 함
- 트리 쉐이킹, 코드 스플리팅 같은 번들 최적화는 제공하지 않음
- `node_modules` 패키지를 그대로 매핑하면 각 파일이 별도 HTTP 요청으로 처리됨

프로덕션 대규모 앱에서는 여전히 번들러가 유리하지만, 프로토타입·소규모 도구·개발 환경에서는 빌드 단계 없이 ESM을 편하게 쓸 수 있는 강력한 옵션입니다.

---

**지난 글:** [트리 쉐이킹 — 사용하지 않는 코드를 제거하는 기술](/posts/js-tree-shaking/)

**다음 글:** [모듈 캐시와 순환 의존성](/posts/js-module-cache-cycles/)

<br>
읽어주셔서 감사합니다. 😊
