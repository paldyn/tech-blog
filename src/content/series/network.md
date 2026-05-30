# 네트워크 / HTTP 완전 정복 시리즈 — 마스터 TOC

> **참고용 문서**: 실제 자동 포스팅 작성 결정의 진실 공급원은 `src/content/posts/` 디렉터리이며, 슬러그 순서는 해당 루틴 프롬프트의 `PLANNED_EOF` 리스트에 박혀 있다. 이 TOC 체크박스는 사람이 보기 위한 참고일 뿐이다.

카테고리: `Network`
슬러그 프리픽스: `network-, http-`


## 1부 — 네트워크 입문

1. [ ] `network-what-is-network` — 네트워크란 무엇인가
2. [ ] `network-osi-7-layers` — OSI 7계층 모델
3. [ ] `network-tcp-ip-model` — TCP/IP 4계층 모델
4. [ ] `network-bandwidth-throughput-latency` — 대역폭·처리량·지연시간

## 2부 — 물리·데이터링크 계층

5. [ ] `network-mac-address` — MAC 주소의 구조
6. [ ] `network-ethernet` — 이더넷과 프레임 구조
7. [ ] `network-arp` — ARP — IP를 MAC으로

## 3부 — 네트워크 계층

8. [ ] `network-ip-addressing` — IP 주소 체계 기초
9. [ ] `network-ipv4-vs-ipv6` — IPv4 vs IPv6
10. [ ] `network-subnetting` — 서브네팅의 원리
11. [ ] `network-cidr` — CIDR와 가변 길이 서브넷
12. [ ] `network-routing-basics` — 라우팅의 기본 원리
13. [ ] `network-nat` — NAT — 사설 IP와 공인 IP
14. [ ] `network-icmp-ping` — ICMP와 ping·traceroute
15. [ ] `network-dhcp` — DHCP — 자동 IP 할당

## 4부 — 전송 계층

16. [ ] `network-transport-layer` — 전송 계층의 역할
17. [ ] `network-ports-and-sockets` — 포트와 소켓의 개념
18. [ ] `network-tcp-vs-udp` — TCP vs UDP
19. [ ] `network-tcp-3way-handshake` — TCP 3-way 핸드셰이크
20. [ ] `network-tcp-connection-termination` — TCP 연결 종료 (4-way)
21. [ ] `network-tcp-flow-control` — TCP 흐름 제어
22. [ ] `network-tcp-congestion-control` — TCP 혼잡 제어

## 5부 — 응용 계층과 이름 해석

23. [ ] `network-dns-resolution` — DNS 이름 해석 과정

## 6부 — 보안과 암호화

24. [ ] `network-tls-ssl-overview` — TLS/SSL 개요
25. [ ] `network-tls-handshake` — TLS 핸드셰이크 과정
26. [ ] `network-certificates-pki` — 인증서와 PKI
27. [ ] `network-https` — HTTPS의 동작 원리
28. [ ] `network-firewalls` — 방화벽의 종류와 동작
29. [ ] `network-vpn` — VPN — 가상 사설망

## 7부 — 네트워크 인프라

30. [ ] `network-proxy-forward-reverse` — 포워드 프록시 vs 리버스 프록시
31. [ ] `network-load-balancing` — 로드 밸런싱 전략
32. [ ] `network-cdn` — CDN — 콘텐츠 전송 네트워크
33. [ ] `network-packet-capture` — 패킷 캡처 (Wireshark·tcpdump)

## 8부 — HTTP 기초

34. [ ] `http-what-is-http` — HTTP란 무엇인가
35. [ ] `http-request-response-anatomy` — HTTP 요청·응답 구조

## 9부 — 메서드·상태 코드·헤더

36. [ ] `http-methods` — HTTP 메서드 총정리
37. [ ] `http-method-safety-idempotency` — 안전성과 멱등성
38. [ ] `http-status-codes-overview` — 상태 코드 개요 (1xx~5xx)
39. [ ] `http-status-4xx-5xx` — 4xx 클라이언트·5xx 서버 오류
40. [ ] `http-headers-overview` — HTTP 헤더 개요
41. [ ] `http-content-type-mime` — Content-Type과 MIME 타입
42. [ ] `http-content-negotiation` — 콘텐츠 협상

## 10부 — 상태 관리와 캐싱

43. [ ] `http-cookies` — 쿠키의 동작 원리
44. [ ] `http-sessions` — 세션과 상태 유지
45. [ ] `http-cache-control` — Cache-Control 디렉티브
46. [ ] `http-etag-conditional` — ETag와 조건부 요청
47. [ ] `http-cors` — CORS — 교차 출처 리소스 공유

## 11부 — 데이터 전송과 성능

48. [ ] `http-keep-alive-pipelining` — Keep-Alive와 파이프라이닝
49. [ ] `http-chunked-transfer` — 청크 전송 인코딩
50. [ ] `http-compression-gzip-brotli` — 압축 (gzip·brotli)
51. [ ] `http-range-requests` — Range 요청과 부분 전송
52. [ ] `http-redirects` — 리다이렉트의 종류와 활용

## 12부 — 현대 HTTP 프로토콜

53. [ ] `http-1-0-vs-1-1` — HTTP/1.0 vs 1.1
54. [ ] `http-2-multiplexing` — HTTP/2 멀티플렉싱
55. [ ] `http-2-hpack-server-push` — HTTP/2 HPACK과 서버 푸시
56. [ ] `http-3-quic` — HTTP/3와 QUIC

## 13부 — 인증과 API 설계

57. [ ] `http-authentication-basic-bearer` — 인증 (Basic·Bearer·Digest)
58. [ ] `http-multipart-form-data` — multipart 폼 데이터
59. [ ] `http-rest-principles` — REST 설계 원칙
60. [ ] `http-webhooks` — 웹훅의 동작 원리
