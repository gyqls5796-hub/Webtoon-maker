/**
 * 인스타그램 10컷 웹툰 자동 제작기 (하이브리드 AI 작화 + 사연툰 자막 마감 에디션)
 * - 1080 x 1350px 고해상도 캔버스
 * - AI가 통짜로 그린 10컷 장면 일괄 업로드 & 자동 배치
 * - 오리지널 굵은 펜선 동물 연구원 화풍 프롬프트 자동 생성기 탑재
 * - 기존 PNG 파츠 조립, 사연툰 상·하단 외곽선 자막, 비네팅·집중선 연출, 맞춤 파일명 ZIP 저장 지원
 */

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const HANDLE_SIZE = 24;

// 기본 에셋 목록
const DEFAULT_ASSETS = {
  characters: [
    { id: 'none', label: '캐릭터 파츠 사용 안 함 (AI 통짜 그림 사용)' },
    { id: 'tiger_normal.png', label: '🐯 호랑이 (기본/일상)' },
    { id: 'tiger_explain.png', label: '🐯 호랑이 (설명/지적)' },
    { id: 'tiger_no.png', label: '🐯 호랑이 (단호/경고)' },
    { id: 'tiger_good.png', label: '🐯 호랑이 (엄지척/칭찬)' },
    { id: 'rabbit_normal.png', label: '🐰 토끼 (기본/일상)' },
    { id: 'rabbit_shock.png', label: '🐰 토끼 (식은땀/당황)' },
    { id: 'rabbit_sick.png', label: '🐰 토끼 (아픔/발열)' },
    { id: 'rabbit_good.png', label: '🐰 토끼 (활짝웃음/해결)' },
    { id: 'sheep_normal.png', label: '🐑 양 (기본/순둥)' },
    { id: 'horse_normal.png', label: '🐴 말 (기본/활발)' },
    { id: 'lion_explain.png', label: '🦁 사자 (박사/설명)' }
  ],
  outfits: [
    { id: 'none', label: '의상 없음' },
    { id: 'outfit_doctor.png', label: '🥼 연구원/의사 가운' },
    { id: 'outfit_hiking.png', label: '🧥 야외/등산용 긴팔 조끼' },
    { id: 'outfit_casual.png', label: '👕 일상 캐주얼 티셔츠' }
  ],
  backgrounds: [
    { id: 'bg_forest.png', label: '🌲 풀숲/등산로 (기본 테마)' },
    { id: 'bg_hospital.png', label: '🏥 진료실/보건소 (기본 테마)' },
    { id: 'bg_home.png', label: '🏠 거실/일상 공간 (기본 테마)' },
    { id: 'bg_bathroom.png', label: '🚰 세면대/화장실 (기본 테마)' },
    { id: 'bg_office.png', label: '🏢 연구소/브리핑룸 (기본 테마)' },
    { id: 'bg_dark_mood.png', label: '🌑 어두운 심리/긴장 배경' }
  ],
  stickers: [
    { id: 'sticker_crowd.png', label: '👥 수군거리는 엑스트라 군중 실루엣' },
    { id: 'sticker_tick.png', label: '🕷️ 진드기/해충 경고' },
    { id: 'sticker_virus.png', label: '🦠 바이러스/세균 아이콘' },
    { id: 'sticker_soap.png', label: '🧼 비누 거품/손씻기 반짝임' },
    { id: 'sticker_check.png', label: '✅ 핵심 예방 체크마크' }
  ]
};

const loadedImages = {};

let appState = {
  episodeTitle: 'SFTS_예방법',
  currentCutIndex: 0,
  selectedLayerIndex: -1,
  viewMode: 'single',
  cuts: []
};

let dragState = {
  isDragging: false,
  mode: null,
  startX: 0,
  startY: 0,
  initialBox: null
};

const mainCanvas = document.getElementById('mainCanvas');
const ctx = mainCanvas.getContext('2d');

// ============================================================================
// 1. 샘플 10컷 데이터 (scenePrompt: 제미나이 이미지 작화용 지시문 포함)
// ============================================================================
function getSampleScriptData() {
  return {
    episodeTitle: "SFTS_예방법",
    cuts: [
      {
        background: "bg_forest.png",
        scenePrompt: "반팔과 반바지를 입고 해맑게 등산하는 귀여운 토끼 캐릭터와, 옆에서 흰색 연구원 가운을 입고 팔로 X자를 그리며 다급하게 말리는 듬직한 호랑이 연구원 캐릭터, 배경은 흐릿한 숲속 등산로",
        blurBg: true,
        darkMood: false,
        speedLines: false,
        captionStyle: "outline",
        captionSize: 52,
        headerText: "등산 갈 때 반팔·반바지?\n진드기가 제일 좋아하는 맛집입니다",
        footerText: "SFTS(중증열성혈소판감소증후군) 완벽 예방법 편",
        items: [
          { type: "bubble", bubbleStyle: "sfx", tailDir: "none", speaker: "", text: "잠깐 스톱!!", fontSize: 52, textColor: "#111827", bgColor: "#fde047", x: 340, y: 230, width: 400, height: 180 }
        ]
      },
      {
        background: "bg_home.png",
        scenePrompt: "주말 아침 거실에서 반팔 티셔츠를 입고 신나서 양팔을 번쩍 들고 있는 토끼 캐릭터와 옆에서 웃고 있는 양 캐릭터, 밝고 경쾌한 분위기",
        blurBg: false,
        darkMood: false,
        speedLines: false,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "지난 주말, 친구와 함께\n뒷산에 놀러 갔던 날이었어요",
        footerText: "",
        items: [
          { type: "bubble", bubbleStyle: "round", tailDir: "left", speaker: "", text: "날씨도 선선한데\n시원하게 반팔 입고 가자!", fontSize: 42, textColor: "#111827", bgColor: "#ffffff", x: 110, y: 220, width: 520, height: 220 }
        ]
      },
      {
        background: "bg_forest.png",
        scenePrompt: "풀밭에 돗자리 없이 맨다리로 털썩 주저앉아 땀을 닦으며 웃는 토끼 캐릭터, 뒤쪽 풀숲에는 어두운 회색 실루엣의 작은 진드기들이 숨어 노려보는 코믹하고 긴장감 있는 구도",
        blurBg: true,
        darkMood: false,
        speedLines: true,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "한창 신나게 산을 오르다가\n풀밭에 털썩 주저앉았는데요",
        footerText: "풀숲에는 작은소피참진드기가 숨어 있었어요",
        items: [
          { type: "bubble", bubbleStyle: "sfx", tailDir: "none", speaker: "", text: "하하하!\n여기 시원하다!!", fontSize: 44, textColor: "#111827", bgColor: "#fef08a", x: 120, y: 220, width: 430, height: 210 }
        ]
      },
      {
        background: "bg_dark_mood.png",
        scenePrompt: "얼굴에 식은땀을 흘리며 당황한 표정으로 자신의 종아리를 내려다보는 토끼 캐릭터 클로즈업, 화면 주변부가 어둡고 스산한 분위기",
        blurBg: false,
        darkMood: true,
        speedLines: false,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "처음엔 저도 긴가민가했고",
        footerText: "그래서 처음엔 대수롭지 않게 넘겼어요",
        items: [
          { type: "bubble", bubbleStyle: "thought", tailDir: "left", speaker: "", text: "어..? 다리가 살짝\n따끔한 것 같은데?\n풀에 스친 거겠지?", fontSize: 40, textColor: "#111827", bgColor: "#fda4af", x: 110, y: 200, width: 540, height: 250 }
        ]
      },
      {
        background: "bg_office.png",
        scenePrompt: "흰색 연구원 가운을 입은 호랑이 연구원이 화면 정면을 향해 한 손가락을 치켜세우며 진지하고 단호하게 경고하는 상반신 클로즈업, 배경에 만화 집중선 효과",
        blurBg: false,
        darkMood: false,
        speedLines: true,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "그때! 감염병 파트의\n호랑이 연구원이 외쳤어요",
        footerText: "진드기 매개 감염병 SFTS는 치명률이 높습니다!",
        items: [
          { type: "bubble", bubbleStyle: "shout", tailDir: "bottom", speaker: "", text: "맨살 노출은 절대 금물!!\n이렇게 입으셔야 안전합니다!", fontSize: 44, textColor: "#991b1b", bgColor: "#fef2f2", x: 130, y: 210, width: 820, height: 230 }
        ]
      },
      {
        background: "bg_forest.png",
        scenePrompt: "긴팔 등산복과 긴바지, 모자, 목수건까지 빈틈없이 단단히 여며 입은 토끼 캐릭터가 뿌듯하게 서 있고 옆에서 호랑이 연구원이 고개를 끄덕이는 장면",
        blurBg: true,
        darkMood: false,
        speedLines: false,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "예방 수칙 ① 피부 노출 최소화하기",
        footerText: "소매와 바지 끝단을 단단히 여며주세요",
        items: [
          { type: "bubble", bubbleStyle: "round", tailDir: "left", speaker: "", text: "야외활동 할 땐 무조건\n'긴팔·긴바지·모자' 필수!", fontSize: 42, textColor: "#111827", bgColor: "#ffffff", x: 120, y: 220, width: 840, height: 220 }
        ]
      },
      {
        background: "bg_forest.png",
        scenePrompt: "밝은 흰색과 연노랑색 계열의 등산복을 입은 토끼 캐릭터가 옷 소매에 붙은 검은 점을 발견하고 손가락으로 가리키며 엄지척하는 모습",
        blurBg: true,
        darkMood: false,
        speedLines: false,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "예방 수칙 ② 밝은 색 옷 입기",
        footerText: "어두운 옷은 진드기가 붙어도 티가 안 나요!",
        items: [
          { type: "bubble", bubbleStyle: "round", tailDir: "bottom", speaker: "", text: "밝은색 옷을 입어야 작은 진드기가\n붙었을 때 바로 발견해 털어낼 수 있어요!", fontSize: 42, textColor: "#111827", bgColor: "#ffffff", x: 100, y: 210, width: 880, height: 230 }
        ]
      },
      {
        background: "bg_forest.png",
        scenePrompt: "풀밭 위에 깔끔한 돗자리를 펴고 앉아 진드기 기피제 스프레이를 옷과 신발에 칙칙 뿌리는 토끼 캐릭터와 이를 흐뭇하게 바라보는 호랑이 연구원",
        blurBg: true,
        darkMood: false,
        speedLines: false,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "예방 수칙 ③ 돗자리 & 기피제 사용",
        footerText: "풀밭 위에 옷을 벗어두거나 그냥 눕지 마세요",
        items: [
          { type: "bubble", bubbleStyle: "round", tailDir: "right", speaker: "", text: "쉴 땐 반드시 돗자리를 펴고,\n진드기 기피제를 꼼꼼히 뿌려주세요!", fontSize: 42, textColor: "#111827", bgColor: "#ffffff", x: 100, y: 210, width: 880, height: 230 }
        ]
      },
      {
        background: "bg_bathroom.png",
        scenePrompt: "집에 돌아와 입었던 등산복을 세탁기에 넣고, 수건을 두른 채 비누 거품을 내며 개운하게 웃고 있는 토끼 캐릭터, 배경은 타일 욕실",
        blurBg: false,
        darkMood: false,
        speedLines: false,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "예방 수칙 ④ 귀가 후 즉시 세탁 & 샤워",
        footerText: "귀 뒤, 무릎 뒤, 겨드랑이 등 물린 곳 확인!",
        items: [
          { type: "bubble", bubbleStyle: "round", tailDir: "bottom", speaker: "", text: "집에 오자마자 옷은 털어서 바로 세탁하고\n비누로 꼼꼼히 샤워하며 몸을 확인해요!", fontSize: 42, textColor: "#111827", bgColor: "#ffffff", x: 90, y: 210, width: 900, height: 230 }
        ]
      },
      {
        background: "bg_hospital.png",
        scenePrompt: "보건소 진료실 앞에서 흰 가운을 입은 호랑이 연구원과 긴팔 등산복을 입은 토끼 캐릭터가 나란히 서서 양손 엄지척을 하며 환하게 인사하는 엔딩 장면",
        blurBg: false,
        darkMood: false,
        speedLines: false,
        captionStyle: "box",
        captionSize: 42,
        headerText: "오늘의 SFTS 야외활동 예방 4계명 요약",
        footerText: "다음 편(5탄): 진드기에 물렸을 때 올바른 대처법!",
        items: [
          { type: "bubble", bubbleStyle: "round", tailDir: "none", speaker: "", text: "1. 긴팔·긴바지·밝은색 옷 입기\n2. 돗자리 사용 & 진드기 기피제 뿌리기\n3. 귀가 후 즉시 세탁 & 샤워하며 확인!", fontSize: 40, textColor: "#1e3a8a", bgColor: "#eff6ff", x: 90, y: 200, width: 900, height: 260 }
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
// 3. GitHub 동기화 & AI 생성 10컷 일괄 불러오기
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
          if (!DEFAULT_ASSETS[category].some(item => item.id === file.name)) {
            DEFAULT_ASSETS[category].push({
              id: file.name,
              label: `📁 ${file.name}`
            });
          }
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
    alert(`GitHub 연동 완료! 총 ${foundCount}개의 이미지 에셋을 확인했습니다.`);
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

// 제미나이가 생성한 1~10컷 통짜 이미지를 한 번에 선택해 각 컷 배경에 자동 할당
function handleBatchSceneUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  // 파일명 숫자순 정렬 (예: 1.png, 2.png ... 10.png)
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  let loadedCount = 0;
  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const assetKey = `ai_scene_${index + 1}_${file.name}`;
        loadedImages[assetKey] = img;

        if (!DEFAULT_ASSETS.backgrounds.some(b => b.id === assetKey)) {
          DEFAULT_ASSETS.backgrounds.push({ id: assetKey, label: `✨ AI장면 #${index + 1} (${file.name})` });
        }

        // 해당 순서의 컷이 존재하면 자동으로 배경에 꽂아 넣고, 중복되는 더미 파츠 캐릭터 제거
        if (appState.cuts[index]) {
          appState.cuts[index].background = assetKey;
          appState.cuts[index].blurBg = false; // 이미 완성된 그림이므로 블러 해제
          appState.cuts[index].items = (appState.cuts[index].items || []).filter(
            it => (it.type || '').toLowerCase() !== 'character'
          );
        }

        loadedCount++;
        if (loadedCount === files.length) {
          populateSelectMenus();
          renderAll();
          alert(`총 ${files.length}장의 AI 생성 웹툰 장면이 1~${files.length}컷에 자동 배치되었습니다!\n이제 상·하단 사연 자막과 말풍선 위치만 확인하세요.`);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function handleLocalAssetUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        loadedImages[file.name] = img;
        let category = 'characters';
        if (file.name.startsWith('bg_') || file.name.startsWith('scene_')) category = 'backgrounds';
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
// 4. 배경(AI 통짜 이미지 비율 맞춤 크롭), 분위기 연출, 사연 자막 렌더링
// ============================================================================
function drawImageCover(c, img, pad = 0) {
  const targetW = CANVAS_W + pad * 2;
  const targetH = CANVAS_H + pad * 2;
  const imgRatio = img.width / img.height;
  const targetRatio = targetW / targetH;

  let drawW, drawH, offsetX, offsetY;
  if (imgRatio > targetRatio) {
    drawH = targetH;
    drawW = img.width * (targetH / img.height);
    offsetX = -pad - (drawW - targetW) / 2;
    offsetY = -pad;
  } else {
    drawW = targetW;
    drawH = img.height * (targetW / img.width);
    offsetX = -pad;
    offsetY = -pad - (drawH - targetH) / 2;
  }
  c.drawImage(img, offsetX, offsetY, drawW, drawH);
}

function drawBackgroundAndMood(c, cut) {
  const bgId = cut.background || 'bg_home.png';

  c.save();
  if (cut.blurBg) {
    c.filter = 'blur(12px)';
  }

  if (loadedImages[bgId]) {
    // 1:1이나 3:4 등 어떤 비율로 생성된 AI 이미지든 1080x1350 화면에 찌그러짐 없이 꽉 채움
    drawImageCover(c, loadedImages[bgId], cut.blurBg ? 30 : 0);
  } else {
    drawBuiltinBackground(c, bgId);
  }
  c.restore();

  if (cut.darkMood) {
    c.save();
    const darkGrad = c.createRadialGradient(
      CANVAS_W * 0.45, CANVAS_H * 0.58, 180,
      CANVAS_W * 0.5, CANVAS_H * 0.5, 920
    );
    darkGrad.addColorStop(0, 'rgba(15, 23, 42, 0.15)');
    darkGrad.addColorStop(0.58, 'rgba(15, 23, 42, 0.65)');
    darkGrad.addColorStop(1, 'rgba(2, 6, 23, 0.90)');
    c.fillStyle = darkGrad;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.restore();
  }

  if (cut.speedLines) {
    drawSpeedLines(c);
  }
}

function drawBuiltinBackground(c, bgId) {
  if (bgId.includes('dark')) {
    const grad = c.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#475569');
    c.fillStyle = grad;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else if (bgId.includes('forest')) {
    const grad = c.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#bae6fd');
    grad.addColorStop(0.62, '#e0f2fe');
    grad.addColorStop(0.62, '#86efac');
    grad.addColorStop(1, '#22c55e');
    c.fillStyle = grad;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else if (bgId.includes('hospital')) {
    c.fillStyle = '#f0fdf4';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = '#dcfce7';
    c.fillRect(0, 920, CANVAS_W, 430);
  } else if (bgId.includes('bathroom')) {
    c.fillStyle = '#e0f2fe';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else if (bgId.includes('office')) {
    c.fillStyle = '#eff6ff';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    c.fillStyle = '#fef3c7';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

function drawSpeedLines(c) {
  c.save();
  const cx = CANVAS_W * 0.5;
  const cy = CANVAS_H * 0.55;
  const outerR = 950;
  const lineCount = 72;

  for (let i = 0; i < lineCount; i++) {
    const angle = (i / lineCount) * Math.PI * 2;
    const innerR = 380 + (i % 3) * 55;
    const spread = 0.015;

    c.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.22)';
    c.beginPath();
    c.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
    c.lineTo(cx + Math.cos(angle - spread) * outerR, cy + Math.sin(angle - spread) * outerR);
    c.lineTo(cx + Math.cos(angle + spread) * outerR, cy + Math.sin(angle + spread) * outerR);
    c.closePath();
    c.fill();
  }
  c.restore();
}

function drawStoryCaptions(c, cut, cutNumber, totalCuts) {
  const style = cut.captionStyle || 'outline';
  const fontSize = cut.captionSize || 46;
  const headerText = (cut.headerText || '').trim();
  const footerText = (cut.footerText || '').trim();

  c.save();
  if (style === 'bar') {
    c.fillStyle = 'rgba(15, 23, 42, 0.88)';
    c.fillRect(0, 0, CANVAS_W, 92);
    c.font = '700 32px "Noto Sans KR", sans-serif';
    c.fillStyle = '#ffffff';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText(headerText.replace(/\n/g, ' '), 36, 46);
  } else {
    if (headerText) drawCaptionBlock(c, headerText, 44, 'top', style, fontSize);
    if (footerText) drawCaptionBlock(c, footerText, CANVAS_H - 44, 'bottom', style, fontSize);
  }

  // 우측 상단 반투명 페이지 번호
  c.font = '700 22px "Noto Sans KR", sans-serif';
  const badgeText = `${cutNumber}/${totalCuts}`;
  c.fillStyle = 'rgba(15, 23, 42, 0.55)';
  c.beginPath();
  c.roundRect(CANVAS_W - 110, 24, 84, 38, 19);
  c.fill();
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(badgeText, CANVAS_W - 68, 44);
  c.restore();
}

function drawCaptionBlock(c, text, anchorY, position, style, fontSize) {
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.28;
  c.font = `900 ${fontSize}px "Noto Sans KR", sans-serif`;
  c.textAlign = 'left';
  c.textBaseline = 'top';

  const startX = 42;
  const totalH = lines.length * lineHeight;
  const startY = position === 'top' ? anchorY : anchorY - totalH;

  if (style === 'box') {
    let maxW = 0;
    lines.forEach(l => { maxW = Math.max(maxW, c.measureText(l).width); });
    const boxW = Math.min(CANVAS_W - 64, maxW + 44);
    const boxH = totalH + 24;

    c.fillStyle = '#ffffff';
    c.strokeStyle = '#111827';
    c.lineWidth = 7;
    c.fillRect(startX - 16, startY - 12, boxW, boxH);
    c.strokeRect(startX - 16, startY - 12, boxW, boxH);

    c.fillStyle = '#111827';
    lines.forEach((line, idx) => {
      c.fillText(line, startX + 4, startY + idx * lineHeight);
    });
  } else {
    c.lineJoin = 'round';
    c.miterLimit = 2;
    c.lineWidth = Math.max(10, Math.round(fontSize * 0.24));
    c.strokeStyle = '#0f172a';
    c.fillStyle = '#ffffff';

    lines.forEach((line, idx) => {
      const y = startY + idx * lineHeight;
      c.strokeText(line, startX, y);
      c.fillText(line, startX, y);
    });
  }
}

// ============================================================================
// 5. 레이어 렌더링 (파츠 캐릭터, 스티커, 말풍선/효과음)
// ============================================================================
function drawCharacterLayer(c, item) {
  const { charId = 'none', outfitId = 'none', x, y, width, height, flipX } = item;
  if (!charId || charId === 'none') return;

  c.save();
  c.translate(x + width / 2, y + height / 2);
  if (flipX) c.scale(-1, 1);
  c.translate(-width / 2, -height / 2);

  if (loadedImages[charId]) {
    c.drawImage(loadedImages[charId], 0, 0, width, height);
    if (outfitId && outfitId !== 'none' && loadedImages[outfitId]) {
      c.drawImage(loadedImages[outfitId], 0, 0, width, height);
    }
  } else {
    // 아직 이미지가 없는 경우 간단한 안내 박스만 표시
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';
    c.strokeStyle = '#3b82f6';
    c.lineWidth = 4;
    c.setLineDash([10, 8]);
    c.beginPath();
    c.roundRect(0, 0, width, height, 24);
    c.fill();
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#1e3a8a';
    c.font = '700 28px "Noto Sans KR", sans-serif';
    c.textAlign = 'center';
    c.fillText(charId, width / 2, height / 2);
  }
  c.restore();
}

function drawStickerLayer(c, item) {
  const { stickerId = 'sticker_crowd.png', x, y, width, height, flipX } = item;
  c.save();
  c.translate(x + width / 2, y + height / 2);
  if (flipX) c.scale(-1, 1);
  c.translate(-width / 2, -height / 2);

  if (loadedImages[stickerId]) {
    c.drawImage(loadedImages[stickerId], 0, 0, width, height);
    c.restore();
    return;
  }

  if (stickerId.includes('crowd')) {
    const people = [
      { px: width * 0.28, py: height * 0.26, scale: 0.92 },
      { px: width * 0.68, py: height * 0.24, scale: 0.96 }
    ];
    people.forEach(p => {
      c.save();
      c.translate(p.px, p.py);
      c.scale(p.scale, p.scale);
      c.fillStyle = '#475569';
      c.strokeStyle = '#1e293b';
      c.lineWidth = 8;
      c.beginPath();
      c.roundRect(-95, 75, 190, 320, 60);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(0, 0, 75, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(-26, -10, 12, Math.PI, 0);
      c.arc(26, -10, 12, Math.PI, 0);
      c.stroke();
      c.restore();
    });
  } else {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.36;
    c.fillStyle = '#10b981';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
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
    fontSize = 44,
    textColor = '#111827',
    bgColor = '#ffffff'
  } = item;

  c.save();

  if (bubbleStyle === 'plain') {
    c.font = `900 ${fontSize}px "Jua", "Noto Sans KR", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 8;
    c.strokeStyle = '#ffffff';
    c.strokeText(text, x + width / 2, y + height / 2);
    c.fillStyle = textColor;
    c.fillText(text, x + width / 2, y + height / 2);
    c.restore();
    return;
  }

  if (bubbleStyle === 'sfx') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const spikes = 16;
    c.fillStyle = bgColor || '#fde047';
    c.strokeStyle = '#111827';
    c.lineWidth = 7;
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const rFactor = i % 2 === 0 ? 1.0 : 0.72;
      const angle = (i / (spikes * 2)) * Math.PI * 2;
      const px = cx + Math.cos(angle) * (width * 0.5) * rFactor;
      const py = cy + Math.sin(angle) * (height * 0.5) * rFactor;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
  } else if (bubbleStyle === 'thought') {
    c.fillStyle = bgColor || '#fda4af';
    c.strokeStyle = '#111827';
    c.lineWidth = 7;
    c.beginPath();
    c.ellipse(x + width / 2, y + height / 2, width * 0.48, height * 0.46, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    if (tailDir !== 'none') {
      const dirSign = tailDir === 'right' ? 1 : -1;
      const bx = x + width * (tailDir === 'right' ? 0.78 : 0.22);
      const by = y + height * 0.94;
      c.beginPath(); c.arc(bx, by + 16, 16, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(bx + dirSign * 14, by + 44, 10, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  } else {
    c.fillStyle = bgColor;
    c.strokeStyle = '#111827';
    c.lineWidth = 7;
    c.beginPath();
    if (bubbleStyle === 'title') {
      c.roundRect(x, y, width, height, 24);
    } else {
      c.ellipse(x + width / 2, y + height / 2, width * 0.49, height * 0.48, 0, 0, Math.PI * 2);
    }
    c.fill();
    c.stroke();

    if (tailDir !== 'none' && bubbleStyle !== 'title') {
      let tailX = x + width * 0.5;
      if (tailDir === 'left') tailX = x + width * 0.28;
      else if (tailDir === 'right') tailX = x + width * 0.72;

      c.fillStyle = bgColor;
      c.beginPath();
      c.moveTo(tailX - 22, y + height * 0.9);
      c.lineTo(tailX + (tailDir === 'left' ? -36 : tailDir === 'right' ? 36 : 0), y + height + 44);
      c.lineTo(tailX + 22, y + height * 0.9);
      c.closePath();
      c.fill();

      c.beginPath();
      c.moveTo(tailX - 22, y + height * 0.91);
      c.lineTo(tailX + (tailDir === 'left' ? -36 : tailDir === 'right' ? 36 : 0), y + height + 44);
      c.lineTo(tailX + 22, y + height * 0.91);
      c.stroke();
    }
  }

  if (speaker && speaker.trim() !== '') {
    c.font = '700 26px "Noto Sans KR", sans-serif';
    const tagW = c.measureText(speaker).width + 38;
    c.fillStyle = '#111827';
    c.beginPath();
    c.roundRect(x + 36, y - 20, tagW, 42, 21);
    c.fill();
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(speaker, x + 36 + tagW / 2, y + 1);
  }

  c.fillStyle = textColor;
  const fontFamily = bubbleStyle === 'sfx' ? '"Black Han Sans", "Noto Sans KR", sans-serif' : '"Noto Sans KR", sans-serif';
  c.font = `900 ${fontSize}px ${fontFamily}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  const maxLineW = width - 80;
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

  const lineHeight = fontSize * 1.32;
  const totalTextH = wrappedLines.length * lineHeight;
  let startY = y + (height - totalTextH) / 2 + lineHeight / 2;

  wrappedLines.forEach(line => {
    c.fillText(line, x + width / 2, startY);
    startY += lineHeight;
  });

  c.restore();
}

// ============================================================================
// 6. 캔버스 렌더링 및 UI 동기화
// ============================================================================
function renderCutToContext(targetCtx, cutIndex, showSelection = false) {
  const cut = appState.cuts[cutIndex];
  if (!cut) return;

  targetCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackgroundAndMood(targetCtx, cut);

  (cut.items || []).forEach((item, idx) => {
    const t = (item.type || '').toLowerCase();
    if (t === 'character') drawCharacterLayer(targetCtx, item);
    else if (t === 'sticker') drawStickerLayer(targetCtx, item);
    else if (t === 'bubble') drawBubbleLayer(targetCtx, item);

    if (showSelection && idx === appState.selectedLayerIndex) {
      drawSelectionBox(targetCtx, item);
    }
  });

  drawStoryCaptions(targetCtx, cut, cutIndex + 1, appState.cuts.length);
}

function drawSelectionBox(c, item) {
  c.save();
  c.strokeStyle = '#3b82f6';
  c.lineWidth = 5;
  c.setLineDash([12, 8]);
  c.strokeRect(item.x, item.y, item.width, item.height);
  c.setLineDash([]);

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
  renderCutToContext(ctx, appState.currentCutIndex, true);
  document.getElementById('cutCountLabel').textContent = appState.cuts.length;
  document.getElementById('currentCutIndicator').textContent = `${appState.currentCutIndex + 1} / ${appState.cuts.length} 컷`;
  syncInspectorWithSelection();
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
// 7. 마우스 드래그 이동 & 리사이즈
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
    if (Math.abs(pos.x - cx) <= r && Math.abs(pos.y - cy) <= r) return mode;
  }
  return null;
}

function bindCanvasMouseEvents() {
  mainCanvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasMousePos(e);
    const cut = appState.cuts[appState.currentCutIndex];
    if (!cut) return;

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
// 8. 우측 속성 인스펙터 및 프롬프트 모달 2종
// ============================================================================
function syncInspectorWithSelection() {
  const cut = appState.cuts[appState.currentCutIndex];
  if (!cut) return;

  document.getElementById('bgSelect').value = cut.background || 'bg_home.png';
  document.getElementById('cutHeaderInput').value = cut.headerText || '';
  document.getElementById('cutFooterInput').value = cut.footerText || '';
  document.getElementById('captionStyleSelect').value = cut.captionStyle || 'outline';
  document.getElementById('captionSizeInput').value = cut.captionSize || 46;

  document.getElementById('btnToggleBlur').style.borderColor = cut.blurBg ? '#3b82f6' : '';
  document.getElementById('btnToggleDark').style.borderColor = cut.darkMood ? '#3b82f6' : '';
  document.getElementById('btnToggleSpeed').style.borderColor = cut.speedLines ? '#3b82f6' : '';

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
    badge.textContent = '🐯 캐릭터 파츠';
    charInsp.classList.remove('hidden');
    document.getElementById('charSelect').value = item.charId || 'none';
    document.getElementById('outfitSelect').value = item.outfitId || 'none';
  } else if (type === 'bubble') {
    badge.textContent = '💬 말풍선/효과음';
    bubbleInsp.classList.remove('hidden');
    document.getElementById('speakerInput').value = item.speaker || '';
    document.getElementById('dialogueTextarea').value = item.text || '';
    document.getElementById('bubbleStyleSelect').value = item.bubbleStyle || 'round';
    document.getElementById('bubbleTailSelect').value = item.tailDir || 'bottom';
    document.getElementById('fontSizeInput').value = item.fontSize || 44;
    document.getElementById('textColorInput').value = item.textColor || '#111827';
    document.getElementById('bubbleBgColorInput').value = item.bgColor || '#ffffff';
  } else if (type === 'sticker') {
    badge.textContent = '✨ 스티커';
    stickerInsp.classList.remove('hidden');
    document.getElementById('stickerSelect').value = item.stickerId || 'sticker_crowd.png';
  }
}

function bindUIEvents() {
  document.getElementById('btnSyncGithub').addEventListener('click', () => {
    const owner = document.getElementById('ghOwner').value.trim();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';
    syncGithubAssets(owner, repo, branch, false);
  });

  document.getElementById('batchSceneInput').addEventListener('change', handleBatchSceneUpload);
  document.getElementById('localAssetInput').addEventListener('change', handleLocalAssetUpload);

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
      alert('JSON 형식이 올바르지 않습니다.\n오류: ' + err.message);
    }
  });

  document.getElementById('tabSingleView').addEventListener('click', () => setViewMode('single'));
  document.getElementById('tabGridView').addEventListener('click', () => setViewMode('grid'));

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
      scenePrompt: '호랑이 연구원이 웃으며 설명하는 장면',
      blurBg: false,
      darkMood: false,
      speedLines: false,
      captionStyle: 'outline',
      captionSize: 46,
      headerText: '새로운 사연 자막을 입력하세요',
      footerText: '',
      items: []
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

  document.getElementById('btnDeleteCut').addEventListener('click', () => {
    if (appState.cuts.length <= 1) return alert('최소 1개의 컷은 유지해야 합니다.');
    appState.cuts.splice(appState.currentCutIndex, 1);
    appState.currentCutIndex = Math.max(0, appState.currentCutIndex - 1);
    appState.selectedLayerIndex = -1;
    renderAll();
  });

  document.getElementById('bgSelect').addEventListener('change', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.background = e.target.value; renderAll(); }
  });

  document.getElementById('btnToggleBlur').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.blurBg = !cut.blurBg; renderAll(); }
  });

  document.getElementById('btnToggleDark').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.darkMood = !cut.darkMood; renderAll(); }
  });

  document.getElementById('btnToggleSpeed').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.speedLines = !cut.speedLines; renderAll(); }
  });

  document.getElementById('cutHeaderInput').addEventListener('input', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.headerText = e.target.value; renderAll(); }
  });

  document.getElementById('cutFooterInput').addEventListener('input', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.footerText = e.target.value; renderAll(); }
  });

  document.getElementById('captionStyleSelect').addEventListener('change', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.captionStyle = e.target.value; renderAll(); }
  });

  document.getElementById('captionSizeInput').addEventListener('input', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.captionSize = Number(e.target.value) || 46; renderAll(); }
  });

  document.getElementById('btnAddBubble').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    cut.items.push({
      type: 'bubble',
      bubbleStyle: 'round',
      tailDir: 'bottom',
      speaker: '',
      text: '새로운 대사를 입력하세요',
      fontSize: 42,
      textColor: '#111827',
      bgColor: '#ffffff',
      x: 150, y: 220, width: 780, height: 220
    });
    appState.selectedLayerIndex = cut.items.length - 1;
    renderAll();
  });

  document.getElementById('btnAddChar').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    cut.items.push({
      type: 'character',
      charId: 'tiger_normal.png',
      outfitId: 'none',
      x: 340, y: 500, width: 420, height: 710, flipX: false
    });
    appState.selectedLayerIndex = cut.items.length - 1;
    renderAll();
  });

  document.getElementById('btnAddSticker').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    cut.items.push({
      type: 'sticker',
      stickerId: 'sticker_crowd.png',
      x: 520, y: 450, width: 440, height: 480, flipX: false
    });
    appState.selectedLayerIndex = cut.items.length - 1;
    renderAll();
  });

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

  document.getElementById('charSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { item.charId = e.target.value; renderAll(); }
  });
  document.getElementById('outfitSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { item.outfitId = e.target.value; renderAll(); }
  });
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
    if (item) { item.fontSize = Number(e.target.value) || 44; renderAll(); }
  });
  document.getElementById('textColorInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.textColor = e.target.value; renderAll(); }
  });
  document.getElementById('bubbleBgColorInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.bgColor = e.target.value; renderAll(); }
  });
  document.getElementById('stickerSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { item.stickerId = e.target.value; renderAll(); }
  });

  // 모달 1: 시나리오 대본 프롬프트
  document.getElementById('btnOpenPromptModal').addEventListener('click', openMasterPromptModal);
  document.getElementById('btnClosePromptModal').addEventListener('click', () => {
    document.getElementById('promptModal').classList.add('hidden');
  });
  document.getElementById('btnCopyMasterPrompt').addEventListener('click', () => {
    const textarea = document.getElementById('masterPromptText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    alert('시나리오 대본 프롬프트가 복사되었습니다!');
  });

  // 모달 2: 컷별 AI 작화 프롬프트 생성기
  document.getElementById('btnOpenArtPromptModal').addEventListener('click', openArtPromptModal);
  document.getElementById('btnCloseArtPromptModal').addEventListener('click', () => {
    document.getElementById('artPromptModal').classList.add('hidden');
  });
  document.getElementById('btnCopyArtPrompt').addEventListener('click', () => {
    const textarea = document.getElementById('artPromptText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    alert('1~10컷 AI 작화 프롬프트가 복사되었습니다! 제미나이 채팅창에 붙여넣어 이미지를 생성하세요.');
  });

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
// 9. 맞춤 파일명 개별 저장 및 ZIP 일괄 다운로드
// ============================================================================
function getSanitizedEpisodeName() {
  const raw = document.getElementById('episodeTitleInput').value.trim();
  return raw.replace(/[\\/:*?"<>|]/g, '_') || '웹툰';
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
  if (typeof JSZip === 'undefined') return alert('JSZip 라이브러리를 불러오지 못했습니다.');

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
// 10. 프롬프트 생성기 2종 (① 시나리오 JSON용 / ② 오리지널 동물 캐릭터 작화용)
// ============================================================================
function openMasterPromptModal() {
  const prompt = `너는 공공기관 인스타그램의 '감염병 예방 10컷 사연툰' 전담 스토리 작가야.
내가 아래에 전달하는 [감염병 지침 내용]과 [원하는 주제]를 바탕으로, 몰입감 있는 라디오 사연식 10컷 웹툰 시나리오를 순수 JSON 형식으로 작성해 줘.

[작성 규칙]
1. 반드시 순수 JSON 코드만 출력해 (설명 생략).
2. "episodeTitle"에는 파일 저장용 제목(예: "SFTS_예방법", "기승전_손씻기")을 언더바(_)로 구분해 넣어 줘.
3. "cuts" 배열에는 정확히 10개의 컷을 구성하되, 각 컷마다 아래 항목을 포함해:
   - "scenePrompt": 제미나이 이미지 생성 AI가 그릴 장면 묘사 (주인공은 흰 가운을 입은 듬직한 호랑이 연구원과 귀여운 토끼/양 시민 캐릭터로 구성, 인물 표정과 동작·배경을 구체적으로 묘사)
   - "headerText": 화면 상단에 들어갈 사연 내레이션 자막 (2줄 이내 \\n)
   - "footerText": 화면 하단에 들어갈 사연 내레이션 자막 (필요 시 1~2줄)
   - "darkMood" (true/false): 위기나 불안한 장면일 때 true
   - "speedLines" (true/false): 충격·강조 장면일 때 true
   - "items": 각 컷 위에 얹을 말풍선 배열 (상단 180~440px 영역에 배치, speaker는 빈 문자열 "" 유지)

[JSON 출력 양식 예시]
{
  "episodeTitle": "감염병명_주제",
  "cuts": [
    {
      "background": "bg_forest.png",
      "scenePrompt": "반팔을 입고 등산하는 토끼와 흰색 연구원 가운을 입고 X자를 그리며 말리는 호랑이 연구원, 배경은 흐릿한 숲속",
      "blurBg": false,
      "darkMood": false,
      "speedLines": false,
      "captionStyle": "outline",
      "captionSize": 46,
      "headerText": "상단 내레이션 자막 첫 줄\\n두 번째 줄",
      "footerText": "하단 보조 내레이션 자막",
      "items": [
        { "type": "bubble", "bubbleStyle": "round", "tailDir": "left", "speaker": "", "text": "말풍선 대사 내용!", "fontSize": 42, "textColor": "#111827", "bgColor": "#ffffff", "x": 120, "y": 210, "width": 840, "height": 220 }
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

function openArtPromptModal() {
  const header = `[공통 고정 화풍 및 저작권 안전 지침]
- 스타일: 굵고 깔끔한 검은색 펜 외곽선(Thick black ink outlines), 단순하고 코믹한 이목구비, 2D 플랫 채색, 배경은 피사체 집중을 위해 은은한 가우시안 블러(흐림) 또는 단색 그라데이션 처리된 오리지널 한국 인스타툰 스타일.
- 고정 캐릭터 디자인 (모든 컷에서 일관성 유지):
  1) 호랑이 연구원: 흰색 실험실/연구원 가운과 파란 넥타이를 맨 듬직하고 친절한 주황색 줄무늬 호랑이 캐릭터.
  2) 토끼 시민: 동그랗고 귀여운 하얀 토끼 캐릭터 (상황에 따라 일상복 또는 등산복 착용).
- 중요 주의사항: 그림 안에 어떠한 글씨, 자막, 말풍선, 텍스트도 절대 넣지 말고 순수 일러스트 장면만 그려줘! (자막과 말풍선은 별도 프로그램에서 얹을 예정임).
- 비율: 세로형 4:5 비율 (1080x1350).
- 인물 배치: 상단(20%)과 하단(15%)에는 자막이 들어갈 수 있도록 여백을 두고, 캐릭터는 화면 중앙~하단부에 큼직하게 배치해 줘.

=========================================
아래 1번부터 10번까지 순서대로 한 컷씩 그려줘:
=========================================\n\n`;

  const scenes = appState.cuts.map((cut, idx) => {
    const desc = cut.scenePrompt || cut.headerText || '호랑이 연구원과 토끼가 대화하는 장면';
    return `[${idx + 1}번 컷 작화 지시]\n${desc}\n`;
  }).join('\n');

  document.getElementById('artPromptText').value = header + scenes;
  document.getElementById('artPromptModal').classList.remove('hidden');
}
