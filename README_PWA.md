# 육아 기록 PWA

이 폴더는 iPhone Safari에서 홈 화면에 추가해서 쓰는 PWA 배포본입니다.

## 파일 구성

- `index.html`: 앱 화면
- `style.css`: 앱 스타일
- `app.js`: 기록/통계/백업 로직
- `manifest.webmanifest`: PWA 이름, 시작 경로, 아이콘 설정
- `sw.js`: 오프라인 실행용 앱 파일 캐시
- `icons/`: 홈 화면 아이콘

## iPhone에서 쓰는 방법

1. `PWA` 폴더 전체를 HTTPS 정적 호스팅에 올립니다.
2. iPhone Safari에서 업로드한 주소의 `index.html`을 엽니다.
3. 공유 버튼을 누릅니다.
4. `홈 화면에 추가`를 선택합니다.
5. 홈 화면의 `육아기록` 아이콘으로 실행합니다.

개인용으로 쓰기 쉬운 호스팅 예:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- 개인 NAS/서버의 HTTPS 정적 사이트

## 데이터 저장 방식

기록 데이터는 서버가 아니라 해당 iPhone Safari/PWA의 `localStorage`에 저장됩니다.

중요한 점:

- 같은 사이트 주소에서 열어야 기존 기록이 유지됩니다.
- Safari 방문 기록/웹 사이트 데이터를 지우면 기록도 삭제될 수 있습니다.
- 도메인이나 경로를 바꾸면 다른 저장 공간으로 인식될 수 있습니다.
- 기기 교체 전에는 앱 안의 `내보내기`로 JSON 백업을 저장해두세요.
- iOS Safari의 비공개 브라우징에서는 저장 동작이 제한될 수 있습니다.

## 오프라인 사용

첫 접속 후 `sw.js`가 앱 파일을 캐시합니다. 이후에는 네트워크가 없어도 기본 화면과 기록 기능을 사용할 수 있습니다.

서비스 워커는 HTTPS 또는 `localhost`에서만 동작합니다. `file://`로 직접 열거나 iPhone에서 일반 HTTP 주소로 접속하면 오프라인 캐시와 홈 화면 PWA 동작이 제한됩니다.
