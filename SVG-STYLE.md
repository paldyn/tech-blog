# PALDYN 블로그 SVG 가이드라인

블로그 본문에 들어가는 시각화 SVG의 디자인 룰 모음. 시리즈 자동 포스팅 루틴 6종(JavaScript / AI / Spring / SQL / Java / Nexacro / Python / Linux / Docker / Git)이 모두 이 문서를 참조한다.

## 캔버스/폰트

- 다크 배경 `#0a0a0a`, `rx="12"`
- `width="880"` + `viewBox` 명시
- font-family: `'Wanted Sans Variable','Wanted Sans',-apple-system,sans-serif`
- 가장자리 여백 ≥60px, 박스 padding ≥24px
- 한글 폭은 영문 × 1.2로 산정

## 텍스트 위계

- 제목: font-size 22, font-weight 700, fill `#e8e8e8`
- 부제: font-size 16, font-weight 600, fill `#e8e8e8`
- 본문 라벨: font-size 13, fill `#888`
- 색 토큰: 성공 `#55c555` · 경고 `#e05555` · 정보 `#7ec8e3` · 보조 `#7777cc`

⚠ **하단 워터마크·시리즈 브랜드 텍스트 절대 금지**: "PALDYN · X 완전 정복", "PALDYN — Y 시리즈", "© PALDYN ..." 같은 푸터 워터마크 `<text>` 요소 추가 금지. SVG는 본문 시각화에만 집중.

## 박스 내 텍스트 수직 정렬 (간과 빈번)

박스 안에서 텍스트가 위로 쏠리지 않도록 **위/아래 padding 차이 ≤3px** 유지.

- 70px 높이 박스에 3줄(13pt 제목 + 11pt 설명 2줄) → baseline `y = box.y + 22, +40, +58` (top padding ~10, bottom ~9)
- 60px 높이 박스에 2줄(13pt + 11pt) → baseline `y = box.y + 24, +44`
- 텍스트 블록이 박스 안에 안 들어가면 박스 height를 키울 것 — 자르거나 위로 쏠리게 두지 말 것

## 코드 블록 (가독성 가장 중요)

```svg
<rect fill="#000000" rx="6" stroke="#3a4a6e" stroke-width="1" .../>
```

- ⚠ **`fill="#070b14"` + `stroke="#1e2433"` 조합 절대 금지** — 페이지 배경 `#0a0a0a`와 콘트라스트 거의 없어서 사용자 모니터에 따라 코드 박스가 안 보임. 코드 박스는 무조건 `#000000` + 명확한 stroke
- 박스 padding 좌우 16 / 상하 14
- **모든 `<text>`에 `xml:space="preserve"`** (없으면 들여쓰기 사라짐)
- 폰트: `'JetBrains Mono','Menlo','Consolas',monospace`
- **font-size 13** (12는 흐림 — 사용자 디스플레이 따라 가독성 떨어짐)
- 줄 높이 정확히 18~20px씩
- `text-anchor` 금지, base x 동일
- 들여쓰기 방식 A(x +14px/단계) 또는 B(`xml:space="preserve"` + 실공백 4칸) — 한 SVG에서 하나만 사용
- 줄당 ≤36자, 코드 블록 ≤12줄

### 신택스 색 (콘트라스트 강화)

| 토큰 | 색 | 비고 |
|---|---|---|
| 키워드 | `#7ec8e3` | `font-weight="600"` 필수 |
| 식별자·일반 텍스트 | `#ffffff` | `#e8e8e8`보다 밝게 (사용자 모니터 가독성) |
| 주석 | `#9aa4b8` | 절대 `#888` · `#6a8aa0` 같은 어두운 회색 금지 |
| 문자열 | `#ce9178` | |
| 숫자 | `#b5cea8` | |

## 화살표·레이아웃

- 라벨 y는 화살표 y에서 ±14px 이상
- 좌·우 컬럼 간격 ≥60px (880=360+60+360+양쪽50)
- ≤40px 간격에는 라벨 두지 말 것
- **화살표는 `<line>`/`<path>` + `<marker>` 조합으로만** 만든다. `<rect>` shaft + `<polygon>` 화살촉 조합 금지 — shaft 두께와 화살촉 너비가 어긋나서 어색하고, 박스 가장자리 정렬도 깨지기 쉬움.
- **화살표 끝점은 인접 박스 가장자리에 정확히** 닿아야 한다. 박스 안으로 침범하거나, 박스에 못 닿는 gap이 생기지 말 것 (`line x2=박스.x` 형태로 명시).

## 점선/곡선 화살표 (Deopt·역방향·옵션 흐름 등)

- `stroke-width="2"~"2.5"` — 1.5 이하는 얇아서 곡선이 끊어진 조각처럼 보임
- `stroke-dasharray="4,4"` 또는 `"5,3"` — `"6,3"` 이상은 점선 갭이 커서 곡선이 조각조각 보임
- 라벨이 곡선 근처면 라벨과 곡선 사이 최소 **35px 간격** 확보 (필요시 곡선 dip 깊이를 늘리거나 라벨 배치 변경)

### 화살촉은 `<marker>` 사용 필수 (분리된 `<polygon>` 대신)

```svg
<defs>
  <marker id="arr" viewBox="0 0 14 14" refX="12" refY="7"
          markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto">
    <path d="M 0 0 L 13 7 L 0 14 z" fill="#e05555"/>
  </marker>
</defs>
<path d="..." marker-end="url(#arr)"/>
```

- ⚠ **`markerUnits="userSpaceOnUse"` 명시 필수**. 누락하면 기본값이 `strokeWidth`라서 marker 크기가 `markerWidth × stroke-width` 로 계산됨 → stroke-width 2~3 짜리 굵은 화살표에 markerWidth 14를 붙이면 화살촉이 28~42px로 거대해진다. `userSpaceOnUse`로 marker 크기를 stroke와 분리해 절대 크기 14×14로 고정.
- `markerWidth/Height ≥ 14` — 11 이하는 작아서 화살촉 거의 안 보임
- `refX=tip`, `refY=center`, `orient="auto"`로 path 끝에서 자동 회전

## XML 유효성 검증 (반드시 먼저)

`preview_screenshot` 전에 **`xmllint --noout` 통과**부터 확인. LLM이 생성한 SVG는 자주 다음 오류를 만든다 — 통과 못 하면 브라우저에서 이미지가 아예 렌더링되지 않는다 (`naturalWidth=0`).

```bash
xmllint --noout public/assets/posts/{파일명}.svg
# 에러 메시지가 있으면 fix 후 재실행. 0건 출력될 때까지 반복.
```

자주 나오는 오류와 fix:
- `Opening and ending tag mismatch: text ... tspan` — `<text>X</tspan></text>` 잘못된 닫기. `<tspan>` 안 열었으면 그냥 `</text>` 사용.
- `Opening and ending tag mismatch: ... font` — `</font>`는 SVG 태그 아님. `</text>` 또는 `</tspan>`으로 교체.
- `xmlParseEntityRef: no name` 또는 `EntityRef: expecting ';'` — 본문에 `&` 가 escape 안 됨. `&amp;`로.
- `Entity 'nbsp' not defined` — XML은 `&nbsp;` 모름. 공백 또는 `&#160;`.
- `StartTag: invalid element name` — 본문 내 `<` 가 escape 안 됨 (코드 예제에서 자주). `&lt;` 로.
- `Attribute x redefined` / `font-family redefined` — `<text>` 안에 같은 속성 두 번. 하나만 남길 것.
- `Double hyphen within comment` — `<!-- foo -- bar -->` 의 중간 `--` 는 불가. `—` 나 다른 문자로.
- `Char 0x0 out of allowed range` — NULL 바이트 들어감. 제거.

## 브라우저 시각 검증 (XML 통과 후)

1. `mcp__Claude_Preview__preview_start({name:"blog"})`
2. `preview_eval` → `window.location.href = 'http://localhost:4321/assets/posts/{파일명}.svg'`
3. `preview_screenshot` → 다음 체크리스트 **모두** 검증:

- [ ] 잘림: 박스/텍스트가 캔버스 밖으로 나가지 않음
- [ ] 겹침: 같은 y에 다른 텍스트가 겹치지 않음, 라벨이 화살표/곡선과 안 겹침
- [ ] 들여쓰기: 코드 들여쓰기 보존됨
- [ ] 간격: 컬럼·라벨 간격 ≥40px
- [ ] **박스 내 텍스트 수직 정렬**: 박스마다 위/아래 padding 차이 ≤3px (위로 쏠림 금지)
- [ ] **코드 박스 콘트라스트**: 코드 박스 fill·stroke가 페이지 배경과 명확히 구분됨 (fill=#000 + stroke=#3a4a6e 정도)
- [ ] **코드 글자 가독성**: 폰트 size 13, 일반 텍스트 `#ffffff`, 키워드 `font-weight="600"`
- [ ] **점선 화살표 연속성**: dashed curve가 끊겨 보이지 않음 (stroke-width 2, dasharray 4,4)
- [ ] **마커 크기**: 화살촉이 명확히 보임 (markerWidth/Height ≥ 14, `markerUnits="userSpaceOnUse"` 명시)
- [ ] **화살촉 비례**: 화살촉이 shaft 두께 대비 과도하게 크지 않음 (userSpaceOnUse 빠지면 거대해짐)
- [ ] **박스-화살표 연결**: 화살표 끝점이 박스 가장자리에 정확히 닿음 (안쪽 침범·gap 없음)

4. 결함 발견 시 수정 후 XML 검증부터 다시.
