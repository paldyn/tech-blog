# TypeScript 완전 정복 시리즈 — 마스터 TOC

> **참고용 문서**: 실제 자동 포스팅 작성 결정의 진실 공급원은 `src/content/posts/` 디렉터리이며, 슬러그 순서는 해당 루틴 프롬프트의 `PLANNED_EOF` 리스트에 박혀 있다. 이 TOC 체크박스는 사람이 보기 위한 참고일 뿐이다.

카테고리: `JavaScript`
슬러그 프리픽스: `ts-`


## 1부 — 입문과 환경 설정

1. [x] `ts-essence` — TypeScript란 무엇인가 (2026-05-15)
2. [ ] `ts-why-typescript` — 왜 TypeScript를 쓰는가
3. [ ] `ts-vs-javascript` — JavaScript와 TypeScript의 관계
4. [ ] `ts-setup-install` — 개발 환경 설정과 설치
5. [ ] `ts-compiler-tsc` — tsc 컴파일러 동작 원리
6. [ ] `ts-playground-repl` — 플레이그라운드와 ts-node 활용
7. [ ] `ts-first-program` — 첫 TypeScript 프로그램 작성

## 2부 — 기본 타입

8. [x] `ts-basic-types` — 기본 타입 (2026-05-15)
9. [ ] `ts-primitive-types` — 원시 타입 string·number·boolean
10. [ ] `ts-special-types` — null·undefined·void 타입
11. [x] `ts-unknown-never-any` — unknown·never·any의 차이 (2026-05-16)
12. [ ] `ts-array-types` — 배열 타입
13. [ ] `ts-tuple-types` — 튜플 타입
14. [ ] `ts-object-types` — 객체 타입과 옵셔널 프로퍼티
15. [ ] `ts-enum-types` — 열거형 enum 완전 정리
16. [ ] `ts-const-enum` — const enum과 대안 패턴
17. [ ] `ts-type-inference` — 타입 추론의 동작 방식
18. [ ] `ts-type-annotations` — 타입 표기와 명시적 선언

## 3부 — 함수와 타입 좁히기

19. [ ] `ts-function-types` — 함수 타입과 시그니처
20. [ ] `ts-function-overloads` — 함수 오버로드
21. [ ] `ts-optional-default-params` — 선택적 매개변수와 기본값
22. [ ] `ts-rest-parameters` — 나머지 매개변수 타이핑
23. [ ] `ts-this-parameter` — 함수의 this 타이핑
24. [x] `ts-union-intersection-literal` — 유니온·인터섹션·리터럴 타입 (2026-05-15)
25. [ ] `ts-narrowing-basics` — 타입 좁히기 기초
26. [x] `ts-type-guards` — 타입 가드 (2026-05-16)
27. [x] `ts-discriminated-union` — 식별 가능한 유니온 (2026-05-16)
28. [ ] `ts-assertion-functions` — 단언 함수 asserts

## 4부 — 인터페이스와 객체 모델링

29. [x] `ts-interface-vs-type` — 인터페이스 vs 타입 별칭 (2026-05-15)
30. [ ] `ts-interface-extends` — 인터페이스 확장과 병합
31. [ ] `ts-index-signatures` — 인덱스 시그니처
32. [ ] `ts-readonly-const-assertions` — readonly와 const 단언
33. [ ] `ts-keyof-typeof` — keyof와 typeof 연산자
34. [ ] `ts-indexed-access-types` — 인덱스 접근 타입
35. [ ] `ts-structural-typing` — 구조적 타이핑과 덕 타이핑
36. [ ] `ts-excess-property-checks` — 초과 프로퍼티 검사

## 5부 — 클래스

37. [ ] `ts-classes-basics` — 클래스 기초
38. [ ] `ts-access-modifiers` — 접근 제어자 public·private·protected
39. [ ] `ts-abstract-classes` — 추상 클래스
40. [ ] `ts-class-inheritance` — 클래스 상속과 구현
41. [ ] `ts-parameter-properties` — 매개변수 프로퍼티
42. [ ] `ts-static-members` — 정적 멤버와 this 타입
43. [x] `ts-decorators` — 데코레이터 (2026-05-16)

## 6부 — 제네릭

44. [x] `ts-generics-basics` — 제네릭 기초 (2026-05-15)
45. [x] `ts-generic-constraints` — 제네릭 제약 (2026-05-15)
46. [ ] `ts-generic-functions` — 제네릭 함수와 추론
47. [ ] `ts-generic-classes` — 제네릭 클래스
48. [ ] `ts-generic-defaults` — 제네릭 기본 타입 매개변수
49. [ ] `ts-variance` — 공변성과 반공변성

## 7부 — 고급 타입 시스템

50. [x] `ts-conditional-types` — 조건부 타입 (2026-05-15)
51. [x] `ts-infer-keyword` — infer 키워드 (2026-05-16)
52. [x] `ts-mapped-types` — 매핑된 타입 (2026-05-16)
53. [x] `ts-template-literal-types` — 템플릿 리터럴 타입 (2026-05-16)
54. [ ] `ts-recursive-types` — 재귀 타입
55. [ ] `ts-utility-types-overview` — 유틸리티 타입 한눈에 보기
56. [ ] `ts-partial-required-readonly` — Partial·Required·Readonly
57. [ ] `ts-pick-omit` — Pick과 Omit
58. [ ] `ts-record-type` — Record 타입
59. [ ] `ts-extract-exclude` — Extract와 Exclude
60. [ ] `ts-returntype-parameters` — ReturnType·Parameters
61. [ ] `ts-satisfies-operator` — satisfies 연산자

## 8부 — 모듈과 선언

62. [x] `ts-modules-namespace` — 모듈과 네임스페이스 (2026-05-16)
63. [ ] `ts-module-resolution` — 모듈 해석 전략
64. [ ] `ts-declaration-files` — 선언 파일 .d.ts 작성
65. [ ] `ts-definitely-typed` — DefinitelyTyped와 @types
66. [ ] `ts-ambient-declarations` — 앰비언트 선언과 declare

## 9부 — 설정·도구·실전

67. [x] `ts-tsconfig-options` — tsconfig 핵심 옵션 (2026-05-16)
68. [ ] `ts-strict-mode-flags` — strict 모드 플래그 완전 정리
69. [ ] `ts-eslint-typescript` — typescript-eslint로 린팅
70. [ ] `ts-typing-react` — React 컴포넌트 타이핑
71. [ ] `ts-typing-async` — 비동기와 Promise 타이핑
72. [ ] `ts-error-handling` — 에러 처리 타이핑 전략
73. [x] `ts-incremental-adoption` — 점진적 도입 전략 (2026-05-16)
74. [ ] `ts-build-performance` — 빌드 성능 최적화
75. [ ] `ts-project-references` — 프로젝트 레퍼런스
