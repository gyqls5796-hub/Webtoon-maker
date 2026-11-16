/**
 * 인스타그램 10컷 웹툰 자동 제작기 (원포인트 스토리툰 + 자유 꼬리 + 멀티 세계관 + 자동 시퀀스 MP4 에디션)
 * - 상단 자막과 말풍선 겹침 방지 오토 레이아웃(2줄 이상 시 y좌표 260px 자동 강제 하향) 반영 버전
 */

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const HANDLE_SIZE = 24;

const DEFAULT_ASSETS = {
  backgrounds: [
    { id: 'bg_empty.png', label: '⬜ 빈 캔버스 (AI 생성 이미지 대기 중)' },
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

const WORLD_PRESETS = {
  mammal: {
    name: '기본 동물 연구소',
    desc: '1) 연구원: 흰색 실험실 가운과 파란 넥타이를 맨 듬직한 주황색 줄무늬 호랑이 박사.\n  2) 시민: 동그랗고 귀여운 하얀 토끼 시민.'
  },
  winged: {
    name: '날개·비행 생명체 (호흡기/비말 테마)',
    desc: '1) 연구원: 흰색 연구원 가운과 안경을 쓴 지적인 수리부엉이 박사.\n  2) 시민: 화려한 날개를 가진 나비 캐릭터 또는 프테라노돈.'
  },
  dino: {
    name: '백악기 공룡 연구소 (대규모 유행 테마)',
    desc: '1) 연구원: 흰색 실험실 가운을 입은 초록색 티라노사우루스 박사.\n  2) 시민: 아기 트리케라톱스 캐릭터.'
  },
  aquatic: {
    name: '물가·수생 생물 (수인성/모기 유충 테마)',
    desc: '1) 연구원: 흰색 실험실 가운을 입은 부지런한 수달 박사.\n  2) 시민: 초록 청개구리 캐릭터.'
  },
  insect: {
    name: '곤충·절지동물 월드 (매개체 테마)',
    desc: '1) 연구원: 흰색 실험실 가운을 입은 사마귀 박사.\n  2) 시민: 동글동글한 무당벌레 캐릭터.'
  }
};

let loadedImages = {};

let appState = {
  episodeTitle: '새_에피소드',
  worldPreset: 'mammal',
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

let previewAnimId = null;

const mainCanvas = document.getElementById('mainCanvas');
const ctx = mainCanvas.getContext('2d');

function createEmpty10Cuts() {
  return Array.from({ length: 10 }, (_, idx) => ({
    background: 'bg_empty.png',
    scenePrompt: `${idx + 1}번째 컷 장면을 입력하세요`,
    blurBg: false,
    darkMood: false,
    speedLines: false,
    captionStyle: 'outline',
    captionSize: 46,
    headerText: '',
    footerText: '',
    items: []
  }));
}

function getSampleScriptData() {
  return {
    episodeTitle: "진드기_1탄_옷차림편",
    cuts: [
      {
        background: "bg_forest.png",
        scenePrompt: "등산로 입구에서 토끼 시민이 반팔과 반바지 차림으로 가볍게 산책 준비를 하는 모습, 캐릭터를 화면 왼쪽에 배치",
        blurBg: false,
        darkMood: false,
        speedLines: false,
        captionStyle: "outline",
        captionSize: 46,
        headerText: "선명한 바람이 부는 주말,\n토끼 시민의 설레는 산책 준비!",
        footerText: "야외활동 전 필수 수칙 1탄: 밝은색 긴옷 착용",
        items: [
          { type: "bubble", bubbleStyle: "round", tailDir: "left", speaker: "", text: "날씨도 좋은데 가벼운 차림으로\n뒷산 풀밭 산책 다녀와야지!", fontSize: 38, textColor: "#111827", bgColor: "#ffffff", x: 90, y: 260, width: 900, height: 185, tailX: 300, tailY: 460 }
        ]
      }
    ]
  };
}

window.addEventListener('DOMContentLoaded', () => {
  loadSavedGithubSettings();
  populateSelectMenus();

  const sampleData = getSampleScriptData();
  document.getElementById('jsonScriptInput').value = JSON.stringify(sampleData, null, 2);
  applyScriptToState(sampleData, true);

  bindUIEvents();
  bindCanvasMouseEvents();
});

function populateSelectMenus() {
  fillSelect('bgSelect', DEFAULT_ASSETS.backgrounds);
  fillSelect('stickerSelect', DEFAULT_ASSETS.stickers);
}

function fillSelect(selectId, items) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const prevVal = select.value;
  select.innerHTML = '';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.label || item.id;
    select.appendChild(opt);
  });
  if (prevVal && items.some(i => i.id === prevVal)) select.value = prevVal;
}

function loadSavedGithubSettings() {
  const savedOwner = localStorage.getItem('webtoon_gh_owner') || '';
  const savedRepo = localStorage.getItem('webtoon_gh_repo') || '';
  const savedBranch = localStorage.getItem('webtoon_gh_branch') || 'main';
  document.getElementById('ghOwner').value = savedOwner;
  document.getElementById('ghRepo').value = savedRepo;
  document.getElementById('ghBranch').value = savedBranch;
  if (savedOwner && savedRepo) syncGithubAssets(savedOwner, savedRepo, savedBranch, true);
}

async function syncGithubAssets(owner, repo, branch = 'main', silent = false) {
  if (!owner || !repo) return;
  localStorage.setItem('webtoon_gh_owner', owner);
  localStorage.setItem('webtoon_gh_repo', repo);
  localStorage.setItem('webtoon_gh_branch', branch);

  const categories = ['backgrounds', 'stickers'];
  for (const category of categories) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/images/${category}?ref=${branch}`;
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) continue;
      const files = await res.json();
      if (!Array.isArray(files)) continue;
      files.forEach(file => {
        if (file.type === 'file' && /\.(png|jpg|jpeg|webp|svg)$/i.test(file.name)) {
          if (!DEFAULT_ASSETS[category].some(item => item.id === file.name)) {
            DEFAULT_ASSETS[category].push({ id: file.name, label: `📁 ${file.name}` });
          }
          preloadExternalImage(file.name, file.download_url);
        }
      });
    } catch (err) { console.warn(err); }
  }
  populateSelectMenus();
  renderAll();
}

function preloadExternalImage(fileName, url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { loadedImages[fileName] = img; renderAll(); };
  img.src = url;
}

function applyScriptToState(scriptObj, isInitial = false) {
  if (!scriptObj || !Array.isArray(scriptObj.cuts) || scriptObj.cuts.length === 0) {
    alert('대본 JSON 안에 유효한 cuts 배열이 없습니다.');
    return;
  }

  if (!isInitial) {
    Object.keys(loadedImages).forEach(key => {
      if (key.startsWith('ai_scene_')) delete loadedImages[key];
    });
    DEFAULT_ASSETS.backgrounds = DEFAULT_ASSETS.backgrounds.filter(b => !b.id.startsWith('ai_scene_'));
  }

  if (scriptObj.episodeTitle) {
    appState.episodeTitle = scriptObj.episodeTitle;
    document.getElementById('episodeTitleInput').value = scriptObj.episodeTitle;
  }

  appState.cuts = scriptObj.cuts.map((rawCut) => {
    const cleanItems = (rawCut.items || [])
      .filter(it => (it.type || '').toLowerCase() !== 'character')
      .map(it => {
        if ((it.type || '').toLowerCase() === 'bubble') {
          return normalizeBubbleLayout(it, rawCut.headerText || '');
        }
        return { ...it };
      });

    return {
      background: rawCut.background || 'bg_empty.png',
      scenePrompt: rawCut.scenePrompt || '',
      blurBg: Boolean(rawCut.blurBg),
      darkMood: Boolean(rawCut.darkMood),
      speedLines: Boolean(rawCut.speedLines),
      captionStyle: rawCut.captionStyle || 'outline',
      captionSize: Number(rawCut.captionSize) || 46,
      headerText: rawCut.headerText || '',
      footerText: rawCut.footerText || '',
      items: cleanItems
    };
  });

  appState.currentCutIndex = 0;
  appState.selectedLayerIndex = -1;
  populateSelectMenus();
  renderAll();
}

function getDefaultTailPoint(b) {
  const dir = b.tailDir || 'bottom';
  if (dir === 'left') return { tailX: Math.round(b.x + b.width * 0.25), tailY: Math.round(b.y + b.height + 60) };
  if (dir === 'right') return { tailX: Math.round(b.x + b.width * 0.75), tailY: Math.round(b.y + b.height + 60) };
  return { tailX: Math.round(b.x + b.width * 0.5), tailY: Math.round(b.y + b.height + 60) };
}

function normalizeBubbleLayout(b, headerText = '') {
  const text = String(b.text || '');
  const lineCount = text.split('\n').length;
  const fontSize = Number(b.fontSize) || 38;
  const autoHeight = Math.max(160, lineCount * (fontSize * 1.45) + 65);

  // 상단 자막이 2줄 이상이면 260px로 강제 하향하여 겹침 방지
  const headerLines = headerText ? headerText.split('\n').length : 1;
  const forcedSafeY = headerLines >= 2 ? 260 : 210;

  const normalized = {
    type: 'bubble',
    bubbleStyle: b.bubbleStyle || 'round',
    tailDir: b.tailDir || 'bottom',
    speaker: '',
    text: text,
    fontSize: fontSize,
    textColor: b.textColor || '#111827',
    bgColor: b.bgColor || '#ffffff',
    x: typeof b.x === 'number' ? b.x : 90,
    y: forcedSafeY,
    width: typeof b.width === 'number' ? b.width : 900,
    height: typeof b.height === 'number' ? Math.min(b.height, autoHeight + 30) : autoHeight
  };

  if (typeof b.tailX === 'number' && typeof b.tailY === 'number') {
    normalized.tailX = b.tailX;
    normalized.tailY = b.tailY;
  } else {
    const pt = getDefaultTailPoint(normalized);
    normalized.tailX = pt.tailX;
    normalized.tailY = pt.tailY;
  }
  return normalized;
}

function handleBatchSceneUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  Object.keys(loadedImages).forEach(key => {
    if (key.startsWith('ai_scene_')) delete loadedImages[key];
  });
  DEFAULT_ASSETS.backgrounds = DEFAULT_ASSETS.backgrounds.filter(b => !b.id.startsWith('ai_scene_'));

  let loadedCount = 0;
  const timestamp = Date.now();

  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const assetKey = `ai_scene_${timestamp}_${index + 1}_${file.name}`;
        loadedImages[assetKey] = img;
        DEFAULT_ASSETS.backgrounds.push({ id: assetKey, label: `✨ AI장면 #${index + 1} (${file.name})` });

        if (appState.cuts[index]) {
          appState.cuts[index].background = assetKey;
          appState.cuts[index].blurBg = false;
        }

        loadedCount++;
        if (loadedCount === files.length) {
          populateSelectMenus();
          appState.currentCutIndex = 0;
          appState.selectedLayerIndex = -1;
          renderAll();
          alert(`총 ${files.length}장의 AI 그림이 1~${files.length}컷에 자동 배치되었습니다!`);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

function handleLocalAssetUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const key = `custom_${Date.now()}_${file.name}`;
        loadedImages[key] = img;
        DEFAULT_ASSETS.backgrounds.push({ id: key, label: `💻 교체이미지 (${file.name})` });
        if (idx === 0 && appState.cuts[appState.currentCutIndex]) {
          appState.cuts[appState.currentCutIndex].background = key;
          appState.cuts[appState.currentCutIndex].blurBg = false;
        }
        populateSelectMenus();
        renderAll();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

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

function drawBackgroundAndMood(c, cut, zoomScale = 1.0) {
  const bgId = cut.background || 'bg_empty.png';
  c.save();
  if (zoomScale !== 1.0) {
    c.translate(CANVAS_W / 2, CANVAS_H / 2);
    c.scale(zoomScale, zoomScale);
    c.translate(-CANVAS_W / 2, -CANVAS_H / 2);
  }
  if (cut.blurBg) c.filter = 'blur(12px)';
  if (loadedImages[bgId]) drawImageCover(c, loadedImages[bgId], cut.blurBg ? 30 : 0);
  else drawBuiltinBackground(c, bgId);
  c.restore();

  if (cut.darkMood) {
    c.save();
    const darkGrad = c.createRadialGradient(CANVAS_W * 0.45, CANVAS_H * 0.58, 180, CANVAS_W * 0.5, CANVAS_H * 0.5, 920);
    darkGrad.addColorStop(0, 'rgba(15, 23, 42, 0.15)');
    darkGrad.addColorStop(0.58, 'rgba(15, 23, 42, 0.65)');
    darkGrad.addColorStop(1, 'rgba(2, 6, 23, 0.90)');
    c.fillStyle = darkGrad;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.restore();
  }
  if (cut.speedLines) drawSpeedLines(c);
}

function drawBuiltinBackground(c, bgId) {
  if (bgId === 'bg_empty.png') {
    c.fillStyle = '#f8fafc';
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.strokeStyle = '#cbd5e1';
    c.lineWidth = 4;
    c.setLineDash([16, 12]);
    c.strokeRect(60, 420, CANVAS_W - 120, 680);
    c.setLineDash([]);
    c.fillStyle = '#64748b';
    c.font = '700 32px "Noto Sans KR", sans-serif';
    c.textAlign = 'center';
    c.fillText('상단 [🖼️ AI 생성 컷 일괄 넣기]로', CANVAS_W / 2, 730);
    c.fillText('제미나이가 그린 그림을 넣어주세요', CANVAS_W / 2, 785);
    return;
  }
  c.fillStyle = bgId.includes('dark') ? '#334155' : bgId.includes('forest') ? '#dcfce7' : bgId.includes('office') ? '#eff6ff' : '#fef3c7';
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
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

function drawStoryCaptions(c, cut, cutNumber, totalCuts, alpha = 1.0) {
  if (alpha <= 0) return;
  const style = cut.captionStyle || 'outline';
  const fontSize = cut.captionSize || 46;
  const headerText = (cut.headerText || '').trim();
  const footerText = (cut.footerText || '').trim();

  c.save();
  c.globalAlpha = alpha;
  if (style === 'bar') {
    c.fillStyle = 'rgba(15, 23, 42, 0.88)';
    c.fillRect(0, 0, CANVAS_W, 92);
    c.font = '700 32px "Noto Sans KR", sans-serif';
    c.fillStyle = '#ffffff';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText(headerText.replace(/\n/g, ' '), 36, 46);
  } else {
    if (headerText) drawCaptionBlock(c, headerText, 40, 'top', style, fontSize);
    if (footerText) drawCaptionBlock(c, footerText, CANVAS_H - 40, 'bottom', style, fontSize);
  }

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
    lines.forEach((line, idx) => { c.fillText(line, startX + 4, startY + idx * lineHeight); });
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

function drawStickerLayer(c, item, animState = null) {
  const { stickerId = 'sticker_crowd.png', x, y, width, height, flipX } = item;
  if (animState && animState.alpha <= 0) return;

  c.save();
  if (animState) c.globalAlpha = animState.alpha;
  const scale = animState ? animState.scale : 1.0;

  c.translate(x + width / 2, y + height / 2);
  c.scale(flipX ? -scale : scale, scale);
  c.translate(-width / 2, -height / 2);
  if (loadedImages[stickerId]) {
    c.drawImage(loadedImages[stickerId], 0, 0, width, height);
  } else {
    c.fillStyle = '#10b981';
    c.beginPath();
    c.arc(width / 2, height / 2, Math.min(width, height) * 0.35, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawBubbleLayer(c, item, animState = null) {
  if (animState && animState.alpha <= 0) return;

  const {
    x, y, width, height,
    text = '',
    speaker = '',
    bubbleStyle = 'round',
    tailDir = 'bottom',
    fontSize = 38,
    textColor = '#111827',
    bgColor = '#ffffff'
  } = item;

  if (typeof item.tailX !== 'number' || typeof item.tailY !== 'number') {
    const pt = getDefaultTailPoint(item);
    item.tailX = pt.tailX;
    item.tailY = pt.tailY;
  }

  const cx = x + width / 2;
  const cy = y + height / 2;
  const tx = item.tailX;
  const ty = item.tailY;

  c.save();
  if (animState) {
    c.globalAlpha = animState.alpha;
    if (animState.scale !== 1.0) {
      c.translate(cx, cy);
      c.scale(animState.scale, animState.scale);
      c.translate(-cx, -cy);
    }
  }

  if (bubbleStyle === 'plain') {
    c.font = `900 ${fontSize}px "Jua", "Noto Sans KR", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 8;
    c.strokeStyle = '#ffffff';
    c.strokeText(text, cx, cy);
    c.fillStyle = textColor;
    c.fillText(text, cx, cy);
    c.restore();
    return;
  }

  if (bubbleStyle === 'sfx') {
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
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
  } else if (bubbleStyle === 'thought') {
    c.fillStyle = bgColor || '#fda4af';
    c.strokeStyle = '#111827';
    c.lineWidth = 7;

    if (tailDir !== 'none') {
      const dx = tx - cx;
      const dy = ty - cy;
      c.beginPath(); c.arc(cx + dx * 0.68, cy + dy * 0.68, 15, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(cx + dx * 0.90, cy + dy * 0.90, 9, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    c.beginPath();
    c.ellipse(cx, cy, width * 0.48, height * 0.46, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else {
    const showTail = (tailDir !== 'none' && bubbleStyle !== 'title');
    const angle = Math.atan2(ty - cy, tx - cx);
    const perpAngle = angle + Math.PI / 2;
    const baseHalfW = 24;

    const b1x = cx + Math.cos(perpAngle) * baseHalfW;
    const b1y = cy + Math.sin(perpAngle) * baseHalfW;
    const b2x = cx - Math.cos(perpAngle) * baseHalfW;
    const b2y = cy - Math.sin(perpAngle) * baseHalfW;

    c.fillStyle = bgColor;
    c.strokeStyle = '#111827';
    c.lineWidth = 7;
    c.lineJoin = 'round';

    if (showTail) {
      c.beginPath();
      c.moveTo(b1x, b1y);
      c.lineTo(tx, ty);
      c.lineTo(b2x, b2y);
      c.closePath();
      c.fill();
      c.stroke();
    }

    c.beginPath();
    if (bubbleStyle === 'title') c.roundRect(x, y, width, height, 24);
    else c.ellipse(cx, cy, width * 0.49, height * 0.48, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    if (showTail) {
      c.save();
      c.beginPath();
      if (bubbleStyle === 'title') c.roundRect(x + 4, y + 4, width - 8, height - 8, 20);
      else c.ellipse(cx, cy, width * 0.49 - 4, height * 0.48 - 4, 0, 0, Math.PI * 2);
      c.clip();

      c.fillStyle = bgColor;
      c.beginPath();
      c.moveTo(b1x, b1y);
      c.lineTo(tx, ty);
      c.lineTo(b2x, b2y);
      c.closePath();
      c.fill();
      c.restore();
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
  const maxLineW = width - 70;
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
    c.fillText(line, cx, startY);
    startY += lineHeight;
  });

  c.restore();
}

function renderCutToContext(targetCtx, cutIndex, showSelection = false) {
  const cut = appState.cuts[cutIndex];
  if (!cut) return;
  targetCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  drawBackgroundAndMood(targetCtx, cut, 1.0);

  (cut.items || []).forEach((item, idx) => {
    const t = (item.type || '').toLowerCase();
    if (t === 'bubble') drawBubbleLayer(targetCtx, item, null);
    else if (t === 'sticker') drawStickerLayer(targetCtx, item, null);

    if (showSelection && idx === appState.selectedLayerIndex) {
      drawSelectionBox(targetCtx, item);
    }
  });

  drawStoryCaptions(targetCtx, cut, cutIndex + 1, appState.cuts.length, 1.0);
}

function getCutAnimationSpec(cut) {
  const items = cut.items || [];
  const sortedIndices = items
    .map((item, idx) => ({ idx, x: item.x || 0, y: item.y || 0 }))
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > 80) return a.y - b.y;
      return a.x - b.x;
    })
    .map(entry => entry.idx);

  const orderMap = {};
  sortedIndices.forEach((origIdx, seqOrder) => {
    orderMap[origIdx] = seqOrder;
  });

  const introDelay = 0.35;
  const stepInterval = 0.55;
  const popDuration = 0.28;
  const totalChars = items.reduce((acc, it) => acc + String(it.text || '').length, 0) +
    String(cut.headerText || '').length + String(cut.footerText || '').length;
  const readingHold = Math.min(2.8, Math.max(1.6, 1.2 + totalChars * 0.035));
  const lastBubbleTime = items.length > 0 ? introDelay + (items.length - 1) * stepInterval + popDuration : introDelay;
  const totalDuration = lastBubbleTime + readingHold;

  return { orderMap, introDelay, stepInterval, popDuration, totalDuration };
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function renderAnimatedCutFrame(targetCtx, cutIndex, elapsedSec, spec) {
  const cut = appState.cuts[cutIndex];
  if (!cut) return;
  targetCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const progress = Math.min(1, Math.max(0, elapsedSec / spec.totalDuration));
  const zoomScale = 1.0 + progress * 0.035;
  drawBackgroundAndMood(targetCtx, cut, zoomScale);

  (cut.items || []).forEach((item, idx) => {
    const seqOrder = spec.orderMap[idx] ?? idx;
    const appearTime = spec.introDelay + seqOrder * spec.stepInterval;
    const localT = (elapsedSec - appearTime) / spec.popDuration;

    if (localT <= 0) return;

    let alpha = 1.0;
    let scale = 1.0;
    if (localT < 1.0) {
      alpha = Math.min(1, localT * 1.8);
      scale = 0.65 + 0.35 * easeOutBack(localT);
    }

    const t = (item.type || '').toLowerCase();
    if (t === 'bubble') drawBubbleLayer(targetCtx, item, { alpha, scale });
    else if (t === 'sticker') drawStickerLayer(targetCtx, item, { alpha, scale });
  });

  const captionAlpha = Math.min(1, elapsedSec / 0.25);
  drawStoryCaptions(targetCtx, cut, cutIndex + 1, appState.cuts.length, captionAlpha);
}

function previewCurrentCutAnimation() {
  if (previewAnimId) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }
  const cutIndex = appState.currentCutIndex;
  const cut = appState.cuts[cutIndex];
  if (!cut) return;

  setViewMode('single');
  const spec = getCutAnimationSpec(cut);
  const startTime = performance.now();

  function step(now) {
    const elapsedSec = (now - startTime) / 1000;
    if (elapsedSec <= spec.totalDuration) {
      renderAnimatedCutFrame(ctx, cutIndex, elapsedSec, spec);
      previewAnimId = requestAnimationFrame(step);
    } else {
      previewAnimId = null;
      renderAll();
    }
  }
  previewAnimId = requestAnimationFrame(step);
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

  if ((item.type || '').toLowerCase() === 'bubble' && item.tailDir !== 'none' && item.bubbleStyle !== 'title' && item.bubbleStyle !== 'sfx' && item.bubbleStyle !== 'plain') {
    const tx = item.tailX;
    const ty = item.tailY;
    c.fillStyle = '#facc15';
    c.strokeStyle = '#111827';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(tx, ty, 18, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  c.restore();
}

function renderAll() {
  if (previewAnimId) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }
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
      </div>
      <img src="${dataUrl}" class="cut-thumb-preview" alt="${idx + 1}컷">
    `;
    card.addEventListener('click', () => { appState.currentCutIndex = idx; appState.selectedLayerIndex = -1; renderAll(); });
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

function getCanvasMousePos(e) {
  const rect = mainCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
    y: (e.clientY - rect.top) * (CANVAS_H / rect.height)
  };
}

function hitTestHandle(pos, item) {
  if ((item.type || '').toLowerCase() === 'bubble' && item.tailDir !== 'none' && typeof item.tailX === 'number') {
    const dist = Math.hypot(pos.x - item.tailX, pos.y - item.tailY);
    if (dist <= 30) return 'tail';
  }

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
    if (previewAnimId) {
      cancelAnimationFrame(previewAnimId);
      previewAnimId = null;
    }
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
          initialBox: {
            x: selItem.x,
            y: selItem.y,
            width: selItem.width,
            height: selItem.height,
            tailX: selItem.tailX,
            tailY: selItem.tailY
          }
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
        initialBox: {
          x: selItem.x,
          y: selItem.y,
          width: selItem.width,
          height: selItem.height,
          tailX: selItem.tailX,
          tailY: selItem.tailY
        }
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

    if (dragState.mode === 'tail') {
      item.tailX = Math.round(pos.x);
      item.tailY = Math.round(pos.y);
      item.tailDir = 'custom';
      document.getElementById('bubbleTailSelect').value = 'custom';
    } else if (dragState.mode === 'move') {
      item.x = Math.round(b.x + dx);
      item.y = Math.round(b.y + dy);
      if (typeof b.tailX === 'number') {
        item.tailX = Math.round(b.tailX + dx);
        item.tailY = Math.round(b.tailY + dy);
      }
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

function syncInspectorWithSelection() {
  const cut = appState.cuts[appState.currentCutIndex];
  if (!cut) return;
  document.getElementById('bgSelect').value = cut.background || 'bg_empty.png';
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
  const bubbleInsp = document.getElementById('bubbleInspector');
  const stickerInsp = document.getElementById('stickerInspector');
  const badge = document.getElementById('selectedTypeBadge');

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
  if (type === 'bubble') {
    badge.textContent = '💬 말풍선 (노란 점=꼬리)';
    bubbleInsp.classList.remove('hidden');
    document.getElementById('speakerInput').value = item.speaker || '';
    document.getElementById('dialogueTextarea').value = item.text || '';
    document.getElementById('bubbleStyleSelect').value = item.bubbleStyle || 'round';
    document.getElementById('bubbleTailSelect').value = item.tailDir || 'custom';
    document.getElementById('fontSizeInput').value = item.fontSize || 38;
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
    syncGithubAssets(document.getElementById('ghOwner').value.trim(), document.getElementById('ghRepo').value.trim(), document.getElementById('ghBranch').value.trim() || 'main', false);
  });

  document.getElementById('batchSceneInput').addEventListener('change', handleBatchSceneUpload);
  document.getElementById('localAssetInput').addEventListener('change', handleLocalAssetUpload);

  document.getElementById('btnClearWorkspace').addEventListener('click', () => {
    if (!confirm('현재 작업 중인 자막, 말풍선, 이미지를 모두 비우고 초기 상태로 되돌릴까요?')) return;
    loadedImages = {};
    DEFAULT_ASSETS.backgrounds = DEFAULT_ASSETS.backgrounds.filter(b => !b.id.startsWith('ai_scene_') && !b.id.startsWith('custom_'));
    document.getElementById('jsonScriptInput').value = '';
    document.getElementById('episodeTitleInput').value = '새_에피소드';
    appState.cuts = createEmpty10Cuts();
    appState.currentCutIndex = 0;
    appState.selectedLayerIndex = -1;
    populateSelectMenus();
    renderAll();
  });

  document.getElementById('btnLoadSample').addEventListener('click', () => {
    const sample = getSampleScriptData();
    document.getElementById('jsonScriptInput').value = JSON.stringify(sample, null, 2);
    applyScriptToState(sample, false);
  });

  document.getElementById('btnGenerateWebtoon').addEventListener('click', () => {
    const raw = document.getElementById('jsonScriptInput').value.trim();
    if (!raw) return alert('JSON 대본을 입력해 주세요.');
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      applyScriptToState(parsed, false);
    } catch (err) {
      alert('JSON 형식이 올바르지 않습니다.\n오류: ' + err.message);
    }
  });

  document.getElementById('tabSingleView').addEventListener('click', () => setViewMode('single'));
  document.getElementById('tabGridView').addEventListener('click', () => setViewMode('grid'));
  document.getElementById('btnPreviewCutAnim').addEventListener('click', previewCurrentCutAnimation);

  document.getElementById('btnPrevCut').addEventListener('click', () => {
    if (appState.currentCutIndex > 0) { appState.currentCutIndex--; appState.selectedLayerIndex = -1; renderAll(); }
  });

  document.getElementById('btnNextCut').addEventListener('click', () => {
    if (appState.currentCutIndex < appState.cuts.length - 1) { appState.currentCutIndex++; appState.selectedLayerIndex = -1; renderAll(); }
  });

  document.getElementById('btnAddCut').addEventListener('click', () => {
    appState.cuts.push({
      background: 'bg_empty.png',
      scenePrompt: '',
      blurBg: false,
      darkMood: false,
      speedLines: false,
      captionStyle: 'outline',
      captionSize: 46,
      headerText: '새 자막을 입력하세요',
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
    const newBubble = {
      type: 'bubble',
      bubbleStyle: 'round',
      tailDir: 'custom',
      speaker: '',
      text: '새로운 대사를 입력하세요',
      fontSize: 38,
      textColor: '#111827',
      bgColor: '#ffffff',
      x: 90, y: 260, width: 900, height: 185,
      tailX: 540, tailY: 460
    };
    cut.items.push(newBubble);
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

  document.getElementById('btnClearCutBubbles').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (!cut) return;
    cut.items = [];
    appState.selectedLayerIndex = -1;
    renderAll();
  });

  document.getElementById('btnFlipX').addEventListener('click', () => {
    const item = getSelectedItem();
    if (item) { item.flipX = !item.flipX; renderAll(); }
  });

  const commonCtrl = document.getElementById('commonLayerControls');
  if (commonCtrl && !document.getElementById('btnMirrorBubble')) {
    const btnRow = commonCtrl.querySelector('.btn-row-4');
    if (btnRow) {
      const swapBtn = document.createElement('button');
      swapBtn.id = 'btnMirrorBubble';
      swapBtn.className = 'btn btn-outline-sm';
      swapBtn.textContent = '🔄 말풍선 좌우반전';
      swapBtn.title = '말풍선과 꼬리 위치를 화면 반대편으로 한 번에 이동합니다';
      swapBtn.addEventListener('click', () => {
        const item = getSelectedItem();
        if (item && (item.type || '').toLowerCase() === 'bubble') {
          item.x = CANVAS_W - (item.x + item.width);
          if (typeof item.tailX === 'number') {
            item.tailX = CANVAS_W - item.tailX;
          }
          renderAll();
        }
      });
      btnRow.appendChild(swapBtn);
    }
  }

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
    if (item) {
      item.tailDir = e.target.value;
      if (e.target.value === 'left' || e.target.value === 'right' || e.target.value === 'bottom') {
        const pt = getDefaultTailPoint(item);
        item.tailX = pt.tailX;
        item.tailY = pt.tailY;
      }
      renderAll();
    }
  });
  document.getElementById('fontSizeInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.fontSize = Number(e.target.value) || 38; renderAll(); }
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

  document.getElementById('castPresetSelect').addEventListener('change', (e) => {
    appState.worldPreset = e.target.value;
    updateMasterPromptText();
  });

  document.getElementById('btnOpenPromptModal').addEventListener('click', () => {
    updateMasterPromptText();
    document.getElementById('promptModal').classList.remove('hidden');
  });
  document.getElementById('btnClosePromptModal').addEventListener('click', () => {
    document.getElementById('promptModal').classList.add('hidden');
  });
  document.getElementById('btnCopyMasterPrompt').addEventListener('click', () => {
    const textarea = document.getElementById('masterPromptText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    alert('대본 프롬프트가 복사되었습니다!');
  });

  document.getElementById('btnOpenArtPromptModal').addEventListener('click', openArtPromptModal);
  document.getElementById('btnCloseArtPromptModal').addEventListener('click', () => {
    document.getElementById('artPromptModal').classList.add('hidden');
  });
  document.getElementById('btnCopyArtPrompt').addEventListener('click', () => {
    const textarea = document.getElementById('artPromptText');
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    alert('작화 프롬프트가 복사되었습니다!');
  });

  document.getElementById('btnDownloadCurrent').addEventListener('click', downloadCurrentCutPng);
  document.getElementById('btnDownloadZip').addEventListener('click', downloadAllCutsZip);
  document.getElementById('btnDownloadMp4').addEventListener('click', downloadReelsMp4);
}

function getSelectedItem() {
  const cut = appState.cuts[appState.currentCutIndex];
  return cut ? cut.items[appState.selectedLayerIndex] : null;
}

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

async function downloadReelsMp4() {
  const epName = getSanitizedEpisodeName();
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  overlay.classList.remove('hidden');

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = CANVAS_W;
  exportCanvas.height = CANVAS_H;
  const exportCtx = exportCanvas.getContext('2d');
  const fps = 30;

  try {
    if (typeof VideoEncoder !== 'undefined' && typeof Mp4Muxer !== 'undefined') {
      const codecCandidates = ['avc1.64002a', 'avc1.4d002a', 'avc1.42002a', 'avc1.42E01E'];
      let chosenCodec = null;
      for (const c of codecCandidates) {
        const support = await VideoEncoder.isConfigSupported({
          codec: c, width: CANVAS_W, height: CANVAS_H, bitrate: 5_000_000, framerate: fps
        });
        if (support.supported) { chosenCodec = c; break; }
      }

      if (chosenCodec) {
        const muxer = new Mp4Muxer.Muxer({
          target: new Mp4Muxer.ArrayBufferTarget(),
          video: { codec: 'avc', width: CANVAS_W, height: CANVAS_H },
          fastStart: 'in-memory'
        });

        const encoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (e) => console.error(e)
        });

        encoder.configure({ codec: chosenCodec, width: CANVAS_W, height: CANVAS_H, bitrate: 5_000_000, framerate: fps });

        let globalFrameIndex = 0;
        for (let i = 0; i < appState.cuts.length; i++) {
          const cut = appState.cuts[i];
          const spec = getCutAnimationSpec(cut);
          const totalCutFrames = Math.round(spec.totalDuration * fps);

          for (let f = 0; f < totalCutFrames; f++) {
            if (f % 10 === 0) {
              loadingText.textContent = `🎬 릴스 MP4 렌더링 중... (${i + 1} / ${appState.cuts.length}컷)`;
              await new Promise(r => setTimeout(r, 0));
            }
            const elapsedSec = f / fps;
            renderAnimatedCutFrame(exportCtx, i, elapsedSec, spec);

            const timestampUs = Math.round((globalFrameIndex / fps) * 1_000_000);
            const durationUs = Math.round((1 / fps) * 1_000_000);
            const frame = new VideoFrame(exportCanvas, { timestamp: timestampUs, duration: durationUs });
            encoder.encode(frame, { keyFrame: f === 0 });
            frame.close();
            globalFrameIndex++;
          }
        }

        loadingText.textContent = 'MP4 파일 마무리 중...';
        await encoder.flush();
        muxer.finalize();

        const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${epName}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
    }

    await recordFallbackVideo(exportCanvas, exportCtx, fps, epName, loadingText);
  } catch (err) {
    alert('동영상 생성 중 오류가 발생했습니다: ' + err.message);
  } finally {
    overlay.classList.add('hidden');
  }
}

async function recordFallbackVideo(exportCanvas, exportCtx, fps, epName, loadingText) {
  const stream = exportCanvas.captureStream(fps);
  const mimeTypes = ['video/mp4', 'video/webm;codecs=h264', 'video/webm'];
  const selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
  const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime, videoBitsPerSecond: 5_000_000 } : {});
  const chunks = [];

  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const stopPromise = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.start();

  for (let i = 0; i < appState.cuts.length; i++) {
    const cut = appState.cuts[i];
    const spec = getCutAnimationSpec(cut);
    const startMs = performance.now();

    while (true) {
      const elapsedSec = (performance.now() - startMs) / 1000;
      if (elapsedSec > spec.totalDuration) break;
      loadingText.textContent = `🎬 녹화 중... (${i + 1} / ${appState.cuts.length}컷)`;
      renderAnimatedCutFrame(exportCtx, i, elapsedSec, spec);
      await new Promise(r => requestAnimationFrame(r));
    }
  }

  recorder.stop();
  await stopPromise;

  const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: selectedMime || 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${epName}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function updateMasterPromptText() {
  const preset = WORLD_PRESETS[appState.worldPreset] || WORLD_PRESETS.mammal;
  const prompt = `너는 공공기관 인스타그램의 '감염병 예방 10컷 스토리툰' 전담 작가야.
아래 지침 중 **단 1가지 핵심 주제**만 집중적으로 다루는 10컷 스토리툰 시나리오를 순수 JSON 형식으로 작성해 줘.

[스토리 전개 원칙]
- 1~2컷: 일상 도입 / 3~4컷: 실수·위기 / 5~6컷: 연구원 박사 등장 및 원리 설명 / 7~9컷: 올바른 실천 / 10컷: 여운 및 다음 편 예고.
- 등장인물 설정: ${preset.desc}

[JSON 작성 규칙]
1. 반드시 순수 JSON 코드만 출력해.
2. "episodeTitle"에는 파일 저장용 이름(예: "진드기_1탄_옷차림편")을 넣어 줘.
3. "scenePrompt" 작성 시, 각 컷의 대화 성격에 맞춰 캐릭터가 **화면 왼쪽**에 위치하는지 혹은 **화면 오른쪽**에 위치하는지를 명시해 줘.

[JSON 출력 양식]
{
  "episodeTitle": "에피소드_제목",
  "cuts": [
    {
      "background": "bg_forest.png",
      "scenePrompt": "등장인물 동작 및 캐릭터 좌/우 위치 묘사",
      "blurBg": false,
      "darkMood": false,
      "speedLines": false,
      "captionStyle": "outline",
      "captionSize": 46,
      "headerText": "상단 해설 자막 (2줄 이내)",
      "footerText": "하단 핵심 요약 자막",
      "items": [
        { "type": "bubble", "bubbleStyle": "round", "tailDir": "left", "speaker": "", "text": "대사 내용", "fontSize": 38, "textColor": "#111827", "bgColor": "#ffffff", "x": 90, "y": 260, "width": 900, "height": 185, "tailX": 300, "tailY": 460 }
      ]
    }
  ]
}

---
[이번 편 핵심 주제]:`;
  document.getElementById('masterPromptText').value = prompt;
}

function openArtPromptModal() {
  const preset = WORLD_PRESETS[appState.worldPreset] || WORLD_PRESETS.mammal;

  const header = `[공통 고정 화풍 및 품질 지침]
- 스타일: 굵고 깔끔한 검은색 외곽선, 2D 플랫 채색, 인스타툰 감성. 배경은 가볍게 흐림 처리.
- 등장인물 설정: ${preset.desc} (1~10컷까지 외모와 의상 일관성 유지)
- 구도 및 여백: 상단 25%와 하단 15% 영역은 자막용 공간이므로 비워두고 캐릭터는 중앙~하단부에 배치.
- 글자 절대 금지: 그림 안에 어떠한 글씨나 말풍선도 절대 넣지 말 것!
- 세로형 4:5 비율 (1080x1350).

=========================================
아래 1번부터 10번까지 한 컷씩 그려줘:
=========================================\n\n`;

  const scenes = appState.cuts.map((cut, idx) => {
    const desc = cut.scenePrompt || cut.headerText || '장면 설명';
    const firstBubble = (cut.items || []).find(it => (it.type || '').toLowerCase() === 'bubble');
    let positionHint = '화면 중앙에 배치';
    if (firstBubble) {
      if (firstBubble.x < 350) positionHint = '캐릭터를 화면 왼쪽에 치우치게 배치';
      else if (firstBubble.x > 600) positionHint = '캐릭터를 화면 오른쪽에 치우치게 배치';
    }
    return `[${idx + 1}번 컷] ${positionHint} - ${desc}\n`;
  }).join('\n');

  document.getElementById('artPromptText').value = header + scenes;
  document.getElementById('artPromptModal').classList.remove('hidden');
}
