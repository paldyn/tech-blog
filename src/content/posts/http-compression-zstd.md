---
title: "Zstandard(zstd) 압축 완전 정복 — 차세대 HTTP 압축"
description: "페이스북이 만든 Zstandard의 알고리즘 특징과 gzip·Brotli 대비 위치, Content-Encoding: zstd 브라우저·서버 지원 현황, 사전 압축과 Compression Dictionary Transport까지 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["zstd", "Zstandard", "HTTP압축", "ContentEncoding", "사전압축", "RFC8878", "압축레벨"]
featured: false
draft: false
---

[지난 글](/posts/http-compression-gzip-brotli/)에서 gzip과 Brotli를 정리하며 `Accept-Encoding: zstd`라는 값이 슬쩍 지나갔다. **Zstandard(zstd)**는 페이스북(현 메타)이 2016년 공개하고 RFC 8878로 표준화된 압축 알고리즘으로, 데이터 인프라 세계(Kafka, RocksDB, 리눅스 커널 이미지, ZFS)를 이미 평정한 뒤 2024년부터 브라우저에 들어오면서 HTTP 압축의 세 번째 선택지가 됐다. 이번 글은 zstd가 어떤 물건이고, 언제 gzip·Brotli 대신 골라야 하는지를 다룬다.

## zstd의 설계 목표 — 속도를 포기하지 않는 압축

gzip의 DEFLATE는 1990년대 CPU를 전제로 설계됐다. zstd는 같은 LZ77 계열 매칭에 **현대적 엔트로피 코딩**을 결합해 "압축률은 더 높게, 속도는 비교가 안 되게"를 달성했다.

- **FSE(Finite State Entropy)** — tANS 기반 엔트로피 코더. 허프만의 "심볼당 정수 비트" 한계를 산술 부호화 수준의 정밀도로 넘으면서, 속도는 테이블 조회 수준으로 유지한다.
- **큰 참조 윈도** — 기본 수 MB, 설정에 따라 그 이상. gzip의 32KB와 차원이 다르다.
- **레벨 1~22** (음수 레벨까지 합치면 더 넓다) — 실시간 스트리밍용 초고속부터 보관용 최고 압축까지 한 알고리즘으로 커버한다.
- **해제 속도가 레벨과 거의 무관하게 매우 빠르다** — GB/s급. 받는 쪽(브라우저, 컨슈머)은 어떤 레벨이든 부담이 없다.

## 지형도에서의 위치

![압축률 × 속도 지형도](/assets/posts/http-compression-zstd-positioning.svg)

대략적인 비교 감각은 이렇다 (텍스트 기준, 수치는 환경 따라 변동):

```
                  압축률          압축 속도        해제 속도
gzip -6           기준            기준             기준
zstd -3 (기본)    gzip보다 좋음   수 배 빠름       ~4배 빠름
zstd -19          brotli -9 급    느림             여전히 빠름
brotli -11        최고            매우 느림        빠름
```

요약하면 **zstd는 "gzip이 서 있던 모든 자리"의 상위 호환**이다. 같은 CPU로 더 작게, 또는 같은 크기로 훨씬 빠르게. 반면 정적 자산을 빌드 타임에 한 번 압축해 두는 용도라면 여전히 brotli -11이 최종 크기에서 우세하다.

## Content-Encoding: zstd — 지원 현황

웹에서의 사용은 다른 인코딩과 완전히 동일한 협상 구조다.

```http
GET /api/feed HTTP/1.1
Accept-Encoding: gzip, br, zstd

HTTP/1.1 200 OK
Content-Encoding: zstd
Vary: Accept-Encoding
```

지원 현황 (2026년 기준):

- **브라우저**: Chrome/Edge 123+(2024.3), Firefox 126+(2024.5)에서 `Accept-Encoding`에 zstd 포함. Safari는 아직 미지원 — **gzip 폴백은 여전히 필수**다.
- **CDN**: Cloudflare가 동적 응답에 zstd를 적극 사용. 기타 CDN도 순차 도입 중.
- **서버**: nginx는 서드파티 `zstd-nginx-module`, Apache는 `mod_zstd`(7.x 계열 실험적). 애플리케이션 레벨에서는 각 언어의 zstd 바인딩으로 직접 처리 가능.

```nginx
# zstd-nginx-module 사용 예
zstd on;
zstd_comp_level 3;            # 동적 응답: 낮은 레벨로 충분
zstd_types text/css application/javascript application/json;
zstd_static on;               # 미리 만든 .zst 파일 서빙
```

서버 선택 로직은 보통 `br > zstd > gzip` 또는 `zstd > br > gzip` 우선순위를 쓰는데, **동적 응답이라면 zstd를 앞에** 두는 것이 합리적이다. 같은 CPU 예산에서 brotli 저레벨보다 빠르거나 작기 때문이다.

## 직접 체감해 보기

```bash
# 동일 파일을 세 가지로 압축해 크기·시간 비교
f=bundle.js   # 1.2MB 가정

time gzip -6 -k -c "$f" > /dev/null     # 기준
time zstd -3 -k -c "$f" > /dev/null     # 비슷한 크기, 수 배 빠름
time zstd -19 -k -c "$f" > /dev/null    # brotli급 크기, 시간 소요

# 서버가 zstd로 응답하는지 확인
curl -sI -H 'Accept-Encoding: zstd' https://example.com/ \
  | grep -i content-encoding
# content-encoding: zstd
```

애플리케이션에서 직접 쓸 때 (Node.js 22.15+/23.8+는 내장 zlib에 zstd 지원이 들어왔다):

```js
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib';

const compressed = zstdCompressSync(Buffer.from(jsonBody), {
  params: { /* 레벨 등 */ },
});
res.writeHead(200, {
  'Content-Encoding': 'zstd',
  'Vary': 'Accept-Encoding',
});
res.end(compressed);
```

## zstd의 비장의 무기 — 사전(Dictionary) 압축

일반 압축의 약점은 **작은 파일**이다. LZ77은 "이미 본 내용"을 참조하는 기술인데, 2KB짜리 JSON은 참조할 과거가 2KB뿐이다. 그래서 작은 응답은 압축률이 형편없다.

zstd는 이 문제를 정면으로 겨냥한 **사전 학습** 기능을 1급 시민으로 내장했다. 같은 부류의 샘플 수천 개에서 공통 패턴을 추출해 사전을 만들고, 압축·해제 양쪽이 그 사전을 공유한다.

![사전 압축의 원리](/assets/posts/http-compression-zstd-dictionary.svg)

```bash
# 실제 API 응답 샘플로 사전 학습
zstd --train samples/*.json -o api.dict

# 사전 참조 압축 — 작은 파일에서 효과가 극적
zstd -D api.dict resp.json        # 2.1KB → 0.3KB (사전 없이는 0.9KB)
zstd -D api.dict -d resp.json.zst
```

필드명, 고정 구조, 공통 문자열이 사전에 이미 있으므로 새 응답은 "사전과 다른 부분"만 비용을 낸다. 마이크로서비스 간 통신, 모바일 앱 ↔ API처럼 **같은 스키마의 작은 페이로드가 대량으로 오가는 곳**에서 위력이 크다. 단, 사전 버전 관리가 새로운 운영 부담이 된다 — 압축 측과 해제 측의 사전이 어긋나면 해제가 실패하므로, 사전에 버전 식별자를 부여하고 헤더로 협상해야 한다.

이 아이디어를 웹 표준으로 끌어올리는 작업이 **Compression Dictionary Transport**다. 이전에 받은 응답(예: 구버전 app.js)이나 별도 사전 파일을 사전으로 등록해 두고, 다음 응답을 `dcz`(사전+zstd)·`dcb`(사전+brotli) 인코딩으로 받는다. 버전 업데이트 시 **달라진 부분만 전송**하는 델타 업데이트가 HTTP 캐시 인프라 위에서 동작하게 되는 것이다. Chrome 130+에서 출시됐고 생태계 확산이 진행 중이다.

## 무엇을 언제 쓰나 — 최종 정리

```
상황                         | 추천
──────────────────────────────────────────────────────
정적 자산 (빌드 타임 압축)   | brotli -11 (+ gzip 폴백)
동적 HTML/API (실시간)       | zstd 1~3 또는 brotli 4~5, 폴백 gzip 5
같은 스키마의 작은 페이로드  | zstd + 공유 사전
서버 간 내부 통신·로그·백업  | zstd (사실상 표준)
Safari 등 미지원 클라이언트  | gzip 폴백 항상 유지
```

- zstd는 **속도-압축률 트레이드오프 곡선 자체를 끌어올린** 알고리즘이다. 동적 압축에서 gzip을 대체할 1순위 후보다.
- 브라우저 지원은 Chrome·Firefox까지 왔지만 Safari가 남았다. **Accept-Encoding 협상과 gzip 폴백, 그리고 `Vary: Accept-Encoding`**은 변함없는 기본기다.
- 사전 압축은 작은 응답의 압축률 문제를 푸는 zstd 고유의 강점이고, Compression Dictionary Transport로 웹 표준에 편입되는 중이다.

이로써 HTTP 압축 3부작(전송/콘텐츠 인코딩 → gzip·Brotli → zstd)이 마무리됐다. 다음 글에서는 압축과 함께 대용량 전송의 다른 축인 **Range 요청**으로 이어진다.

---

**지난 글:** [HTTP 압축 완전 정복 — gzip과 Brotli](/posts/http-compression-gzip-brotli/)

<br>
읽어주셔서 감사합니다. 😊
