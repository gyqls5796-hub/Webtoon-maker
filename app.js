/**
 * 인스타그램 10컷 웹툰 자동 조립기 (Mini Canva)
 * - 1080 x 1350px 고해상도 캔버스 엔진
 * - GitHub Contents API 폴더 자동 스캔 & 내장 벡터 캐릭터/배경 폴백(Fallback) 지원
 * - 드래그 이동, 모서리 핸들 크기 조절, 좌우 반전, 레이어 순서, 맞춤 파일명 ZIP 일괄 다운로드
 */

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const HANDLE_SIZE = 24;

// 기본 내장 에셋 목록 (GitHub에 PNG를 올리기 전에도 즉시 그림이 그려지도록 기본 제공)
const DEFAULT_ASSETS = {
  characters: [
    { id: 'tiger_normal.png', label: '🐯 호랑이 (기본/미소)' },
    { id: 'tiger_explain.png', label: '🐯 호랑이 (설명/강조)' },
    { id: 'tiger_no.png', label: '🐯 호랑이 (단호/경고)' },
    { id: 'tiger_good.png', label: '🐯 호랑이 (엄지척/칭찬)' },
    { id: 'rabbit_normal.png', label: '🐰 토끼 (기본/일상)' },
    { id: 'rabbit_shock.png', label: '🐰 토끼 (놀람/당황)' },
    { id: 'rabbit_sick.png', label: '🐰 토끼 (아픔/발열)' },
    { id: 'rabbit_good.png', label: '🐰 토끼 (안심/해결)' },
    { id: 'sheep_normal.png', label: '🐑 양 (기본/순둥)' },
    { id: 'sheep_shock.png', label: '🐑 양 (깜짝/위기)' },
    { id: 'horse_normal.png', label: '🐴 말 (기본/활발)' },
    { id: 'lion_explain.png', label: '🦁 사자 (박사/설명)' }
  ],
  outfits: [
    { id: 'none', label: '의상 없음 (기본 체형)' },
    { id: 'outfit_doctor.png', label: '🥼 연구원/의사 가운' },
    { id: 'outfit_hiking.png', label: '🧥 야외/등산용 긴팔 조끼' },
    { id: 'outfit_casual.png', label: '👕 일상 캐주얼 티셔츠' },
    { id: 'outfit_patient.png', label: '🏥 환자복' }
  ],
  backgrounds: [
    { id: 'bg_forest.png', label: '🌲 풀숲/등산로 (야외 감염경로)' },
    { id: 'bg_hospital.png', label: '🏥 진료실/보건소 (증상/치료)' },
    { id: 'bg_home.png', label: '🏠 거실/일상 공간 (사연 도입)' },
    { id: 'bg_bathroom.png', label: '🚰 세면대/화장실 (손씻기/샤워)' },
    { id: 'bg_office.png', label: '🏢 연구소/브리핑룸 (핵심 요약)' }
  ],
  stickers: [
    { id: 'sticker_tick.png', label: '🕷️ 진드기/해충 경고' },
    { id: 'sticker_virus.png', label: '🦠 바이러스/세균 아이콘' },
    { id: 'sticker_soap.png', label: '🧼 비누 거품/손씻기 반짝임' },
    { id: 'sticker_sweat.png', label: '💦 식은땀/당황 이펙트' },
    { id: 'sticker_check.png', label: '✅ 핵심 예방 체크마크' }
  ]
};

// 로드된 실제 이미지(PNG) 캐시 저장소
const loadedImages = {};

// 애플리케이션 상태
let appState = {
  episodeTitle: 'SFTS_예방법',
  currentCutIndex: 0,
  selectedLayerIndex: -1,
  viewMode: 'single', // 'single' | 'grid'
  cuts: []
};

// 드래그 & 리사이즈 상태
let dragState = {
  isDragging: false,
  mode: null, // 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'
  startX: 0,
  startY: 0,
  initialBox: null
};

// DOM 요소 참조
const mainCanvas = document.getElementById('mainCanvas');
const ctx = mainCanvas.getContext('2d');

// ============================================================================
// 1. 초기 샘플 10컷 대본 데이터 (SFTS 예방법 예시)
// ============================================================================
function getSampleScriptData() {
  return {
    episodeTitle: "SFTS_예방법",
    cuts: [
      {
        background: "bg_forest.png",
        headerText: "[SFTS 시리즈 4탄] 진드기 안 물리는 완벽 복장 편",
        items: [
          { type: "character", charId: "tiger_explain.png", outfitId: "outfit_doctor.png", outfitColor: "#3b82f6", x: 110, y: 540, width: 420, height: 680, flipX: false },
          { type: "character", charId: "rabbit_shock.png", outfitId: "outfit_casual.png", outfitColor: "#f59e0b", x: 560, y: 580, width: 390, height: 640, flipX: true },
          { type: "Sticker", stickerId: "sticker_tick.png", x: 820, y: 430, width: 170, height: 170, flipX: false },
          { type: "bubble", bubbleStyle: "title", tailDir: "none", speaker: "감염병 사연툰", text: "등산 갈 때 반팔·반바지?\n진드기가 제일 좋아하는 맛집입니다!", fontSize: 48, textColor: "#ffffff", bgColor: "#1e3a8a", x: 70, y: 140, width: 940, height: 270 }
        ]
      },
      {
        background: "bg_home.png",
        headerText: "사연 제보: 주말 등산을 준비하는 토끼 씨",
        items: [
          { type: "character", charId: "rabbit_normal.png", outfitId: "outfit_casual.png", outfitColor: "#ec4899", x: 330, y: 550, width: 420, height: 680, flipX: false },
          { type: "bubble", bubbleStyle: "round", tailDir: "bottom", speaker: "토끼 사연자", text: "날씨도 선선한데 주말에 뒷산이나 갈까?\n시원하게 반팔에 반바지 입고 가야지~", fontSize: 42, textColor: "#111827", bgColor: "#ffffff", x: 110, y: 190, width: 860, height: 260 }
        ]
      },
      {
        background: "bg_forest.png",
        headerText: "풀숲에 숨어있는 작은소피참진드기",
        items: [
          { type: "character", charId: "rabbit_shock.png", outfitId: "outfit_casual.png", outfitColor: "#ec4899", x: 160, y: 560, width: 410, height: 660, flipX: false },
          { type: "sticker", stickerId: "sticker_tick.png", x: 640, y: 740, width: 240, height: 240, flipX: false },
          { type: "sticker", stickerId: "sticker_sweat.png", x: 130, y: 500, width: 140, height: 140, flipX: false },
          { type: "bubble", bubbleStyle: "shout", tailDir: "left", speaker: "진드기", text: "오! 맨살이 그대로 드러나 있잖아?\n오늘 점심 식사는 여기다!!", fontSize: 44, textColor: "#991b1b", bgColor: "#fef2f2", x: 120, y: 180, width: 840, height: 260 }
        ]
      },
      {
        background: "bg_forest.png",
        headerText: "잠깐! 호랑이 연구원의 긴급 출동",
        items: [
          { type: "character", charId: "tiger_no.png", outfitId: "outfit_doctor.png", outfitColor: "#3b82f6", x: 320, y: 520, width: 440, height: 700, flipX: false },
          { type: "bubble", bubbleStyle: "shout", tailDir: "bottom", speaker: "호랑이 연구원", text: "스톱!! 풀밭에 갈 때 피부를 노출하면\nSFTS(중증열성혈소판감소증후군) 위험해요!", fontSize: 42, textColor: "#111827", bgColor: "#fef08a", x: 90, y: 170, width: 900, height: 270 }
        ]
      },
      {
        background: "bg_office.png",
        headerText: "핵심 예방법 ①: 피부 노출 최소화 복장",
        items: [
          { type: "character", charId: "tiger_explain.png", outfitId: "outfit_doctor.png", outfitColor: "#3b82f6", x: 120, y: 540, width: 410, height: 670, flipX: false },
          { type: "character", charId: "rabbit_normal.png", outfitId: "outfit_hiking.png", outfitColor: "#10b981", x: 560, y: 560, width: 390, height: 650, flipX: true },
          { type: "sticker", stickerId: "sticker_check.png", x: 800, y: 490, width: 150, height: 150, flipX: false },
          { type: "bubble", bubbleStyle: "round", tailDir: "left", speaker: "호랑이 연구원", text: "야외활동 땐 무조건 '긴팔·긴바지' 필수!\n소매와 바지 끝단은 단단히 여며주세요.", fontSize: 42, textColor: "#111827", bgColor: "#ffffff", x: 90, y: 170, width: 900, height: 260 }
        ]
      },
      {
        background: "bg_office.png",
        headerText: "옷 색깔도 중요하다는 사실, 알고 계셨나요?",
        items: [
          { type: "character", charId: "rabbit_normal.png", outfitId: "outfit_hiking.png", outfitColor: "#f8fafc", x: 150, y: 550, width: 400, height: 660, flipX: false },
          { type: "character", charId: "tiger_good.png", outfitId: "outfit_doctor.png", outfitColor: "#3b82f6", x: 560, y: 530, width: 410, height: 680, flipX: true },
          { type: "bubble", bubbleStyle: "round", tailDir: "right", speaker: "호랑이 연구원", text: "밝은색 옷을 입으면 작은 진드기가 붙었을 때\n눈에 확 띄어서 바로 털어낼 수 있답니다!", fontSize: 40, textColor: "#111827", bgColor: "#ffffff", x: 90, y: 180, width: 900, height: 260 }
        ]
      },
      {
        background: "bg_forest.png",
        headerText: "핵심 예방법 ②: 진드기 기피제 올바른 사용",
        items: [
          { type: "character", charId: "rabbit_good.png", outfitId: "outfit_hiking.png", outfitColor: "#10b981", x: 310, y: 540, width: 420, height: 680, flipX: false },
          { type: "sticker", stickerId: "sticker_check.png", x: 730, y: 560, width: 160, height: 160, flipX: false },
          { type: "bubble", bubbleStyle: "round", tailDir: "bottom", speaker: "토끼 사연자", text: "출발 전에 옷과 노출 부위에\n진드기 기피제까지 칙칙 뿌려주면 방어력 만렙!", fontSize: 42, textColor: "#065f46", bgColor: "#ecfdf5", x: 90, y: 180, width: 900, height: 260 }
        ]
      },
      {
        background: "bg_forest.png",
        headerText: "핵심 예방법 ③: 풀밭 위에 그냥 앉지 마세요!",
        items: [
          { type: "character", charId: "sheep_shock.png", outfitId: "outfit_casual.png", outfitColor: "#f59e0b", x: 140, y: 560, width: 400, height: 650, flipX: false },
          { type: "character", charId: "tiger_no.png", outfitId: "outfit_doctor.png", outfitColor: "#3b82f6", x: 560, y: 530, width: 410, height: 680, flipX: true },
          { type: "bubble", bubbleStyle: "round", tailDir: "right", speaker: "호랑이 연구원", text: "풀숲에 바로 앉거나 옷을 벗어두면 절대 안 돼요!\n쉴 때는 반드시 '돗자리'를 펴고 앉으세요.", fontSize: 40, textColor: "#111827", bgColor: "#ffffff", x: 90, y: 180, width: 900, height: 260 }
        ]
      },
      {
        background: "bg_bathroom.png",
        headerText: "핵심 예방법 ④: 귀가 후 옷 세탁 & 샤워",
        items: [
          { type: "character", charId: "rabbit_good.png", outfitId: "none", outfitColor: "#38bdf8", x: 320, y: 550, width: 420, height: 670, flipX: false },
          { type: "sticker", stickerId: "sticker_soap.png", x: 220, y: 520, width: 170, height: 170, flipX: false },
          { type: "sticker", stickerId: "sticker_soap.png", x: 690, y: 580, width: 150, height: 150, flipX: false },
          { type: "bubble", bubbleStyle: "round", tailDir: "bottom", speaker: "토끼 사연자", text: "집에 오자마자 입었던 옷은 털어서 바로 세탁하고\n비누로 꼼꼼히 샤워하면서 물린 곳 없는지 확인!", fontSize: 40, textColor: "#111827", bgColor: "#ffffff", x: 80, y: 180, width: 920, height: 260 }
        ]
      },
      {
        background: "bg_hospital.png",
        headerText: "다음 편 예고: 귀가 후 몸에서 진드기를 발견했다면?",
        items: [
          { type: "character", charId: "tiger_good.png", outfitId: "outfit_doctor.png", outfitColor: "#3b82f6", x: 140, y: 530, width: 420, height: 680, flipX: false },
          { type: "character", charId: "rabbit_good.png", outfitId: "outfit_hiking.png", outfitColor: "#10b981", x: 560, y: 560, width: 390, height: 650, flipX: true },
          { type: "bubble", bubbleStyle: "narration", tailDir: "none", speaker: "오늘의 요약", text: "✔ 긴팔·긴바지·밝은 옷 착용 & 기피제 사용\n✔ 귀가 후 즉시 옷 세탁 및 샤워하며 몸 확인!\n(5탄 '진드기 제거 및 대처법'에서 계속됩니다)", fontSize: 40, textColor: "#1e3a8a", bgColor: "#eff6ff", x: 80, y: 160, width: 920, height: 300 }
        ]
      }
    ]
  };
}

// ============================================================================
// 2. 초기화 및 이벤트 바인딩
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  loadSavedGithubSettings();
  populateSelectMenus();

  // 초기 샘플 로드
  const sampleData = getSampleScriptData();
  document.getElementById('jsonScriptInput').value = JSON.stringify(sampleData, null, 2);
  applyScriptToState(sampleData);

  bindUIEvents();
  bindCanvasMouseEvents();
});

function populateSelectMenus() {
  fillSelect('bgSelect', DEFAULT_ASSETS.backgrounds);
  fillSelect('charSelect', DEFAULT_ASSETS.characters);
  fillSelect('outfitSelect', DEFAULT_ASSETS.outfits);
  fillSelect('stickerSelect', DEFAULT_ASSETS.stickers);
}

function fillSelect(selectId, items) {
  const select = document.getElementById(selectId);
  const prevVal = select.value;
  select.innerHTML = '';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.label || item.id;
    select.appendChild(opt);
  });
  if (prevVal && items.some(i => i.id === prevVal)) {
    select.value = prevVal;
  }
}

// ============================================================================
// 3. GitHub Contents API 자동 스캔 및 로컬 PNG 파일 추가
// ============================================================================
function loadSavedGithubSettings() {
  const savedOwner = localStorage.getItem('webtoon_gh_owner') || '';
  const savedRepo = localStorage.getItem('webtoon_gh_repo') || '';
  const savedBranch = localStorage.getItem('webtoon_gh_branch') || 'main';
  document.getElementById('ghOwner').value = savedOwner;
  document.getElementById('ghRepo').value = savedRepo;
  document.getElementById('ghBranch').value = savedBranch;

  if (savedOwner && savedRepo) {
    syncGithubAssets(savedOwner, savedRepo, savedBranch, true);
  }
}

async function syncGithubAssets(owner, repo, branch = 'main', silent = false) {
  if (!owner || !repo) {
    if (!silent) alert('GitHub 사용자명(Owner)과 저장소명(Repo)을 입력해 주세요.');
    return;
  }
  localStorage.setItem('webtoon_gh_owner', owner);
  localStorage.setItem('webtoon_gh_repo', repo);
  localStorage.setItem('webtoon_gh_branch', branch);

  const categories = ['characters', 'outfits', 'backgrounds', 'stickers'];
  let foundCount = 0;

  for (const category of categories) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/images/${category}?ref=${branch}`;
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) continue;
      const files = await res.json();
      if (!Array.isArray(files)) continue;

      files.forEach(file => {
        if (file.type === 'file' && /\.(png|jpg|jpeg|webp|svg)$/i.test(file.name)) {
          foundCount++;
          // 목록에 없으면 자동 추가
          if (!DEFAULT_ASSETS[category].some(item => item.id === file.name)) {
            DEFAULT_ASSETS[category].push({
              id: file.name,
              label: `📁 ${file.name}`
            });
          }
          // 실제 이미지 프리로드 (CORS 허용)
          preloadExternalImage(file.name, file.download_url);
        }
      });
    } catch (err) {
      console.warn(`GitHub 폴더 조회 실패 (${category}):`, err);
    }
  }

  populateSelectMenus();
  renderAll();
  if (!silent) {
    alert(`GitHub 연동 완료! 총 ${foundCount}개의 이미지 에셋을 확인했습니다.\n(폴더에 없는 파일은 내장 벡터 그래픽으로 자동 대체됩니다.)`);
  }
}

function preloadExternalImage(fileName, url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    loadedImages[fileName] = img;
    renderAll();
  };
  img.src = url;
}

// 로컬 PC에서 PNG 파일 즉시 불러오기 (테스트 및 작업용)
function handleLocalAssetUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        loadedImages[file.name] = img;
        // 파일명 접두사에 따라 카테고리 자동 분류
        let category = 'characters';
        if (file.name.startsWith('bg_')) category = 'backgrounds';
        else if (file.name.startsWith('outfit_')) category = 'outfits';
        else if (file.name.startsWith('sticker_')) category = 'stickers';

        if (!DEFAULT_ASSETS[category].some(item => item.id === file.name)) {
          DEFAULT_ASSETS[category].push({ id: file.name, label: `💻 ${file.name}` });
        }
        populateSelectMenus();
        renderAll();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// 4. 내장 벡터 그래픽 엔진 (PNG 파일이 없을 때 귀여운 웹툰 에셋을 직접 그림)
// ============================================================================
function drawBackgroundAsset(c, bgId, headerText, cutNumber, totalCuts) {
  // 1) 만약 GitHub이나 로컬에서 로드된 실제 PNG가 있으면 즉시 그림
  if (loadedImages[bgId]) {
    c.drawImage(loadedImages[bgId], 0, 0, CANVAS_W, CANVAS_H);
  } else {
    // 2) 내장 테마 배경 렌더링
    if (bgId.includes('forest')) {
      const grad = c.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#bae6fd');
      grad.addColorStop(0.65, '#e0f2fe');
      grad.addColorStop(0.65, '#86efac');
      grad.addColorStop(1, '#22c55e');
      c.fillStyle = grad;
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // 뒷산과 나무, 수풀
      c.fillStyle = '#4ade80';
      c.beginPath();
      c.arc(240, 880, 360, Math.PI, 0);
      c.arc(840, 880, 420, Math.PI, 0);
      c.fill();
      // 풀포기 장식
      c.fillStyle = '#15803d';
      for (let x = 60; x < CANVAS_W; x += 180) {
        c.beginPath();
        c.moveTo(x, 1280);
        c.lineTo(x + 20, 1210);
        c.lineTo(x + 40, 1280);
        c.fill();
      }
    } else if (bgId.includes('hospital')) {
      c.fillStyle = '#f0fdf4';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      c.fillStyle = '#dcfce7';
      c.fillRect(0, 920, CANVAS_W, 430);
      // 병원 십자가 마크
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#86efac';
      c.lineWidth = 6;
      c.beginPath();
      c.roundRect(780, 220, 180, 180, 24);
      c.fill();
      c.stroke();
      c.fillStyle = '#ef4444';
      c.fillRect(850, 255, 40, 110);
      c.fillRect(815, 290, 110, 40);
    } else if (bgId.includes('bathroom')) {
      c.fillStyle = '#e0f2fe';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // 타일 격자선
      c.strokeStyle = '#bae6fd';
      c.lineWidth = 3;
      for (let x = 0; x < CANVAS_W; x += 120) {
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, CANVAS_H); c.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += 120) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(CANVAS_W, y); c.stroke();
      }
      // 세면대 거울
      c.fillStyle = '#f8fafc';
      c.strokeStyle = '#38bdf8';
      c.lineWidth = 10;
      c.beginPath();
      c.roundRect(140, 220, 800, 460, 30);
      c.fill();
      c.stroke();
    } else if (bgId.includes('office')) {
      c.fillStyle = '#eff6ff';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      c.fillStyle = '#dbeafe';
      c.fillRect(0, 930, CANVAS_W, 420);
      // 칠판/보드
      c.fillStyle = '#1e293b';
      c.strokeStyle = '#94a3b8';
      c.lineWidth = 12;
      c.beginPath();
      c.roundRect(90, 220, 900, 460, 16);
      c.fill();
      c.stroke();
    } else {
      // 기본 집/거실 배경
      c.fillStyle = '#fef3c7';
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      c.fillStyle = '#fde68a';
      c.fillRect(0, 940, CANVAS_W, 410);
      // 창문
      c.fillStyle = '#e0f2fe';
      c.strokeStyle = '#d97706';
      c.lineWidth = 10;
      c.strokeRect(140, 240, 300, 300);
      c.fillRect(140, 240, 300, 300);
    }
  }

  // 상단 고정 헤더 바 & 컷 번호 배지
  c.save();
  c.fillStyle = 'rgba(15, 23, 42, 0.85)';
  c.fillRect(0, 0, CANVAS_W, 92);

  c.font = '700 32px "Noto Sans KR", sans-serif';
  c.fillStyle = '#f8fafc';
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.fillText(headerText || '감염병 예방 인스타툰', 36, 46);

  // 우측 페이지 번호 캡슐
  const pageStr = `${cutNumber} / ${totalCuts}`;
  c.fillStyle = '#3b82f6';
  c.beginPath();
  c.roundRect(CANVAS_W - 165, 20, 130, 52, 26);
  c.fill();

  c.font = '900 26px "Noto Sans KR", sans-serif';
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.fillText(pageStr, CANVAS_W - 100, 47);
  c.restore();
}

function drawCharacterLayer(c, item) {
  const { charId = 'tiger_normal.png', outfitId = 'none', outfitColor = '#3b82f6', x, y, width, height, flipX } = item;

  c.save();
  c.translate(x + width / 2, y + height / 2);
  if (flipX) c.scale(-1, 1);
  c.translate(-width / 2, -height / 2);

  // 1) 만약 실제 PNG 캐릭터가 로드되어 있으면 PNG 렌더링
  if (loadedImages[charId]) {
    c.drawImage(loadedImages[charId], 0, 0, width, height);
    if (outfitId && outfitId !== 'none' && loadedImages[outfitId]) {
      c.drawImage(loadedImages[outfitId], 0, 0, width, height);
    }
    c.restore();
    return;
  }

  // 2) 내장 귀여운 동물 캐릭터 벡터 드로잉 (호랑이, 토끼, 양, 말, 사자)
  const species = charId.split('_')[0]; // tiger, rabbit, sheep, horse, lion
  const mood = (charId.split('_')[1] || 'normal').replace('.png', '');

  let bodyColor = '#fbbf24'; // 호랑이 기본
  let earColor = '#f59e0b';
  if (species === 'rabbit') { bodyColor = '#ffffff'; earColor = '#fbcfe8'; }
  else if (species === 'sheep') { bodyColor = '#f8fafc'; earColor = '#cbd5e1'; }
  else if (species === 'horse') { bodyColor = '#b45309'; earColor = '#78350f'; }
  else if (species === 'lion') { bodyColor = '#f59e0b'; earColor = '#b45309'; }

  const cx = width * 0.5;
  const headY = height * 0.34;
  const headR = Math.min(width, height) * 0.28;

  c.lineWidth = 8;
  c.strokeStyle = '#1e293b';

  // 몸통 (상반신)
  c.fillStyle = bodyColor;
  c.beginPath();
  c.roundRect(width * 0.2, height * 0.54, width * 0.6, height * 0.42, 50);
  c.fill();
  c.stroke();

  // 의상 파츠 렌더링 (종이인형 결합)
  if (outfitId && outfitId !== 'none') {
    if (outfitId.includes('doctor')) {
      // 흰색 의사/연구원 가운 + 파란 셔츠
      c.fillStyle = outfitColor || '#3b82f6';
      c.fillRect(width * 0.38, height * 0.55, width * 0.24, height * 0.4);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.roundRect(width * 0.19, height * 0.54, width * 0.24, height * 0.42, 20);
      c.roundRect(width * 0.57, height * 0.54, width * 0.24, height * 0.42, 20);
      c.fill();
      c.stroke();
    } else if (outfitId.includes('hiking')) {
      // 등산복 긴팔 + 아웃도어 조끼
      c.fillStyle = outfitColor || '#10b981';
      c.beginPath();
      c.roundRect(width * 0.19, height * 0.54, width * 0.62, height * 0.42, 40);
      c.fill();
      c.stroke();
      // 지퍼 라인
      c.beginPath();
      c.moveTo(cx, height * 0.54);
      c.lineTo(cx, height * 0.96);
      c.stroke();
    } else {
      // 일반 캐주얼 티셔츠
      c.fillStyle = outfitColor || '#ec4899';
      c.beginPath();
      c.roundRect(width * 0.2, height * 0.54, width * 0.6, height * 0.42, 45);
      c.fill();
      c.stroke();
    }
  }

  // 동물별 귀 / 갈기
  if (species === 'rabbit') {
    // 긴 토끼 귀
    c.fillStyle = bodyColor;
    c.beginPath();
    c.ellipse(cx - headR * 0.45, headY - headR * 1.15, headR * 0.24, headR * 0.7, -0.1, 0, Math.PI * 2);
    c.ellipse(cx + headR * 0.45, headY - headR * 1.15, headR * 0.24, headR * 0.7, 0.1, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = earColor;
    c.beginPath();
    c.ellipse(cx - headR * 0.45, headY - headR * 1.15, headR * 0.12, headR * 0.48, -0.1, 0, Math.PI * 2);
    c.ellipse(cx + headR * 0.45, headY - headR * 1.15, headR * 0.12, headR * 0.48, 0.1, 0, Math.PI * 2);
    c.fill();
  } else if (species === 'lion') {
    // 사자 갈기
    c.fillStyle = '#b45309';
    c.beginPath();
    c.arc(cx, headY, headR * 1.28, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else {
    // 둥근 귀 (호랑이, 양, 말)
    c.fillStyle = earColor;
    c.beginPath();
    c.arc(cx - headR * 0.75, headY - headR * 0.7, headR * 0.34, 0, Math.PI * 2);
    c.arc(cx + headR * 0.75, headY - headR * 0.7, headR * 0.34, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // 머리 본체
  c.fillStyle = bodyColor;
  c.beginPath();
  c.arc(cx, headY, headR, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // 호랑이 줄무늬
  if (species === 'tiger') {
    c.fillStyle = '#1e293b';
    c.fillRect(cx - 12, headY - headR + 8, 24, 28);
    c.fillRect(cx - headR + 8, headY - 10, 26, 12);
    c.fillRect(cx + headR - 34, headY - 10, 26, 12);
  }

  // 표정(Mood)에 따른 눈 & 입 렌더링
  c.fillStyle = '#1e293b';
  const eyeY = headY - headR * 0.12;
  const eyeOffset = headR * 0.38;

  if (mood === 'shock') {
    // 동그랗게 커진 놀란 눈 + 벌어진 입
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(cx - eyeOffset, eyeY, 20, 0, Math.PI * 2);
    c.arc(cx + eyeOffset, eyeY, 20, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#1e293b';
    c.beginPath();
    c.arc(cx - eyeOffset, eyeY, 7, 0, Math.PI * 2);
    c.arc(cx + eyeOffset, eyeY, 7, 0, Math.PI * 2);
    c.fill();
    // 입
    c.fillStyle = '#ef4444';
    c.beginPath();
    c.ellipse(cx, headY + headR * 0.35, 22, 30, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else if (mood === 'sick') {
    // 아픈 눈 (X자 또는 처진 눈) + 홍조 + 체온계
    c.fillStyle = '#fca5a5';
    c.beginPath();
    c.arc(cx - eyeOffset * 1.2, headY + 18, 22, 0, Math.PI * 2);
    c.arc(cx + eyeOffset * 1.2, headY + 18, 22, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(cx - eyeOffset - 18, eyeY - 10); c.lineTo(cx - eyeOffset + 18, eyeY + 10);
    c.moveTo(cx + eyeOffset + 18, eyeY - 10); c.lineTo(cx + eyeOffset - 18, eyeY + 10);
    c.stroke();
    // 물결 입
    c.beginPath();
    c.arc(cx, headY + headR * 0.42, 22, Math.PI, 0);
    c.stroke();
  } else if (mood === 'good') {
    // 웃는 눈 (^ ^) + 엄지척 손
    c.beginPath();
    c.arc(cx - eyeOffset, eyeY + 6, 16, Math.PI, 0);
    c.stroke();
    c.beginPath();
    c.arc(cx + eyeOffset, eyeY + 6, 16, Math.PI, 0);
    c.stroke();
    c.fillStyle = '#ef4444';
    c.beginPath();
    c.arc(cx, headY + headR * 0.25, 24, 0, Math.PI);
    c.fill();
    c.stroke();
    // 엄지척 팔
    c.fillStyle = bodyColor;
    c.beginPath();
    c.arc(width * 0.84, height * 0.62, 36, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else if (mood === 'no') {
    // 단호한 눈썹 + X자 팔
    c.beginPath();
    c.arc(cx - eyeOffset, eyeY, 11, 0, Math.PI * 2);
    c.arc(cx + eyeOffset, eyeY, 11, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(cx - eyeOffset - 20, eyeY - 24); c.lineTo(cx - eyeOffset + 16, eyeY - 12);
    c.moveTo(cx + eyeOffset + 20, eyeY - 24); c.lineTo(cx + eyeOffset - 16, eyeY - 12);
    c.stroke();
    // X자 경고 표시
    c.strokeStyle = '#ef4444';
    c.lineWidth = 16;
    c.beginPath();
    c.moveTo(width * 0.35, height * 0.64); c.lineTo(width * 0.65, height * 0.88);
    c.moveTo(width * 0.65, height * 0.64); c.lineTo(width * 0.35, height * 0.88);
    c.stroke();
  } else {
    // normal & explain
    c.beginPath();
    c.arc(cx - eyeOffset, eyeY, 11, 0, Math.PI * 2);
    c.arc(cx + eyeOffset, eyeY, 11, 0, Math.PI * 2);
    c.fill();
    // 미소 입
    c.beginPath();
    c.arc(cx, headY + headR * 0.22, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();

    if (mood === 'explain') {
      // 안경 & 설명하는 손가락 포인트
      c.strokeStyle = '#1e3a8a';
      c.lineWidth = 5;
      c.strokeRect(cx - eyeOffset - 24, eyeY - 20, 48, 38);
      c.strokeRect(cx + eyeOffset - 24, eyeY - 20, 48, 38);
      c.beginPath();
      c.moveTo(cx - eyeOffset + 24, eyeY);
      c.lineTo(cx + eyeOffset - 24, eyeY);
      c.stroke();
      // 포인터 손
      c.fillStyle = bodyColor;
      c.strokeStyle = '#1e293b';
      c.lineWidth = 7;
      c.beginPath();
      c.arc(width * 0.85, height * 0.56, 32, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  }

  c.restore();
}

function drawStickerLayer(c, item) {
  const { stickerId = 'sticker_virus.png', x, y, width, height, flipX } = item;
  c.save();
  c.translate(x + width / 2, y + height / 2);
  if (flipX) c.scale(-1, 1);
  c.translate(-width / 2, -height / 2);

  if (loadedImages[stickerId]) {
    c.drawImage(loadedImages[stickerId], 0, 0, width, height);
    c.restore();
    return;
  }

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.36;

  if (stickerId.includes('tick')) {
    // 진드기 경고 아이콘
    c.fillStyle = '#fef2f2';
    c.strokeStyle = '#ef4444';
    c.lineWidth = 8;
    c.beginPath();
    c.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // 진드기 다리 8개
    c.strokeStyle = '#7f1d1d';
    c.lineWidth = 6;
    for (let i = -2; i <= 1; i++) {
      const angle = i * 0.35;
      c.beginPath();
      c.moveTo(cx - r * 0.9, cy + Math.sin(angle) * r * 0.8);
      c.lineTo(cx + r * 0.9, cy + Math.sin(angle) * r * 0.8);
      c.stroke();
    }
    c.fillStyle = '#991b1b';
    c.beginPath();
    c.ellipse(cx, cy + 6, r * 0.55, r * 0.7, 0, 0, Math.PI * 2);
    c.fill();
  } else if (stickerId.includes('soap')) {
    // 비누 거품 & 반짝임
    c.fillStyle = 'rgba(186, 230, 253, 0.88)';
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 5;
    [
      [cx - 25, cy + 15, r * 0.65],
      [cx + 30, cy - 15, r * 0.5],
      [cx + 10, cy + 35, r * 0.4]
    ].forEach(([bx, by, br]) => {
      c.beginPath();
      c.arc(bx, by, br, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
  } else if (stickerId.includes('check')) {
    // 초록색 예방 체크 배지
    c.fillStyle = '#10b981';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 14;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(cx - r * 0.45, cy);
    c.lineTo(cx - r * 0.1, cy + r * 0.38);
    c.lineTo(cx + r * 0.5, cy - r * 0.35);
    c.stroke();
  } else if (stickerId.includes('sweat')) {
    // 식은땀 물방울
    c.fillStyle = '#38bdf8';
    c.strokeStyle = '#0284c7';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(cx, cy - r);
    c.quadraticCurveTo(cx + r, cy + r * 0.3, cx, cy + r);
    c.quadraticCurveTo(cx - r, cy + r * 0.3, cx, cy - r);
    c.fill();
    c.stroke();
  } else {
    // 바이러스 아이콘
    c.fillStyle = '#a855f7';
    c.strokeStyle = '#6b21a8';
    c.lineWidth = 6;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
      c.stroke();
    }
    c.beginPath();
    c.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  c.restore();
}

function drawBubbleLayer(c, item) {
  const {
    x, y, width, height,
    text = '',
    speaker = '',
    bubbleStyle = 'round',
    tailDir = 'bottom',
    fontSize = 42,
    textColor = '#111827',
    bgColor = '#ffffff'
  } = item;

  c.save();

  // 그림자 효과
  c.shadowColor = 'rgba(0, 0, 0, 0.18)';
  c.shadowBlur = 16;
  c.shadowOffsetY = 6;

  c.fillStyle = bgColor;
  c.strokeStyle = bubbleStyle === 'shout' ? '#ef4444' : '#1e293b';
  c.lineWidth = bubbleStyle === 'title' ? 0 : 7;

  // 1) 말풍선 외곽선 및 꼬리 그리기
  if (bubbleStyle === 'thought') {
    c.setLineDash([14, 10]);
  }

  c.beginPath();
  const radius = bubbleStyle === 'narration' || bubbleStyle === 'title' ? 18 : 42;
  c.roundRect(x, y, width, height, radius);
  c.fill();
  if (bubbleStyle !== 'title') c.stroke();

  c.setLineDash([]);
  c.shadowColor = 'transparent';

  // 꼬리 추가
  if (tailDir !== 'none' && bubbleStyle !== 'narration' && bubbleStyle !== 'title') {
    let tailX = x + width * 0.5;
    if (tailDir === 'left') tailX = x + width * 0.25;
    else if (tailDir === 'right') tailX = x + width * 0.75;

    c.fillStyle = bgColor;
    c.beginPath();
    c.moveTo(tailX - 26, y + height - 4);
    c.lineTo(tailX + (tailDir === 'left' ? -38 : tailDir === 'right' ? 38 : 0), y + height + 46);
    c.lineTo(tailX + 26, y + height - 4);
    c.closePath();
    c.fill();

    c.beginPath();
    c.moveTo(tailX - 26, y + height - 2);
    c.lineTo(tailX + (tailDir === 'left' ? -38 : tailDir === 'right' ? 38 : 0), y + height + 46);
    c.lineTo(tailX + 26, y + height - 2);
    c.stroke();
  }

  // 2) 화자 이름표 배지
  if (speaker && speaker.trim() !== '') {
    c.font = '700 26px "Noto Sans KR", sans-serif';
    const tagW = c.measureText(speaker).width + 38;
    c.fillStyle = bubbleStyle === 'title' ? '#f59e0b' : '#1e293b';
    c.beginPath();
    c.roundRect(x + 28, y - 22, tagW, 44, 22);
    c.fill();

    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(speaker, x + 28 + tagW / 2, y);
  }

  // 3) 대사 텍스트 멀티라인 자동 줄바꿈 렌더링
  c.fillStyle = textColor;
  const fontFamily = bubbleStyle === 'title' ? '"Jua", "Noto Sans KR", sans-serif' : '"Noto Sans KR", sans-serif';
  c.font = `700 ${fontSize}px ${fontFamily}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  const maxLineW = width - 64;
  const rawLines = String(text).split('\n');
  const wrappedLines = [];

  rawLines.forEach(rawLine => {
    let currentLine = '';
    for (let i = 0; i < rawLine.length; i++) {
      const testLine = currentLine + rawLine[i];
      if (c.measureText(testLine).width > maxLineW && currentLine.length > 0) {
        wrappedLines.push(currentLine);
        currentLine = rawLine[i];
      } else {
        currentLine = testLine;
      }
    }
    wrappedLines.push(currentLine);
  });

  const lineHeight = fontSize * 1.35;
  const totalTextH = wrappedLines.length * lineHeight;
  let startY = y + (height - totalTextH) / 2 + lineHeight / 2;

  wrappedLines.forEach(line => {
    c.fillText(line, x + width / 2, startY);
    startY += lineHeight;
  });

  c.restore();
}

// ============================================================================
// 5. 캔버스 렌더링 및 썸네일/그리드 동기화
// ============================================================================
function renderCutToContext(targetCtx, cutIndex, showSelection = false) {
  const cut = appState.cuts[cutIndex];
  if (!cut) return;

  targetCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 1) 배경 및 상단 헤더
  drawBackgroundAsset(
    targetCtx,
    cut.background || 'bg_home.png',
    cut.headerText || '',
    cutIndex + 1,
    appState.cuts.length
  );

  // 2) 레이어 순서대로 그리기
  (cut.items || []).forEach((item, idx) => {
    const t = (item.type || '').toLowerCase();
    if (t === 'character') drawCharacterLayer(targetCtx, item);
    else if (t === 'sticker') drawStickerLayer(targetCtx, item);
    else if (t === 'bubble') drawBubbleLayer(targetCtx, item);

    // 선택된 요소 테두리 및 모서리 크기 조절 핸들 표시 (편집 화면 전용)
    if (showSelection && idx === appState.selectedLayerIndex) {
      drawSelectionBox(targetCtx, item);
    }
  });
}

function drawSelectionBox(c, item) {
  c.save();
  c.strokeStyle = '#3b82f6';
  c.lineWidth = 5;
  c.setLineDash([12, 8]);
  c.strokeRect(item.x, item.y, item.width, item.height);
  c.setLineDash([]);

  // 4개 모서리 리사이즈 핸들
  const corners = [
    [item.x, item.y],
    [item.x + item.width, item.y],
    [item.x, item.y + item.height],
    [item.x + item.width, item.y + item.height]
  ];
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#2563eb';
  c.lineWidth = 5;
  corners.forEach(([cx, cy]) => {
    c.beginPath();
    c.rect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    c.fill();
    c.stroke();
  });
  c.restore();
}

function renderAll() {
  // 메인 캔버스 렌더링
  renderCutToContext(ctx, appState.currentCutIndex, true);

  // 상단 컷 표시 업데이트
  document.getElementById('cutCountLabel').textContent = appState.cuts.length;
  document.getElementById('currentCutIndicator').textContent = `${appState.currentCutIndex + 1} / ${appState.cuts.length} 컷`;

  // 우측 패널 업데이트
  syncInspectorWithSelection();

  // 좌측 썸네일 및 전체 그리드 뷰 업데이트
  renderThumbnailsAndGrid();
}

function renderThumbnailsAndGrid() {
  const thumbList = document.getElementById('cutThumbList');
  const fullGrid = document.getElementById('fullGridContainer');
  thumbList.innerHTML = '';
  fullGrid.innerHTML = '';

  const offCanvas = document.createElement('canvas');
  offCanvas.width = CANVAS_W;
  offCanvas.height = CANVAS_H;
  const offCtx = offCanvas.getContext('2d');

  appState.cuts.forEach((cut, idx) => {
    renderCutToContext(offCtx, idx, false);
    const dataUrl = offCanvas.toDataURL('image/png');

    // 1) 좌측 미니 썸네일 카드
    const card = document.createElement('div');
    card.className = `cut-thumb-card ${idx === appState.currentCutIndex ? 'active' : ''}`;
    card.innerHTML = `
      <div class="cut-thumb-header">
        <span>#${String(idx + 1).padStart(2, '0')}컷</span>
        <span>${(cut.items || []).length}요소</span>
      </div>
      <img src="${dataUrl}" class="cut-thumb-preview" alt="${idx + 1}컷 미리보기">
    `;
    card.addEventListener('click', () => {
      appState.currentCutIndex = idx;
      appState.selectedLayerIndex = -1;
      renderAll();
    });
    thumbList.appendChild(card);

    // 2) 중앙 10컷 전체 그리드 카드
    if (appState.viewMode === 'grid') {
      const gridItem = document.createElement('div');
      gridItem.className = 'grid-cut-item';
      gridItem.innerHTML = `
        <div class="grid-cut-top">
          <span>${idx + 1}번째 컷</span>
          <button class="btn btn-outline-sm btn-edit-this">편집하기</button>
        </div>
        <img src="${dataUrl}" class="grid-cut-img" alt="${idx + 1}컷">
      `;
      gridItem.querySelector('.grid-cut-img').addEventListener('click', () => switchToCutEdit(idx));
      gridItem.querySelector('.btn-edit-this').addEventListener('click', () => switchToCutEdit(idx));
      fullGrid.appendChild(gridItem);
    }
  });
}

function switchToCutEdit(cutIdx) {
  appState.currentCutIndex = cutIdx;
  appState.selectedLayerIndex = -1;
  setViewMode('single');
}

function setViewMode(mode) {
  appState.viewMode = mode;
  document.getElementById('tabSingleView').classList.toggle('active', mode === 'single');
  document.getElementById('tabGridView').classList.toggle('active', mode === 'grid');
  document.getElementById('singleEditorView').classList.toggle('hidden', mode !== 'single');
  document.getElementById('gridEditorView').classList.toggle('hidden', mode !== 'grid');
  renderAll();
}

// ============================================================================
// 6. 마우스 드래그 이동 & 모서리 핸들 크기 조절 로직
// ============================================================================
function getCanvasMousePos(e) {
  const rect = mainCanvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function hitTestHandle(pos, item) {
  const r = HANDLE_SIZE;
  const corners = {
    'resize-nw': [item.x, item.y],
    'resize-ne': [item.x + item.width, item.y],
    'resize-sw': [item.x, item.y + item.height],
    'resize-se': [item.x + item.width, item.y + item.height]
  };
  for (const [mode, [cx, cy]] of Object.entries(corners)) {
    if (Math.abs(pos.x - cx) <= r && Math.abs(pos.y - cy) <= r) {
      return mode;
    }
  }
  return null;
}

function bindCanvasMouseEvents() {
  mainCanvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasMousePos(e);
    const cut = appState.cuts[appState.currentCutIndex];
    if (!cut) return;

    // 1) 이미 선택된 레이어의 모서리 크기 조절 핸들을 클릭했는지 먼저 확인
    if (appState.selectedLayerIndex >= 0 && cut.items[appState.selectedLayerIndex]) {
      const selItem = cut.items[appState.selectedLayerIndex];
      const handleMode = hitTestHandle(pos, selItem);
      if (handleMode) {
        dragState = {
          isDragging: true,
          mode: handleMode,
          startX: pos.x,
          startY: pos.y,
          initialBox: { x: selItem.x, y: selItem.y, width: selItem.width, height: selItem.height }
        };
        return;
      }
    }

    // 2) 위에서 아래(맨 앞 레이어부터)로 클릭한 요소 탐색
    let foundIdx = -1;
    for (let i = cut.items.length - 1; i >= 0; i--) {
      const it = cut.items[i];
      if (pos.x >= it.x && pos.x <= it.x + it.width && pos.y >= it.y && pos.y <= it.y + it.height) {
        foundIdx = i;
        break;
      }
    }

    appState.selectedLayerIndex = foundIdx;
    if (foundIdx >= 0) {
      const selItem = cut.items[foundIdx];
      dragState = {
        isDragging: true,
        mode: 'move',
        startX: pos.x,
        startY: pos.y,
        initialBox: { x: selItem.x, y: selItem.y, width: selItem.width, height: selItem.height }
      };
    }
    renderAll();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragState.isDragging) return;
    const cut = appState.cuts[appState.currentCutIndex];
    const item = cut?.items[appState.selectedLayerIndex];
    if (!item) return;

    const pos = getCanvasMousePos(e);
    const dx = pos.x - dragState.startX;
    const dy = pos.y - dragState.startY;
    const b = dragState.initialBox;

    if (dragState.mode === 'move') {
      item.x = Math.round(b.x + dx);
      item.y = Math.round(b.y + dy);
    } else if (dragState.mode === 'resize-se') {
      item.width = Math.max(80, Math.round(b.width + dx));
      item.height = Math.max(80, Math.round(b.height + dy));
    } else if (dragState.mode === 'resize-sw') {
      const newW = Math.max(80, Math.round(b.width - dx));
      item.x = Math.round(b.x + (b.width - newW));
      item.width = newW;
      item.height = Math.max(80, Math.round(b.height + dy));
    } else if (dragState.mode === 'resize-ne') {
      const newH = Math.max(80, Math.round(b.height - dy));
      item.y = Math.round(b.y + (b.height - newH));
      item.width = Math.max(80, Math.round(b.width + dx));
      item.height = newH;
    } else if (dragState.mode === 'resize-nw') {
      const newW = Math.max(80, Math.round(b.width - dx));
      const newH = Math.max(80, Math.round(b.height - dy));
      item.x = Math.round(b.x + (b.width - newW));
      item.y = Math.round(b.y + (b.height - newH));
      item.width = newW;
      item.height = newH;
    }

    renderCutToContext(ctx, appState.currentCutIndex, true);
  });

  window.addEventListener('mouseup', () => {
    if (dragState.isDragging) {
      dragState.isDragging = false;
      renderAll();
    }
  });
}

// ============================================================================
// 7. 우측 속성 인스펙터 연동 및 실시간 수정
// ============================================================================
function syncInspectorWithSelection() {
  const cut = appState.cuts[appState.currentCutIndex];
  if (!cut) return;

  // 컷 공통 설정 동기화
  document.getElementById('bgSelect').value = cut.background || 'bg_home.png';
  document.getElementById('cutHeaderInput').value = cut.headerText || '';

  const item = cut.items[appState.selectedLayerIndex];
  const noSelMsg = document.getElementById('noSelectionMsg');
  const commonCtrl = document.getElementById('commonLayerControls');
  const charInsp = document.getElementById('charInspector');
  const bubbleInsp = document.getElementById('bubbleInspector');
  const stickerInsp = document.getElementById('stickerInspector');
  const badge = document.getElementById('selectedTypeBadge');

  charInsp.classList.add('hidden');
  bubbleInsp.classList.add('hidden');
  stickerInsp.classList.add('hidden');

  if (!item) {
    noSelMsg.classList.remove('hidden');
    commonCtrl.classList.add('hidden');
    badge.textContent = '선택 없음';
    return;
  }

  noSelMsg.classList.add('hidden');
  commonCtrl.classList.remove('hidden');

  const type = (item.type || '').toLowerCase();
  if (type === 'character') {
    badge.textContent = '🐯 캐릭터';
    charInsp.classList.remove('hidden');
    document.getElementById('charSelect').value = item.charId || 'tiger_normal.png';
    document.getElementById('outfitSelect').value = item.outfitId || 'none';
    document.getElementById('outfitColorInput').value = item.outfitColor || '#3b82f6';
  } else if (type === 'bubble') {
    badge.textContent = '💬 말풍선';
    bubbleInsp.classList.remove('hidden');
    document.getElementById('speakerInput').value = item.speaker || '';
    document.getElementById('dialogueTextarea').value = item.text || '';
    document.getElementById('bubbleStyleSelect').value = item.bubbleStyle || 'round';
    document.getElementById('bubbleTailSelect').value = item.tailDir || 'bottom';
    document.getElementById('fontSizeInput').value = item.fontSize || 42;
    document.getElementById('textColorInput').value = item.textColor || '#111827';
    document.getElementById('bubbleBgColorInput').value = item.bgColor || '#ffffff';
  } else if (type === 'sticker') {
    badge.textContent = '✨ 스티커';
    stickerInsp.classList.remove('hidden');
    document.getElementById('stickerSelect').value = item.stickerId || 'sticker_virus.png';
  }
}

// ============================================================================
// 8. UI 버튼 이벤트 바인딩
// ============================================================================
function bindUIEvents() {
  // GitHub 동기화 및 로컬 파일 추가
  document.getElementById('btnSyncGithub').addEventListener('click', () => {
    const owner = document.getElementById('ghOwner').value.trim();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';
    syncGithubAssets(owner, repo, branch, false);
  });

  document.getElementById('localAssetInput').addEventListener('change', handleLocalAssetUpload);

  // 대본 적용 및 샘플 로드
  document.getElementById('btnLoadSample').addEventListener('click', () => {
    const sample = getSampleScriptData();
    document.getElementById('jsonScriptInput').value = JSON.stringify(sample, null, 2);
    applyScriptToState(sample);
  });

  document.getElementById('btnGenerateWebtoon').addEventListener('click', () => {
    const raw = document.getElementById('jsonScriptInput').value.trim();
    if (!raw) return alert('JSON 대본을 입력해 주세요.');
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      applyScriptToState(parsed);
    } catch (err) {
      alert('JSON 형식이 올바르지 않습니다. 오타나 중괄호 짝을 확인해 주세요.\n오류: ' + err.message);
    }
  });

  // 뷰 모드 전환
  document.getElementById('tabSingleView').addEventListener('click', () => setViewMode('single'));
  document.getElementById('tabGridView').addEventListener('click', () => setViewMode('grid'));

  // 컷 이동 및 관리
  document.getElementById('btnPrevCut').addEventListener('click', () => {
    if (appState.currentCutIndex > 0) {
      appState.currentCutIndex--;
      appState.selectedLayerIndex = -1;
      renderAll();
    }
  });

  document.getElementById('btnNextCut').addEventListener('click', () => {
    if (appState.currentCutIndex < appState.cuts.length - 1) {
      appState.currentCutIndex++;
      appState.selectedLayerIndex = -1;
      renderAll();
    }
  });

  document.getElementById('btnAddCut').addEventListener('click', () => {
    appState.cuts.push({
      background: 'bg_home.png',
      headerText: `새로운 컷 (${appState.cuts.length + 1})`,
      items: [
        { type: 'character', charId: 'tiger_normal.png', outfitId: 'outfit_doctor.png', outfitColor: '#3b82f6', x: 320, y: 540, width: 420, height: 680, flipX: false },
        { type: 'bubble', bubbleStyle: 'round', tailDir: 'bottom', speaker: '호랑이 연구원', text: '대사를 입력해 주세요!', fontSize: 42, textColor: '#111827', bgColor: '#ffffff', x: 100, y: 180, width: 880, height: 250 }
      ]
    });
    appState.currentCutIndex = appState.cuts.length - 1;
    appState.selectedLayerIndex = -1;
    renderAll();
  });

  document.getElementById('btnDuplicateCut').addEventListener('click', () => {
    const cur = appState.cuts[appState.currentCutIndex];
    if (!cur) return;
    const clone = JSON.parse(JSON.stringify(cur));
    appState.cuts.splice(appState.currentCutIndex + 1, 0, clone);
    appState.currentCutIndex++;
    renderAll();
  });

  document.getElementById('btnMoveCutLeft').addEventListener('click', () => {
    const idx = appState.currentCutIndex;
    if (idx <= 0) return;
    const temp = appState.cuts[idx - 1];
    appState.cuts[idx - 1] = appState.cuts[idx];
    appState.cuts[idx] = temp;
    appState.currentCutIndex--;
    renderAll();
  });

  document.getElementById('btnMoveCutRight').addEventListener('click', () => {
    const idx = appState.currentCutIndex;
    if (idx >= appState.cuts.length - 1) return;
    const temp = appState.cuts[idx + 1];
    appState.cuts[idx + 1] = appState.cuts[idx];
    appState.cuts[idx] = temp;
    appState.currentCutIndex++;
    renderAll();
  });

  document.getElementById('btnDeleteCut').addEventListener('click', () => {
    if (appState.cuts.length <= 1) return alert('최소 1개의 컷은 유지해야 합니다.');
    appState.cuts.splice(appState.currentCutIndex, 1);
    appState.currentCutIndex = Math.max(0, appState.currentCutIndex - 1);
    appState.selectedLayerIndex = -1;
    renderAll();
  });

  // 현재 컷 배경 & 상단 문구 변경
  document.getElementById('bgSelect').addEventListener('change', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.background = e.target.value; renderAll(); }
  });

  document.getElementById('cutHeaderInput').addEventListener('input', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.headerText = e.target.value; renderAll(); }
  });

  // 요소 추가 버튼 3종
  document.getElementById('btnAddChar').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    cut.items.push({
      type: 'character',
      charId: 'rabbit_normal.png',
      outfitId: 'outfit_casual.png',
      outfitColor: '#10b981',
      x: 340, y: 550, width: 400, height: 660, flipX: false
    });
    appState.selectedLayerIndex = cut.items.length - 1;
    renderAll();
  });

  document.getElementById('btnAddBubble').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    cut.items.push({
      type: 'bubble',
      bubbleStyle: 'round',
      tailDir: 'bottom',
      speaker: '등장인물',
      text: '여기에 새로운 대사를 입력하세요',
      fontSize: 42,
      textColor: '#111827',
      bgColor: '#ffffff',
      x: 120, y: 200, width: 840, height: 250
    });
    appState.selectedLayerIndex = cut.items.length - 1;
    renderAll();
  });

  document.getElementById('btnAddSticker').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    cut.items.push({
      type: 'sticker',
      stickerId: 'sticker_check.png',
      x: 450, y: 480, width: 180, height: 180, flipX: false
    });
    appState.selectedLayerIndex = cut.items.length - 1;
    renderAll();
  });

  // 공통 레이어 조작 (좌우 반전, 맨앞, 맨뒤, 삭제)
  document.getElementById('btnFlipX').addEventListener('click', () => {
    const item = getSelectedItem();
    if (item) { item.flipX = !item.flipX; renderAll(); }
  });

  document.getElementById('btnBringFront').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    const idx = appState.selectedLayerIndex;
    if (cut && idx >= 0 && idx < cut.items.length - 1) {
      const [item] = cut.items.splice(idx, 1);
      cut.items.push(item);
      appState.selectedLayerIndex = cut.items.length - 1;
      renderAll();
    }
  });

  document.getElementById('btnSendBack').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    const idx = appState.selectedLayerIndex;
    if (cut && idx > 0) {
      const [item] = cut.items.splice(idx, 1);
      cut.items.unshift(item);
      appState.selectedLayerIndex = 0;
      renderAll();
    }
  });

  document.getElementById('btnDeleteLayer').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    const idx = appState.selectedLayerIndex;
    if (cut && idx >= 0) {
      cut.items.splice(idx, 1);
      appState.selectedLayerIndex = -1;
      renderAll();
    }
  });

  // 캐릭터 속성 변경
  document.getElementById('charSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { item.charId = e.target.value; renderAll(); }
  });

  document.getElementById('outfitSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { item.outfitId = e.target.value; renderAll(); }
  });

  document.getElementById('outfitColorInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.outfitColor = e.target.value; renderAll(); }
  });

  // 말풍선 속성 실시간 변경
  document.getElementById('speakerInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.speaker = e.target.value; renderAll(); }
  });

  document.getElementById('dialogueTextarea').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.text = e.target.value; renderAll(); }
  });

  document.getElementById('bubbleStyleSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { item.bubbleStyle = e.target.value; renderAll(); }
  });

  document.getElementById('bubbleTailSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { item.tailDir = e.target.value; renderAll(); }
  });

  document.getElementById('fontSizeInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.fontSize = Number(e.target.value) || 42; renderAll(); }
  });

  document.getElementById('textColorInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.textColor = e.target.value; renderAll(); }
  });

  document.getElementById('bubbleBgColorInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.bgColor = e.target.value; renderAll(); }
  });

  // 스티커 변경
  document.getElementById('stickerSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { item.stickerId = e.target.value; renderAll(); }
  });

  // 제미나이 마스터 프롬프트 모달
  document.getElementById('btnOpenPromptModal').addEventListener('click', openMasterPromptModal);
  document.getElementById('btnClosePromptModal').addEventListener('click', () => {
    document.getElementById('promptModal').classList.add('hidden');
  });
  document.getElementById('btnCopyMasterPrompt').addEventListener('click', () => {
    const textarea = document.getElementById('masterPromptText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    alert('제미나이 대본 작가용 프롬프트가 클립보드에 복사되었습니다!');
  });

  // 맞춤 파일명 다운로드 (단일 컷 & 전체 ZIP)
  document.getElementById('btnDownloadCurrent').addEventListener('click', downloadCurrentCutPng);
  document.getElementById('btnDownloadZip').addEventListener('click', downloadAllCutsZip);
}

function getSelectedItem() {
  const cut = appState.cuts[appState.currentCutIndex];
  return cut ? cut.items[appState.selectedLayerIndex] : null;
}

function applyScriptToState(scriptObj) {
  if (scriptObj.episodeTitle) {
    appState.episodeTitle = scriptObj.episodeTitle;
    document.getElementById('episodeTitleInput').value = scriptObj.episodeTitle;
  }
  if (Array.isArray(scriptObj.cuts) && scriptObj.cuts.length > 0) {
    appState.cuts = scriptObj.cuts;
    appState.currentCutIndex = 0;
    appState.selectedLayerIndex = -1;
    renderAll();
  } else {
    alert('대본 JSON 안에 유효한 cuts 배열이 없습니다.');
  }
}

// ============================================================================
// 9. 맞춤 파일명 개별 저장 및 ZIP 일괄 다운로드 ({에피소드명}_01.png)
// ============================================================================
function getSanitizedEpisodeName() {
  const raw = document.getElementById('episodeTitleInput').value.trim();
  const safe = raw.replace(/[\\/:*?"<>|]/g, '_');
  return safe || '웹툰';
}

function downloadCurrentCutPng() {
  const epName = getSanitizedEpisodeName();
  const numStr = String(appState.currentCutIndex + 1).padStart(2, '0');
  const fileName = `${epName}_${numStr}.png`;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = CANVAS_W;
  exportCanvas.height = CANVAS_H;
  renderCutToContext(exportCanvas.getContext('2d'), appState.currentCutIndex, false);

  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

async function downloadAllCutsZip() {
  if (typeof JSZip === 'undefined') {
    return alert('JSZip 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  }

  const epName = getSanitizedEpisodeName();
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  overlay.classList.remove('hidden');

  try {
    const zip = new JSZip();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = CANVAS_W;
    exportCanvas.height = CANVAS_H;
    const exportCtx = exportCanvas.getContext('2d');

    for (let i = 0; i < appState.cuts.length; i++) {
      const numStr = String(i + 1).padStart(2, '0');
      const imgFileName = `${epName}_${numStr}.png`;
      loadingText.textContent = `${imgFileName} 렌더링 중... (${i + 1} / ${appState.cuts.length})`;

      renderCutToContext(exportCtx, i, false);
      const blob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/png'));
      zip.file(imgFileName, blob);
    }

    loadingText.textContent = `${epName}.zip 압축 파일 생성 중...`;
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${epName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('ZIP 파일 생성 중 오류가 발생했습니다: ' + err.message);
  } finally {
    overlay.classList.add('hidden');
  }
}

// ============================================================================
// 10. 제미나이 대본 작가용 마스터 프롬프트 생성기 (현재 에셋 목록 자동 반영)
// ============================================================================
function openMasterPromptModal() {
  const chars = DEFAULT_ASSETS.characters.map(i => i.id).join(', ');
  const outfits = DEFAULT_ASSETS.outfits.map(i => i.id).join(', ');
  const bgs = DEFAULT_ASSETS.backgrounds.map(i => i.id).join(', ');
  const stickers = DEFAULT_ASSETS.stickers.map(i => i.id).join(', ');

  const prompt = `너는 우리 기관 인스타그램의 '감염병 예방 10컷 인스타툰' 전담 스토리 작가야.
내가 아래에 전달하는 [감염병 지침 내용]과 [원하는 주제(예: 1탄 감염경로, 2탄 증상, 3탄 예방법, 또는 기승전-손씻기 일상사연)]를 바탕으로 흥미진진한 라디오 사연식 10컷 웹툰 대본을 JSON 형식으로 작성해 줘.

[작성 규칙]
1. 반드시 순수 JSON 코드만 출력해 (설명 생략).
2. "episodeTitle" 값에는 파일 저장용 제목(예: "SFTS_예방법", "노로바이러스_손씻기")을 공백 대신 언더바(_)로 넣어 줘.
3. "cuts" 배열에는 정확히 10개의 컷 객체를 구성해.
4. 각 컷에서 사용할 수 있는 에셋 파일명은 다음과 같아:
   - background (배경): ${bgs}
   - charId (캐릭터_표정): ${chars}
   - outfitId (의상 파츠): ${outfits}
   - stickerId (스티커): ${stickers}
5. 캔버스 크기는 가로 1080, 세로 1350이야.
   - 캐릭터 1명일 때 추천 좌표: x: 320, y: 540, width: 420, height: 680
   - 캐릭터 2명이 마주 볼 때: 왼쪽 캐릭터(x: 120, y: 540, width: 410, height: 670, flipX: false), 오른쪽 캐릭터(x: 560, y: 550, width: 390, height: 650, flipX: true)
   - 말풍선 추천 좌표: x: 90, y: 170, width: 900, height: 260 (대사는 2줄 이내로 줄바꿈 \\n 포함)

[JSON 출력 양식 예시]
{
  "episodeTitle": "감염병명_주제",
  "cuts": [
    {
      "background": "bg_forest.png",
      "headerText": "[시리즈 1탄] 상단 소제목",
      "items": [
        { "type": "character", "charId": "tiger_explain.png", "outfitId": "outfit_doctor.png", "outfitColor": "#3b82f6", "x": 120, "y": 540, "width": 410, "height": 670, "flipX": false },
        { "type": "character", "charId": "rabbit_shock.png", "outfitId": "outfit_casual.png", "outfitColor": "#ec4899", "x": 560, "y": 550, "width": 390, "height": 650, "flipX": true },
        { "type": "sticker", "stickerId": "sticker_tick.png", "x": 800, "y": 460, "width": 160, "height": 160, "flipX": false },
        { "type": "bubble", "bubbleStyle": "title", "tailDir": "none", "speaker": "감염병 사연툰", "text": "첫 번째 표지 타이틀 문구\\n두 번째 줄 문구!", "fontSize": 46, "textColor": "#ffffff", "bgColor": "#1e3a8a", "x": 80, "y": 150, "width": 920, "height": 270 }
      ]
    }
  ]
}

---
[내가 요청할 감염병 지침 및 이번 편 주제]:
(여기에 지침 내용이나 주제를 적어주세요)`;

  document.getElementById('masterPromptText').value = prompt;
  document.getElementById('promptModal').classList.remove('hidden');
}
