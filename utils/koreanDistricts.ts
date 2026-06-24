export type DistrictItem = {
  name: string;      // 단축 이름 (예: 조천읍, 중앙동)
  fullName: string;  // 전체 행정구역 이름
  latitude: number;  // 위도
  longitude: number; // 경도
};

export const KOREAN_DISTRICTS: DistrictItem[] = [
  // ==========================================
  // 1. 제주특별자치도 (어선 및 해상 레저 최다 지역)
  // ==========================================
  { name: "조천읍", fullName: "제주특별자치도 제주시 조천읍", latitude: 33.5351, longitude: 126.6348 },
  { name: "애월읍", fullName: "제주특별자치도 제주시 애월읍", latitude: 33.4612, longitude: 126.3297 },
  { name: "한림읍", fullName: "제주특별자치도 제주시 한림읍", latitude: 33.4141, longitude: 126.2625 },
  { name: "구좌읍", fullName: "제주특별자치도 제주시 구좌읍", latitude: 33.5226, longitude: 126.8525 },
  { name: "성산읍", fullName: "제주특별자치도 서귀포시 성산읍", latitude: 33.3762, longitude: 126.8791 },
  { name: "남원읍", fullName: "제주특별자치도 서귀포시 남원읍", latitude: 33.2798, longitude: 126.7196 },
  { name: "대정읍", fullName: "제주특별자치도 서귀포시 대정읍", latitude: 33.2255, longitude: 126.2520 },
  { name: "안덕면", fullName: "제주특별자치도 서귀포시 안덕면", latitude: 33.2505, longitude: 126.3768 },
  { name: "표선면", fullName: "제주특별자치도 서귀포시 표선면", latitude: 33.3274, longitude: 126.8311 },
  { name: "우도면", fullName: "제주특별자치도 제주시 우도면", latitude: 33.5042, longitude: 126.9542 },
  { name: "추자면", fullName: "제주특별자치도 제주시 추자면", latitude: 33.9620, longitude: 126.2991 },
  { name: "연동", fullName: "제주특별자치도 제주시 연동", latitude: 33.4892, longitude: 126.4914 },
  { name: "노형동", fullName: "제주특별자치도 제주시 노형동", latitude: 33.4802, longitude: 126.4745 },
  { name: "이도동", fullName: "제주특별자치도 제주시 이도동", latitude: 33.4998, longitude: 126.5312 },
  { name: "일도동", fullName: "제주특별자치도 제주시 일도동", latitude: 33.5112, longitude: 126.5298 },
  { name: "화북동", fullName: "제주특별자치도 제주시 화북동", latitude: 33.5248, longitude: 126.5682 },
  { name: "삼양동", fullName: "제주특별자치도 제주시 삼양동", latitude: 33.5238, longitude: 126.5862 },
  { name: "용담동", fullName: "제주특별자치도 제주시 용담동", latitude: 33.5135, longitude: 126.5098 },
  { name: "서홍동", fullName: "제주특별자치도 서귀포시 서홍동", latitude: 33.2572, longitude: 126.5512 },
  { name: "동홍동", fullName: "제주특별자치도 서귀포시 동홍동", latitude: 33.2625, longitude: 126.5742 },
  
  // ==========================================
  // 2. 부산광역시 (해양 물류 및 피싱 포트)
  // ==========================================
  { name: "기장읍", fullName: "부산광역시 기장군 기장읍", latitude: 35.2443, longitude: 129.2223 },
  { name: "장안읍", fullName: "부산광역시 기장군 장안읍", latitude: 35.3191, longitude: 129.2238 },
  { name: "일광읍", fullName: "부산광역시 기장군 일광읍", latitude: 35.2652, longitude: 129.2335 },
  { name: "정관읍", fullName: "부산광역시 기장군 정관읍", latitude: 35.3228, longitude: 129.1782 },
  { name: "다대동", fullName: "부산광역시 사하구 다대동", latitude: 35.0478, longitude: 128.9664 },
  { name: "남항동", fullName: "부산광역시 영도구 남항동", latitude: 35.0902, longitude: 129.0354 },
  { name: "동삼동", fullName: "부산광역시 영도구 동삼동", latitude: 35.0745, longitude: 129.0805 },
  { name: "청학동", fullName: "부산광역시 영도구 청학동", latitude: 35.0975, longitude: 129.0662 },
  { name: "우동", fullName: "부산광역시 해운대구 우동", latitude: 35.1632, longitude: 129.1385 },
  { name: "좌동", fullName: "부산광역시 해운대구 좌동", latitude: 35.1702, longitude: 129.1764 },
  { name: "송정동", fullName: "부산광역시 해운대구 송정동", latitude: 35.1802, longitude: 129.2018 },
  { name: "민락동", fullName: "부산광역시 수영구 민락동", latitude: 35.1582, longitude: 129.1265 },
  
  // ==========================================
  // 3. 경상북도 (울릉도, 포항 구룡포 동해 거점)
  // ==========================================
  { name: "구룡포읍", fullName: "경상북도 포항시 남구 구룡포읍", latitude: 35.9902, longitude: 129.5602 },
  { name: "호미곶면", fullName: "경상북도 포항시 남구 호미곶면", latitude: 36.0768, longitude: 129.5684 },
  { name: "연일읍", fullName: "경상북도 포항시 남구 연일읍", latitude: 35.9982, longitude: 129.3402 },
  { name: "오천읍", fullName: "경상북도 포항시 남구 오천읍", latitude: 35.9675, longitude: 129.4142 },
  { name: "울릉읍", fullName: "경상북도 울릉군 울릉읍 (독도행)", latitude: 37.4842, longitude: 130.9008 },
  { name: "북면", fullName: "경상북도 울릉군 북면", latitude: 37.5255, longitude: 130.8242 },
  { name: "서면", fullName: "경상북도 울릉군 서면", latitude: 37.4812, longitude: 130.8168 },
  { name: "흥해읍", fullName: "경상북도 포항시 북구 흥해읍", latitude: 36.1102, longitude: 129.3458 },
  { name: "동해면", fullName: "경상북도 포항시 남구 동해면", latitude: 35.9892, longitude: 129.4442 },

  // ==========================================
  // 4. 전라남도 (여수, 완도, 신안 남해 포구)
  // ==========================================
  { name: "돌산읍", fullName: "전라남도 여수시 돌산읍", latitude: 34.6292, longitude: 127.7818 },
  { name: "화양면", fullName: "전라남도 여수시 화양면 (전남)", latitude: 34.6835, longitude: 127.6322 },
  { name: "완도읍", fullName: "전라남도 완도군 완도읍", latitude: 34.3115, longitude: 126.7554 },
  { name: "금일읍", fullName: "전라남도 완도군 금일읍", latitude: 34.3512, longitude: 127.0225 },
  { name: "노화읍", fullName: "전라남도 완도군 노화읍", latitude: 34.1865, longitude: 126.5684 },
  { name: "신지면", fullName: "전라남도 완도군 신지면", latitude: 34.3168, longitude: 126.8375 },
  { name: "청산면", fullName: "전라남도 완도군 청산면", latitude: 34.1752, longitude: 126.8835 },
  { name: "지도읍", fullName: "전라남도 신안군 지도읍", latitude: 35.0645, longitude: 126.2025 },
  { name: "압해읍", fullName: "전라남도 신안군 압해읍", latitude: 34.8692, longitude: 126.3152 },
  { name: "삼학동", fullName: "전라남도 목포시 삼학동", latitude: 34.7892, longitude: 126.3982 },
  { name: "만호동", fullName: "전라남도 목포시 만호동", latitude: 34.7831, longitude: 126.3862 },
  
  // ==========================================
  // 5. 강원특별자치도 (동해안 조업구역)
  // ==========================================
  { name: "묵호동", fullName: "강원특별자치도 동해시 묵호동", latitude: 37.5515, longitude: 129.1122 },
  { name: "주문진읍", fullName: "강원특별자치도 강릉시 주문진읍", latitude: 37.8895, longitude: 128.8262 },
  { name: "강문동", fullName: "강원특별자치도 강릉시 강문동", latitude: 37.7942, longitude: 128.9182 },
  { name: "삼척읍", fullName: "강원특별자치도 삼척시 정라동 (삼척항)", latitude: 37.4392, longitude: 129.1835 },
  { name: "토성면", fullName: "강원특별자치도 고성군 토성면", latitude: 38.2582, longitude: 128.5602 },
  { name: "거진읍", fullName: "강원특별자치도 고성군 거진읍", latitude: 38.4445, longitude: 128.4572 },

  // ==========================================
  // 6. 충청남도 / 전북특별자치도 (서해 조업선 거점)
  // ==========================================
  { name: "안면읍", fullName: "충청남도 태안군 안면읍", latitude: 36.5052, longitude: 126.3602 },
  { name: "소원면", fullName: "충청남도 태안군 소원면 (만리포)", latitude: 36.7268, longitude: 126.1774 },
  { name: "근흥면", fullName: "충청남도 태안군 근흥면 (신진도)", latitude: 36.6892, longitude: 126.1558 },
  { name: "화양면", fullName: "충청남도 서천군 화양면 (충남)", latitude: 36.0372, longitude: 126.7865 }, // 서천군 화양면
  { name: "임피면", fullName: "전북특별자치도 군산시 임피면", latitude: 35.9892, longitude: 126.8525 },
  { name: "옥도면", fullName: "전북특별자치도 군산시 옥도면 (선유도)", latitude: 35.8112, longitude: 126.4182 },

  // ==========================================
  // 7. 동명이처 (전국 주요 중복 명칭 검색 대응)
  // ==========================================
  
  // [중앙동 시리즈]
  { name: "중앙동", fullName: "부산광역시 중구 중앙동", latitude: 35.1035, longitude: 129.0362 },
  { name: "중앙동", fullName: "전라남도 여수시 중앙동", latitude: 34.7412, longitude: 127.7348 },
  { name: "중앙동", fullName: "경상남도 창원시 성산구 중앙동", latitude: 35.2225, longitude: 128.6752 },
  { name: "중앙동", fullName: "제주특별자치도 서귀포시 중앙동", latitude: 33.2502, longitude: 126.5642 },
  { name: "중앙동", fullName: "경기도 안산시 단원구 중앙동", latitude: 37.3195, longitude: 126.8375 },
  { name: "중앙동", fullName: "강원특별자치도 강릉시 중앙동", latitude: 37.7548, longitude: 128.8975 },

  // [신흥동 시리즈]
  { name: "신흥동", fullName: "인천광역시 중구 신흥동", latitude: 37.4578, longitude: 126.6342 },
  { name: "신흥동", fullName: "광주광역시 광산구 신흥동", latitude: 35.1382, longitude: 126.7995 },
  { name: "신흥동", fullName: "경상북도 포항시 북구 신흥동", latitude: 36.0392, longitude: 129.3648 },
  { name: "신흥동", fullName: "경기도 성남시 수정구 신흥동", latitude: 37.4425, longitude: 127.1472 },

  // [동명동 시리즈]
  { name: "동명동", fullName: "광주광역시 동구 동명동", latitude: 35.1482, longitude: 126.9275 },
  { name: "동명동", fullName: "전라남도 목포시 동명동", latitude: 34.7895, longitude: 126.3918 },
  { name: "동명동", fullName: "강원특별자치도 속초시 동명동", latitude: 38.2112, longitude: 128.5975 },

  // [상도동 시리즈]
  { name: "상도동", fullName: "서울특별시 동작구 상도동", latitude: 37.5028, longitude: 126.9478 },
  { name: "상도동", fullName: "경상북도 포항시 남구 상도동", latitude: 36.0162, longitude: 129.3622 },

  // [대연동 시리즈]
  { name: "대연동", fullName: "부산광역시 남구 대연동", latitude: 35.1378, longitude: 129.0915 },
  { name: "대현동", fullName: "서울특별시 서대문구 대현동", latitude: 37.5582, longitude: 126.9442 }
];
