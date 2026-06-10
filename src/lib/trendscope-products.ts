/**
 * TrendScope 큐레이션 상품 데이터 — 원본(추가 작업물/app.js)을 그대로 이식.
 * 이미지는 public/products-square/product-NN.jpg 로 서빙.
 */

export interface ScopeProduct {
  name: string;
  category: string;
  description: string;
  source: string; // 인스타 릴스 등 원본 링크 (없으면 빈 문자열)
  image: string;
  score: number;
  trend: number;
  profit: number;
  competition: number;
  tags: string[];
}

const RAW: [string, string, string, string][] = [
  ['반려동물 발 세척 컵', 'Pet', '산책 후 강아지 발을 컵 안에서 바로 세척하는 제품. 오염 전후 비교 영상으로 보여주기 좋습니다.', 'https://www.instagram.com/stridesoft_/reels/'],
  ['휴대용 손잡이 마사지기', 'Beauty', '손잡이를 잡고 목, 어깨, 허리 부위에 직접 사용하는 셀프 마사지 제품입니다.', 'https://www.instagram.com/erika.ronning/reels/'],
  ['슬림 청소 브러시', 'Home', '창틀, 틈새, 배수구처럼 좁은 공간을 청소하는 긴 막대형 브러시 제품입니다.', 'https://www.instagram.com/shezzasocks/reels/'],
  ['쿨링 페이스 마사지기', 'Beauty', '차가운 금속 헤드로 얼굴 붓기와 피부 진정 콘텐츠를 만들기 쉬운 뷰티 제품입니다.', 'https://www.instagram.com/reels/DY2-0IKxAWp/'],
  ['벽걸이 전동 스크러버', 'Home', '욕실과 주방에 붙여두고 사용하는 전동 세척기. 보관 장면까지 영상화하기 좋습니다.', 'https://www.instagram.com/pawsipus/reels/'],
  ['싱크대 필터 수납 홀더', 'Home', '수전 주변 필터나 청소 도구를 세워두는 주방 정리형 제품입니다.', 'https://www.instagram.com/reels/DY54Vr-Tq5Z/'],
  ['더블 헤드 페이스 롤러', 'Beauty', '두 개의 마사지 헤드로 얼굴 라인을 문지르는 뷰티 디바이스입니다.', 'https://www.instagram.com/reels/DYYCEyIRvWV/'],
  ['욕실 틈새 전동 브러시', 'Home', '타일 줄눈과 좁은 홈을 청소하는 전동 브러시. 전후 비교 콘텐츠에 적합합니다.', 'https://www.instagram.com/reels/DVeZls5jxAe/'],
  ['미니 테이블 청소기', 'Home', '책상 위 먼지, 머리카락, 부스러기를 빨아들이는 소형 청소 제품입니다.', 'https://www.instagram.com/reels/DYJ-qa2K7e_/'],
  ['실리콘 풋패드 깔창', 'Fashion', '구두나 운동화 안에 넣는 발바닥 보호 패드. 통증 완화 후킹이 가능합니다.', 'https://www.instagram.com/reels/DYu_-9qufAp/'],
  ['젤 아이 마스크', 'Beauty', '눈가 붓기와 피로감을 시각적으로 보여주기 쉬운 쿨링 젤 마스크입니다.', 'https://www.instagram.com/reels/DWW5bU8xGcQ/'],
  ['발목 압박 양말', 'Fashion', '발목과 뒤꿈치 부분을 잡아주는 기능성 양말. 착용 전후 설명이 쉬운 제품입니다.', 'https://www.instagram.com/shezzasocks/reels/'],
  ['휴대용 디지털 카운터', 'Tech', '손에 쥐고 숫자를 기록하는 작은 전자 카운터. 습관, 운동, 재고 관리 소재로 활용됩니다.', ''],
  ['2-in-1 강아지 물병', 'Pet', '산책 중 물그릇처럼 바로 펼쳐 쓰는 반려동물 휴대용 급수 제품입니다.', 'https://www.instagram.com/pawsipus/reels/'],
  ['레드라이트 바디 벨트', 'Beauty', '허리와 복부에 감아 쓰는 레드라이트 케어 제품. 통증 관리 니즈를 건드릴 수 있습니다.', 'https://www.instagram.com/reels/DYJ-qa2K7e_/'],
  ['블랙 메모 보드', 'Home', '책상이나 벽에 두는 미니 보드형 제품. 정리, 메모, 인테리어 콘텐츠로 풀기 좋습니다.', ''],
  ['자동 리드줄', 'Pet', '강아지 산책 시 줄 길이를 조절하는 자동 리드줄. 안전성과 편의성을 강조할 수 있습니다.', ''],
  ['미니 빔프로젝터', 'Tech', '방 안에서 큰 화면을 만드는 소형 프로젝터. 전후 분위기 변화가 강한 제품입니다.', ''],
  ['얼굴 화분 인테리어 소품', 'Home', '식물을 머리카락처럼 연출하는 화분. 선물용과 인테리어 소재로 좋습니다.', ''],
  ['무선 스마트 스위치 세트', 'Tech', '기존 조명 스위치를 스마트하게 제어하는 무선 스위치 세트입니다.', ''],
];

export const SCOPE_PRODUCTS: ScopeProduct[] = RAW.map((item, index) => {
  const score = 94 - Math.floor(index * 1.7);
  const trend = 96 - ((index * 7) % 31);
  const profit = 88 - ((index * 5) % 34);
  const competition = 28 + ((index * 6) % 46);
  return {
    name: item[0],
    category: item[1],
    description: item[2],
    source: item[3],
    image: `/products-square/product-${String(index + 1).padStart(2, '0')}.jpg`,
    score,
    trend,
    profit,
    competition,
    tags: [item[1], trend > 82 ? 'High Demand' : 'Steady Demand', profit > 72 ? 'Good Margin' : 'Test First'],
  };
});

export const SCOPE_CATEGORIES = ['all', 'Fashion', 'Pet', 'Home', 'Beauty', 'Tech', 'Outdoor'];
