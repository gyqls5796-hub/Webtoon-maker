/**
 * 인스타그램 웹툰 & 릴스 자동 제작기
 * - 자동 표지(1컷) + 본문(2~11컷) 총 11장 구성
 * - 경상남도 감염병관리지원단 로고 자유 드래그 이동 & 크기 조절(표지 하단 초록 영역 기본 + 마지막 컷 대형 기본)
 * - 표지 하단 안내 배지 전환(숨김 / 릴스용 / 슬라이드용 + MP4 저장 시 자동 릴스 최적화)
 * - 시나리오 분위기 자동 감지 BGM + 말풍선 팝업 '뿅!' 효과음 + 4종 몰입형 모션 + 실행취소(Undo) 포함
 */

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const HANDLE_SIZE = 24;
const ORG_NAME_DEFAULT = '경상남도 감염병관리지원단';

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
let orgLogoImage = null;

let appState = {
  episodeTitle: '진드기_1탄_옷차림편',
  worldPreset: 'mammal',
  currentCutIndex: 0,
  selectedLayerIndex: -1, // -1: 선택없음, -2: 지원단 로고 선택됨, 0이상: items[idx] 선택됨
  viewMode: 'single',
  cuts: [],
  audioOptions: {
    enableBgm: true,
    enablePopSfx: true
  }
};

const MAX_HISTORY = 30;
let undoStack = [];
let redoStack = [];
let isRestoringHistory = false;

let dragState = {
  isDragging: false,
  mode: null,
  targetType: 'item', // 'item' | 'logo'
  startX: 0,
  startY: 0,
  initialBox: null
};

let previewAnimId = null;
let activeAudioCtx = null;

const mainCanvas = document.getElementById('mainCanvas');
const ctx = mainCanvas.getContext('2d');

// ============================================================================
// 0. 지원단 로고 박스 기본 좌표 계산 & 저장/불러오기 & 표지(Cover) 헬퍼
// ============================================================================
function getDefaultLogoBox(isCover) {
  if (isCover) {
    // 표지: 요청하신 하단 초록색 영역에 기본 배치
    return { x: 250, y: 1020, width: 580, height: 135 };
  }
  // 마지막 컷 하단: 요청하신 보라색 영역처럼 큼지막한 크기로 기본 배치
  return { x: 250, y: 1055, width: 580, height: 118 };
}

function ensureCutLogoBox(cut) {
  if (!cut) return null;
  if (!cut.logoBox || typeof cut.logoBox.x !== 'number') {
    cut.logoBox = getDefaultLogoBox(Boolean(cut.isCover));
  }
  return cut.logoBox;
}

function loadSavedOrgLogo() {
  const savedLogoDataUrl = localStorage.getItem('webtoon_org_logo_dataurl');
  if (savedLogoDataUrl) {
    const img = new Image();
    img.onload = () => {
      orgLogoImage = img;
      renderAll();
    };
    img.src = savedLogoDataUrl;
  }
}

function handleOrgLogoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const img = new Image();
    img.onload = () => {
      orgLogoImage = img;
      try {
        localStorage.setItem('webtoon_org_logo_dataurl', dataUrl);
      } catch (err) {
        console.warn('로고 로컬 저장 용량 초과:', err);
      }
      renderAll();
      alert('경상남도 감염병관리지원단 로고가 등록되었습니다!\n캔버스에서 로고를 클릭해 위치와 크기를 자유롭게 조절할 수 있습니다.');
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function formatEpisodeDisplayTitle(rawTitle) {
  const cleaned = String(rawTitle || '감염병 예방 웹툰').replace(/_/g, ' ').trim();
  if (cleaned.length > 14 && !cleaned.includes('\n')) {
    const mid = Math.floor(cleaned.length / 2);
    const spaceIdx = cleaned.indexOf(' ', mid - 3);
    if (spaceIdx > 0 && spaceIdx < cleaned.length - 2) {
      return cleaned.slice(0, spaceIdx) + '\n' + cleaned.slice(spaceIdx + 1);
    }
  }
  return cleaned;
}

function createCoverCutObject(episodeTitle, firstBodyBg = 'bg_forest.png', firstHeader = '') {
  return {
    isCover: true,
    background: firstBodyBg,
    scenePrompt: '',
    blurBg: true,
    darkMood: true,
    speedLines: false,
    showBottomLogo: true,
    logoBox: getDefaultLogoBox(true),
    coverBadgeMode: 'none', // 'none'(숨김 - 릴스/피드 겸용 깔끔) | 'reels'(영상용) | 'slide'(옆으로 넘겨서 확인하기)
    captionStyle: 'outline',
    captionSize: 68,
    headerText: formatEpisodeDisplayTitle(episodeTitle),
    footerText: firstHeader ? firstHeader.replace(/\n/g, ' ') : '알아두면 쓸모 있는 감염병 예방 인스타툰',
    items: []
  };
}

function ensureCoverAndEndLogo(cuts, episodeTitle) {
  let result = [...cuts];
  const firstBg = result[0]?.background || 'bg_empty.png';
  const firstHeader = result[0]?.headerText || '';

  if (result.length === 0 || !result[0].isCover) {
    result.unshift(createCoverCutObject(episodeTitle, firstBg, firstHeader));
  }

  result.forEach((c, idx) => {
    if (c.isCover) {
      c.showBottomLogo = true;
      if (!c.coverBadgeMode) c.coverBadgeMode = 'none';
      ensureCutLogoBox(c);
    } else {
      c.showBottomLogo = (idx === result.length - 1);
      ensureCutLogoBox(c);
    }
  });
  return result;
}

// ============================================================================
// 0-1. 실행 취소(Undo) / 다시 실행(Redo) & 오디오·표지 옵션 툴바
// ============================================================================
function saveHistorySnapshot() {
  if (isRestoringHistory) return;
  const snapshot = JSON.stringify({
    cuts: appState.cuts,
    currentCutIndex: appState.currentCutIndex,
    selectedLayerIndex: appState.selectedLayerIndex
  });
  if (undoStack.length > 0 && undoStack[undoStack.length - 1] === snapshot) return;
  undoStack.push(snapshot);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
}

function undoAction() {
  if (undoStack.length === 0) return;
  const currentSnapshot = JSON.stringify({
    cuts: appState.cuts,
    currentCutIndex: appState.currentCutIndex,
    selectedLayerIndex: appState.selectedLayerIndex
  });
  redoStack.push(currentSnapshot);

  const prevSnapshot = undoStack.pop();
  isRestoringHistory = true;
  try {
    const parsed = JSON.parse(prevSnapshot);
    appState.cuts = parsed.cuts;
    appState.currentCutIndex = Math.min(parsed.currentCutIndex, appState.cuts.length - 1);
    appState.selectedLayerIndex = parsed.selectedLayerIndex;
    renderAll();
  } finally {
    isRestoringHistory = false;
    updateUndoRedoButtons();
  }
}

function redoAction() {
  if (redoStack.length === 0) return;
  const currentSnapshot = JSON.stringify({
    cuts: appState.cuts,
    currentCutIndex: appState.currentCutIndex,
    selectedLayerIndex: appState.selectedLayerIndex
  });
  undoStack.push(currentSnapshot);

  const nextSnapshot = redoStack.pop();
  isRestoringHistory = true;
  try {
    const parsed = JSON.parse(nextSnapshot);
    appState.cuts = parsed.cuts;
    appState.currentCutIndex = Math.min(parsed.currentCutIndex, appState.cuts.length - 1);
    appState.selectedLayerIndex = parsed.selectedLayerIndex;
    renderAll();
  } finally {
    isRestoringHistory = false;
    updateUndoRedoButtons();
  }
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btnUndoAction');
  const redoBtn = document.getElementById('btnRedoAction');
  if (undoBtn) {
    undoBtn.disabled = undoStack.length === 0;
    undoBtn.style.opacity = undoStack.length === 0 ? '0.45' : '1';
    undoBtn.textContent = `↩️ 되돌리기 (${undoStack.length})`;
  }
  if (redoBtn) {
    redoBtn.disabled = redoStack.length === 0;
    redoBtn.style.opacity = redoStack.length === 0 ? '0.45' : '1';
  }
}

function injectToolbarEnhancements() {
  const navControls = document.querySelector('.cut-nav-controls');
  if (navControls && !document.getElementById('btnUndoAction')) {
    const undoBtn = document.createElement('button');
    undoBtn.id = 'btnUndoAction';
    undoBtn.className = 'btn btn-outline-sm';
    undoBtn.textContent = '↩️ 되돌리기 (0)';
    undoBtn.title = '방금 한 작업 취소 (단축키: Ctrl+Z)';
    undoBtn.style.borderColor = '#f59e0b';
    undoBtn.style.color = '#fbbf24';
    undoBtn.addEventListener('click', undoAction);

    const redoBtn = document.createElement('button');
    redoBtn.id = 'btnRedoAction';
    redoBtn.className = 'btn btn-outline-sm';
    redoBtn.textContent = '↪️';
    redoBtn.title = '되돌리기 취소 (단축키: Ctrl+Y)';
    redoBtn.addEventListener('click', redoAction);

    const divider = document.createElement('span');
    divider.className = 'divider';
    divider.textContent = '|';

    navControls.insertBefore(divider, navControls.firstChild);
    navControls.insertBefore(redoBtn, navControls.firstChild);
    navControls.insertBefore(undoBtn, navControls.firstChild);

    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoAction();
        else undoAction();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoAction();
      }
    });
    updateUndoRedoButtons();
  }

  const exportBar = document.querySelector('.export-bar');
  if (exportBar && !document.getElementById('audioOptionBox')) {
    const box = document.createElement('div');
    box.id = 'audioOptionBox';
    box.style.cssText = 'display:flex; align-items:center; gap:6px; background:rgba(15,23,42,0.7); border:1px solid #334155; padding:4px 8px; border-radius:6px; font-size:11px; color:#e2e8f0;';
    box.innerHTML = `
      <label style="display:flex; align-items:center; gap:3px; cursor:pointer;" title="시나리오 분위기와 컷 전개에 맞춰 자동 작곡되는 저작권 프리 BGM">
        <input type="checkbox" id="chkEnableBgm" checked> 🎵맞춤BGM
      </label>
      <label style="display:flex; align-items:center; gap:3px; cursor:pointer;" title="말풍선이 뜰 때마다 작고 경쾌한 '뿅!' 효과음 삽입">
        <input type="checkbox" id="chkEnablePopSfx" checked> 💬팝업음
      </label>
    `;
    const mp4Btn = document.getElementById('btnDownloadMp4');
    if (mp4Btn) exportBar.insertBefore(box, mp4Btn);
    else exportBar.appendChild(box);

    document.getElementById('chkEnableBgm').addEventListener('change', (e) => {
      appState.audioOptions.enableBgm = e.target.checked;
    });
    document.getElementById('chkEnablePopSfx').addEventListener('change', (e) => {
      appState.audioOptions.enablePopSfx = e.target.checked;
    });
  }

  // 우측 패널에 표지 하단 안내 문구 모드 & 로고 기본위치 복원 버튼 주입
  const bottomLogoBtn = document.getElementById('btnToggleBottomLogo');
  if (bottomLogoBtn && !document.getElementById('coverBadgeControlWrap')) {
    const wrap = document.createElement('div');
    wrap.id = 'coverBadgeControlWrap';
    wrap.style.cssText = 'margin-top:8px; display:flex; flex-direction:column; gap:6px;';
    wrap.innerHTML = `
      <button id="btnResetLogoBox" class="btn btn-outline-sm" style="width:100%;" title="이동하거나 크기를 바꾼 지원단 로고를 원래 추천 위치·크기로 되돌립니다">📐 로고 위치·크기 기본값 복원</button>
      <div id="coverBadgeSelectGroup" class="form-group" style="margin-bottom:0; margin-top:4px;">
        <label for="coverBadgeModeSelect" style="color:#93c5fd;">📕 표지 하단 안내 문구 (릴스/피드 선택)</label>
        <select id="coverBadgeModeSelect">
          <option value="none">🚫 표시 안 함 (릴스·피드 겸용 깔끔 추천)</option>
          <option value="reels">🎬 릴스·영상용 (▶ 감염병 예방 가이드)</option>
          <option value="slide">📱 슬라이드용 (▶ 옆으로 넘겨서 확인하기)</option>
        </select>
      </div>
    `;
    bottomLogoBtn.parentNode.appendChild(wrap);

    document.getElementById('btnResetLogoBox').addEventListener('click', () => {
      const cut = appState.cuts[appState.currentCutIndex];
      if (!cut) return;
      saveHistorySnapshot();
      cut.logoBox = getDefaultLogoBox(Boolean(cut.isCover));
      cut.showBottomLogo = true;
      appState.selectedLayerIndex = -2;
      renderAll();
    });

    document.getElementById('coverBadgeModeSelect').addEventListener('change', (e) => {
      const cut = appState.cuts[appState.currentCutIndex];
      if (cut && cut.isCover) {
        saveHistorySnapshot();
        cut.coverBadgeMode = e.target.value;
        renderAll();
      }
    });
  }
}

// ============================================================================
// 0-2. 시나리오 분위기 자동 분석 및 컷 전개 맞춤형 Web Audio 엔진
// ============================================================================
function analyzeScenarioMood(cuts, episodeTitle) {
  const fullText = [
    episodeTitle || '',
    ...cuts.map(c => `${c.headerText || ''} ${c.footerText || ''} ${(c.items || []).map(i => i.text || '').join(' ')}`)
  ].join(' ');

  if (/테러|경보|응급|치명|중증|비상|위험|사망|확산/.test(fullText)) {
    return 'alert';
  }
  if (/손씻기|비누|청결|기침|마스크|예방|방역|체크|완벽/.test(fullText)) {
    return 'bright';
  }
  return 'warm';
}

class WebtoonAudioEngine {
  constructor(cuts = [], episodeTitle = '') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.dest = this.ctx.createMediaStreamDestination();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.dest);
    this.masterGain.connect(this.ctx.destination);

    this.isStopped = false;
    this.bgmTimer = null;
    this.baseTheme = analyzeScenarioMood(cuts, episodeTitle);
    this.currentCutMood = 'normal';
  }

  getAudioStream() {
    return this.dest.stream;
  }

  updateCutMood(cut, cutIndex, totalCuts) {
    if (!cut) return;
    if (cut.isCover) {
      this.currentCutMood = 'normal';
      return;
    }
    const cutText = `${cut.headerText || ''} ${(cut.items || []).map(i => i.text || '').join(' ')}`;
    if (cut.darkMood || cut.speedLines || /으악|위험|불청객|안 보여|스톱|잠깐|침투|비말/.test(cutText)) {
      this.currentCutMood = 'tense';
    } else if (cutIndex >= Math.floor(totalCuts * 0.6)) {
      this.currentCutMood = 'resolve';
    } else {
      this.currentCutMood = 'normal';
    }
  }

  startScenarioBgm() {
    if (this.isStopped) return;

    const chordPalettes = {
      warm: [
        [261.63, 329.63, 392.00, 493.88],
        [220.00, 261.63, 329.63, 392.00],
        [174.61, 220.00, 261.63, 329.63],
        [196.00, 246.94, 293.66, 392.00]
      ],
      bright: [
        [293.66, 369.99, 440.00, 554.37],
        [246.94, 293.66, 369.99, 440.00],
        [196.00, 246.94, 293.66, 369.99],
        [220.00, 277.18, 329.63, 440.00]
      ],
      alert: [
        [220.00, 261.63, 329.63, 392.00],
        [174.61, 220.00, 261.63, 329.63],
        [164.81, 196.00, 246.94, 329.63],
        [220.00, 261.63, 329.63, 440.00]
      ],
      tense: [
        [293.66, 349.23, 440.00, 523.25],
        [246.94, 329.63, 392.00, 493.88],
        [220.00, 261.63, 329.63, 415.30],
        [164.81, 246.94, 329.63, 392.00]
      ],
      resolve: [
        [261.63, 329.63, 392.00, 523.25],
        [196.00, 246.94, 293.66, 392.00],
        [220.00, 261.63, 329.63, 440.00],
        [174.61, 220.00, 261.63, 349.23]
      ]
    };

    let step = 0;

    const playNote = () => {
      if (this.isStopped) return;
      const now = this.ctx.currentTime;

      const activeKey = (this.currentCutMood === 'tense' || this.currentCutMood === 'resolve')
        ? this.currentCutMood
        : this.baseTheme;
      const chords = chordPalettes[activeKey] || chordPalettes.warm;

      const chordIdx = Math.floor(step / 4) % chords.length;
      const noteIdx = step % 4;
      const freq = chords[chordIdx][noteIdx];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.currentCutMood === 'tense' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.042, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.1);

      if (noteIdx === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(freq * 0.5, now);
        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.exponentialRampToValueAtTime(0.032, now + 0.08);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
        bassOsc.connect(bassGain);
        bassGain.connect(this.masterGain);
        bassOsc.start(now);
        bassOsc.stop(now + 1.55);
      }

      step++;
      const tempoMs = this.currentCutMood === 'tense' ? 380 : (this.baseTheme === 'bright' ? 410 : 460);
      this.bgmTimer = setTimeout(playNote, tempoMs);
    };

    playNote();
  }

  playBubblePopSound(bubbleStyle = 'round') {
    if (this.isStopped) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (bubbleStyle === 'sfx' || bubbleStyle === 'shout') {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.09);
    } else {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.08);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.065, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  stop() {
    this.isStopped = true;
    if (this.bgmTimer) clearTimeout(this.bgmTimer);
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
  }
}

// ============================================================================
// 1. 빈 워크스페이스 & 샘플 대본 데이터
// ============================================================================
function createEmpty10Cuts() {
  const bodyCuts = Array.from({ length: 10 }, (_, idx) => ({
    isCover: false,
    background: 'bg_empty.png',
    scenePrompt: `${idx + 1}번째 컷 장면을 입력하세요`,
    blurBg: false,
    darkMood: false,
    speedLines: false,
    showBottomLogo: idx === 9,
    logoBox: getDefaultLogoBox(false),
    captionStyle: 'outline',
    captionSize: 46,
    headerText: '',
    footerText: '',
    items: []
  }));
  return ensureCoverAndEndLogo(bodyCuts, '새_에피소드');
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
        headerText: "선선한 바람이 부는 주말,\n토끼 시민의 설레는 산책 준비!",
        footerText: "야외활동 전 필수 수칙 1탄: 밝은색 긴옷 착용",
        items: [
          { type: "bubble", bubbleStyle: "round", tailDir: "left", speaker: "", text: "날씨도 좋은데 시원하게 입고\n뒷산 풀밭 산책 다녀와야지!", fontSize: 36, textColor: "#111827", bgColor: "#ffffff", x: 90, width: 900, tailX: 300, tailY: 480 }
        ]
      }
    ]
  };
}

window.addEventListener('DOMContentLoaded', () => {
  injectToolbarEnhancements();
  loadSavedOrgLogo();
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
    saveHistorySnapshot();
    Object.keys(loadedImages).forEach(key => {
      if (key.startsWith('ai_scene_')) delete loadedImages[key];
    });
    DEFAULT_ASSETS.backgrounds = DEFAULT_ASSETS.backgrounds.filter(b => !b.id.startsWith('ai_scene_'));
  }

  const epTitle = scriptObj.episodeTitle || document.getElementById('episodeTitleInput').value.trim() || '새_에피소드';
  appState.episodeTitle = epTitle;
  document.getElementById('episodeTitleInput').value = epTitle;

  const parsedCuts = scriptObj.cuts.map((rawCut) => {
    const cleanItems = (rawCut.items || [])
      .filter(it => (it.type || '').toLowerCase() !== 'character')
      .map(it => {
        if ((it.type || '').toLowerCase() === 'bubble') {
          return normalizeBubbleLayout(it, rawCut.headerText || '');
        }
        return { ...it };
      });

    return {
      isCover: Boolean(rawCut.isCover),
      background: rawCut.background || 'bg_empty.png',
      scenePrompt: rawCut.scenePrompt || '',
      blurBg: Boolean(rawCut.blurBg),
      darkMood: Boolean(rawCut.darkMood),
      speedLines: Boolean(rawCut.speedLines),
      showBottomLogo: Boolean(rawCut.showBottomLogo),
      logoBox: rawCut.logoBox || getDefaultLogoBox(Boolean(rawCut.isCover)),
      coverBadgeMode: rawCut.coverBadgeMode || 'none',
      captionStyle: rawCut.captionStyle || 'outline',
      captionSize: Number(rawCut.captionSize) || 46,
      headerText: rawCut.headerText || '',
      footerText: rawCut.footerText || '',
      items: cleanItems
    };
  });

  appState.cuts = ensureCoverAndEndLogo(parsedCuts, epTitle);
  appState.currentCutIndex = 0;
  appState.selectedLayerIndex = -1;
  populateSelectMenus();
  renderAll();
}

function getDefaultTailPoint(b) {
  const dir = b.tailDir || 'bottom';
  if (dir === 'left') return { tailX: Math.round(b.x + b.width * 0.25), tailY: Math.round(b.y + b.height + 50) };
  if (dir === 'right') return { tailX: Math.round(b.x + b.width * 0.75), tailY: Math.round(b.y + b.height + 50) };
  return { tailX: Math.round(b.x + b.width * 0.5), tailY: Math.round(b.y + b.height + 50) };
}

function normalizeBubbleLayout(b, headerText = '') {
  const text = String(b.text || '');
  const fontSize = Number(b.fontSize) || 36;
  const lines = text.split('\n');
  const lineCount = lines.length;

  const autoHeight = Math.max(210, lineCount * (fontSize * 1.5) + 75);
  const autoWidth = 900;

  const headerLines = headerText ? headerText.split('\n').length : 1;
  const safeY = headerLines >= 2 ? 280 : 220;

  const normalized = {
    type: 'bubble',
    bubbleStyle: b.bubbleStyle || 'round',
    tailDir: b.tailDir || 'bottom',
    speaker: b.speaker || '',
    text: text,
    fontSize: fontSize,
    textColor: b.textColor || '#111827',
    bgColor: b.bgColor || '#ffffff',
    x: typeof b.x === 'number' ? b.x : 90,
    y: safeY,
    width: autoWidth,
    height: autoHeight
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
  saveHistorySnapshot();
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  Object.keys(loadedImages).forEach(key => {
    if (key.startsWith('ai_scene_')) delete loadedImages[key];
  });
  DEFAULT_ASSETS.backgrounds = DEFAULT_ASSETS.backgrounds.filter(b => !b.id.startsWith('ai_scene_'));

  let loadedCount = 0;
  const timestamp = Date.now();

  const bodyCutIndices = appState.cuts
    .map((c, idx) => (!c.isCover ? idx : -1))
    .filter(idx => idx !== -1);

  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const assetKey = `ai_scene_${timestamp}_${index + 1}_${file.name}`;
        loadedImages[assetKey] = img;
        DEFAULT_ASSETS.backgrounds.push({ id: assetKey, label: `✨ AI장면 #${index + 1} (${file.name})` });

        if (index === 0 && appState.cuts[0]?.isCover) {
          appState.cuts[0].background = assetKey;
        }

        const targetCutIdx = bodyCutIndices[index];
        if (typeof targetCutIdx === 'number' && appState.cuts[targetCutIdx]) {
          appState.cuts[targetCutIdx].background = assetKey;
          appState.cuts[targetCutIdx].blurBg = false;
        }

        loadedCount++;
        if (loadedCount === files.length) {
          populateSelectMenus();
          appState.currentCutIndex = 0;
          appState.selectedLayerIndex = -1;
          renderAll();
          alert(`총 ${files.length}장의 AI 그림이 표지 배경과 본문 1~${files.length}컷에 자동 배치되었습니다!`);
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
  saveHistorySnapshot();
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
          if (!appState.cuts[appState.currentCutIndex].isCover) {
            appState.cuts[appState.currentCutIndex].blurBg = false;
          }
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

// ============================================================================
// 4. 캔버스 렌더링 (자유 이동·크기 조절 지원단 로고 + 표지 + 말풍선/자막)
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

function drawBackgroundAndMood(c, cut, zoomScale = 1.0) {
  const bgId = cut.background || 'bg_empty.png';
  c.save();
  if (zoomScale !== 1.0) {
    c.translate(CANVAS_W / 2, CANVAS_H / 2);
    c.scale(zoomScale, zoomScale);
    c.translate(-CANVAS_W / 2, -CANVAS_H / 2);
  }
  if (cut.blurBg || cut.isCover) c.filter = 'blur(16px)';
  if (loadedImages[bgId]) {
    drawImageCover(c, loadedImages[bgId], (cut.blurBg || cut.isCover) ? 36 : 0);
  } else {
    drawBuiltinBackground(c, bgId, cut.isCover);
  }
  c.restore();

  if (cut.isCover) {
    c.save();
    const coverOverlay = c.createLinearGradient(0, 0, 0, CANVAS_H);
    coverOverlay.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
    coverOverlay.addColorStop(0.5, 'rgba(15, 23, 42, 0.64)');
    coverOverlay.addColorStop(1, 'rgba(15, 23, 42, 0.80)');
    c.fillStyle = coverOverlay;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);

    c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    c.lineWidth = 4;
    c.strokeRect(48, 48, CANVAS_W - 96, CANVAS_H - 96);
    c.restore();
    return;
  }

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

function drawBuiltinBackground(c, bgId, isCover = false) {
  if (isCover) {
    const grad = c.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(1, '#0f172a');
    c.fillStyle = grad;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    return;
  }
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

// 공용 지원단 로고 박스 렌더링 (cut.logoBox 좌표·크기를 그대로 사용하므로 드래그·리사이즈 완벽 연동)
function drawOrgLogoBox(c, cut, alpha = 1.0, offsetY = 0) {
  if (!cut.showBottomLogo || alpha <= 0) return;
  const box = ensureCutLogoBox(cut);
  const bx = box.x;
  const by = box.y + offsetY;
  const bw = box.width;
  const bh = box.height;

  c.save();
  c.globalAlpha = alpha;

  const radius = Math.min(28, Math.round(bh * 0.22));
  c.fillStyle = 'rgba(255, 255, 255, 0.94)';
  c.beginPath();
  c.roundRect(bx, by, bw, bh, radius);
  c.fill();

  c.strokeStyle = 'rgba(15, 23, 42, 0.14)';
  c.lineWidth = 2;
  c.stroke();

  if (orgLogoImage) {
    const padX = Math.max(18, bw * 0.06);
    const padY = Math.max(10, bh * 0.12);
    const innerW = Math.max(20, bw - padX * 2);
    const innerH = Math.max(20, bh - padY * 2);
    const ratio = Math.min(innerW / orgLogoImage.width, innerH / orgLogoImage.height);
    const drawW = orgLogoImage.width * ratio;
    const drawH = orgLogoImage.height * ratio;
    c.drawImage(orgLogoImage, bx + (bw - drawW) / 2, by + (bh - drawH) / 2, drawW, drawH);
  } else {
    const autoFontSize = Math.max(20, Math.min(44, Math.round(bh * 0.34)));
    c.fillStyle = '#0f172a';
    c.font = `900 ${autoFontSize}px "Noto Sans KR", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`🏛️ ${ORG_NAME_DEFAULT}`, bx + bw / 2, by + bh / 2 + 1);
  }

  c.restore();
}

// 표지 전용 렌더링 (제목 중앙 배치 + 하단 초록 영역 로고 + 선택형 하단 안내 문구)
function drawCoverLayout(c, cut, alpha = 1.0, slideOffsetY = 0, isVideoExport = false) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  c.translate(0, slideOffsetY);

  // 1. 중앙 메인 제목 (headerText) - 상단 로고가 내려간 만큼 시선이 자연스럽게 중앙에 오도록 배치
  const mainTitle = (cut.headerText || formatEpisodeDisplayTitle(appState.episodeTitle)).trim();
  const titleLines = mainTitle.split('\n');
  const titleFontSize = Math.max(54, Number(cut.captionSize) || 68);
  const lineHeight = titleFontSize * 1.32;
  const totalTitleH = titleLines.length * lineHeight;
  let titleStartY = 530 - totalTitleH / 2 + lineHeight / 2;

  c.font = `900 ${titleFontSize}px "Noto Sans KR", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = 14;
  c.strokeStyle = '#0f172a';

  titleLines.forEach((line, idx) => {
    const y = titleStartY + idx * lineHeight;
    c.strokeText(line, CANVAS_W / 2, y);
    c.fillStyle = idx === 0 ? '#fde047' : '#ffffff';
    c.fillText(line, CANVAS_W / 2, y);
  });

  // 2. 장식 구분선
  const dividerY = titleStartY + totalTitleH + 34;
  c.strokeStyle = '#38bdf8';
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(CANVAS_W / 2 - 120, dividerY);
  c.lineTo(CANVAS_W / 2 + 120, dividerY);
  c.stroke();

  // 3. 하단 부제목 / 안내 문구 (footerText)
  const subTitle = (cut.footerText || '').trim();
  if (subTitle) {
    c.font = '700 36px "Noto Sans KR", sans-serif';
    c.fillStyle = '#e2e8f0';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    const subLines = subTitle.split('\n');
    subLines.forEach((line, idx) => {
      c.fillText(line, CANVAS_W / 2, dividerY + 46 + idx * 48);
    });
  }

  // 4. 최하단 안내 배지 (영상 저장 시 '옆으로 넘겨서 확인하기'는 자동으로 숨김/릴스 문구로 대체)
  let badgeMode = cut.coverBadgeMode || 'none';
  if (isVideoExport && badgeMode === 'slide') {
    badgeMode = 'none';
  }

  if (badgeMode === 'slide' || badgeMode === 'reels') {
    const badgeLabel = badgeMode === 'reels' ? '▶ 감염병 예방 숏폼 가이드' : '▶ 옆으로 넘겨서 확인하기';
    c.fillStyle = 'rgba(255, 255, 255, 0.16)';
    c.beginPath();
    c.roundRect(CANVAS_W / 2 - 190, CANVAS_H - 135, 380, 52, 26);
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = '700 23px "Noto Sans KR", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(badgeLabel, CANVAS_W / 2, CANVAS_H - 109);
  }

  c.restore();

  // 5. 표지 지원단 로고 박스 (기본 위치: 초록색 영역 y=1020, 사용자가 드래그·리사이즈 가능)
  drawOrgLogoBox(c, cut, alpha, slideOffsetY);
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

function drawStoryCaptions(c, cut, cutNumber, totalCuts, alpha = 1.0, slideOffsetY = 0) {
  if (alpha <= 0 || cut.isCover) return;
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
    if (headerText) drawCaptionBlock(c, headerText, 40 + slideOffsetY, 'top', style, fontSize);
    if (footerText) drawCaptionBlock(c, footerText, CANVAS_H - 40 + slideOffsetY * 0.6, 'bottom', style, fontSize);
  }

  const hasCover = appState.cuts[0]?.isCover;
  const badgeText = hasCover ? `${cutNumber - 1}/${totalCuts - 1}` : `${cutNumber}/${totalCuts}`;
  c.font = '700 22px "Noto Sans KR", sans-serif';
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
  const floatY = animState?.floatY || 0;

  c.translate(x + width / 2, y + height / 2 + floatY);
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
    x, width, height,
    text = '',
    speaker = '',
    bubbleStyle = 'round',
    tailDir = 'bottom',
    fontSize = 36,
    textColor = '#111827',
    bgColor = '#ffffff'
  } = item;

  const floatY = animState?.floatY || 0;
  const y = item.y + floatY;

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

  if (cut.isCover) {
    drawCoverLayout(targetCtx, cut, 1.0, 0, false);
  } else {
    (cut.items || []).forEach((item, idx) => {
      const t = (item.type || '').toLowerCase();
      if (t === 'bubble') drawBubbleLayer(targetCtx, item, null);
      else if (t === 'sticker') drawStickerLayer(targetCtx, item, null);

      if (showSelection && idx === appState.selectedLayerIndex) {
        drawSelectionBox(targetCtx, item);
      }
    });

    drawStoryCaptions(targetCtx, cut, cutIndex + 1, appState.cuts.length, 1.0, 0);
    drawOrgLogoBox(targetCtx, cut, 1.0, 0);
  }

  // 지원단 로고가 선택된 상태(-2)이면 크기 조절 및 이동 핸들 표시
  if (showSelection && appState.selectedLayerIndex === -2 && cut.showBottomLogo) {
    drawSelectionBox(targetCtx, ensureCutLogoBox(cut));
  }
}

// ============================================================================
// 5. 4종 몰입형 모션(크로스페이드 + 말풍선 부유 + 위기 흔들림 + 자막 슬라이드업)
// ============================================================================
function isTenseCut(cut) {
  if (!cut || cut.isCover) return false;
  const cutText = `${cut.headerText || ''} ${(cut.items || []).map(i => i.text || '').join(' ')}`;
  return Boolean(cut.speedLines || /으악|위험|불청객|안 보여|스톱|잠깐|침투|비말/.test(cutText));
}

function getCutAnimationSpec(cut) {
  if (cut.isCover) {
    return { orderMap: {}, introDelay: 0.2, stepInterval: 0.5, popDuration: 0.3, totalDuration: 2.3, tense: false };
  }

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
  const stepInterval = 0.65;
  const popDuration = 0.28;
  const bubbleChars = items.reduce((acc, it) => acc + String(it.text || '').length, 0);
  const readingHold = Math.min(3.2, Math.max(2.0, 1.4 + bubbleChars * 0.055));
  const lastBubbleTime = items.length > 0 ? introDelay + (items.length - 1) * stepInterval + popDuration : introDelay;
  const totalDuration = lastBubbleTime + readingHold;

  return { orderMap, introDelay, stepInterval, popDuration, totalDuration, tense: isTenseCut(cut) };
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function renderAnimatedCutFrame(
  targetCtx,
  cutIndex,
  elapsedSec,
  spec,
  onItemAppearCallback = null,
  triggeredSet = null,
  prevSnapshotCanvas = null,
  isVideoExport = true
) {
  const cut = appState.cuts[cutIndex];
  if (!cut) return;
  targetCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  let shakeX = 0;
  let shakeY = 0;
  if (spec.tense && elapsedSec >= spec.introDelay && elapsedSec <= spec.introDelay + 0.22) {
    const shakeProgress = (elapsedSec - spec.introDelay) / 0.22;
    const decay = 1 - shakeProgress;
    shakeX = Math.sin(shakeProgress * Math.PI * 6) * 7 * decay;
    shakeY = Math.cos(shakeProgress * Math.PI * 5) * 4 * decay;
  }

  targetCtx.save();
  if (shakeX !== 0 || shakeY !== 0) {
    targetCtx.translate(shakeX, shakeY);
  }

  const progress = Math.min(1, Math.max(0, elapsedSec / spec.totalDuration));
  const zoomScale = 1.0 + progress * 0.035;
  drawBackgroundAndMood(targetCtx, cut, zoomScale);

  const captionT = Math.min(1, elapsedSec / 0.32);
  const captionEase = easeOutCubic(captionT);
  const captionAlpha = captionEase;
  const captionSlideY = (1 - captionEase) * 16;

  if (cut.isCover) {
    drawCoverLayout(targetCtx, cut, captionAlpha, captionSlideY, isVideoExport);
  } else {
    (cut.items || []).forEach((item, idx) => {
      const seqOrder = spec.orderMap[idx] ?? idx;
      const appearTime = spec.introDelay + seqOrder * spec.stepInterval;
      const localT = (elapsedSec - appearTime) / spec.popDuration;

      if (localT <= 0) return;

      if (onItemAppearCallback && triggeredSet && !triggeredSet.has(idx)) {
        triggeredSet.add(idx);
        onItemAppearCallback(item, cut);
      }

      let alpha = 1.0;
      let scale = 1.0;
      let floatY = 0;

      if (localT < 1.0) {
        alpha = Math.min(1, localT * 1.8);
        scale = 0.65 + 0.35 * easeOutBack(localT);
      } else {
        const postAppearSec = elapsedSec - (appearTime + spec.popDuration);
        floatY = Math.sin(postAppearSec * 2.6 + idx) * 4.0;
      }

      const t = (item.type || '').toLowerCase();
      if (t === 'bubble') drawBubbleLayer(targetCtx, item, { alpha, scale, floatY });
      else if (t === 'sticker') drawStickerLayer(targetCtx, item, { alpha, scale, floatY });
    });

    drawStoryCaptions(targetCtx, cut, cutIndex + 1, appState.cuts.length, captionAlpha, captionSlideY);
    drawOrgLogoBox(targetCtx, cut, captionAlpha, 0);
  }

  targetCtx.restore();

  const transitionDur = 0.28;
  if (prevSnapshotCanvas && elapsedSec < transitionDur) {
    const trProgress = easeOutCubic(elapsedSec / transitionDur);
    targetCtx.save();
    targetCtx.globalAlpha = 1 - trProgress;
    targetCtx.drawImage(prevSnapshotCanvas, -trProgress * 28, 0, CANVAS_W, CANVAS_H);
    targetCtx.restore();
  }
}

function stopAllPreviewMedia() {
  if (previewAnimId) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }
  if (activeAudioCtx) {
    activeAudioCtx.stop();
    activeAudioCtx = null;
  }
}

function previewCurrentCutAnimation() {
  stopAllPreviewMedia();
  const cutIndex = appState.currentCutIndex;
  const cut = appState.cuts[cutIndex];
  if (!cut) return;

  setViewMode('single');
  const spec = getCutAnimationSpec(cut);
  const startTime = performance.now();
  const triggeredSet = new Set();

  let prevSnapshot = null;
  if (cutIndex > 0) {
    prevSnapshot = document.createElement('canvas');
    prevSnapshot.width = CANVAS_W;
    prevSnapshot.height = CANVAS_H;
    renderCutToContext(prevSnapshot.getContext('2d'), cutIndex - 1, false);
  }

  const audioEngine = new WebtoonAudioEngine(appState.cuts, appState.episodeTitle);
  audioEngine.updateCutMood(cut, cutIndex, appState.cuts.length);
  activeAudioCtx = audioEngine;
  if (appState.audioOptions.enableBgm) {
    audioEngine.startScenarioBgm();
  }

  function step(now) {
    const elapsedSec = (now - startTime) / 1000;
    if (elapsedSec <= spec.totalDuration) {
      renderAnimatedCutFrame(ctx, cutIndex, elapsedSec, spec, (item) => {
        if (appState.audioOptions.enablePopSfx && (item.type || '').toLowerCase() === 'bubble') {
          audioEngine.playBubblePopSound(item.bubbleStyle);
        }
      }, triggeredSet, prevSnapshot, true);
      previewAnimId = requestAnimationFrame(step);
    } else {
      stopAllPreviewMedia();
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
  stopAllPreviewMedia();
  renderCutToContext(ctx, appState.currentCutIndex, true);
  document.getElementById('cutCountLabel').textContent = appState.cuts.length;

  const curCut = appState.cuts[appState.currentCutIndex];
  const labelPrefix = curCut?.isCover ? '📕 표지 ' : '';
  document.getElementById('currentCutIndicator').textContent = `${labelPrefix}(${appState.currentCutIndex + 1} / ${appState.cuts.length})`;

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

  const hasCover = appState.cuts[0]?.isCover;

  appState.cuts.forEach((cut, idx) => {
    renderCutToContext(offCtx, idx, false);
    const dataUrl = offCanvas.toDataURL('image/png');

    const titleLabel = cut.isCover
      ? '📕 표지'
      : (hasCover ? `#${String(idx).padStart(2, '0')}컷` : `#${String(idx + 1).padStart(2, '0')}컷`);

    const card = document.createElement('div');
    card.className = `cut-thumb-card ${idx === appState.currentCutIndex ? 'active' : ''} ${cut.isCover ? 'is-cover' : ''}`;
    card.innerHTML = `
      <div class="cut-thumb-header">
        <span>${titleLabel}</span>
        ${cut.showBottomLogo ? '<span title="지원단 로고 표시됨">🏛️</span>' : ''}
      </div>
      <img src="${dataUrl}" class="cut-thumb-preview" alt="${titleLabel}">
    `;
    card.addEventListener('click', () => { appState.currentCutIndex = idx; appState.selectedLayerIndex = -1; renderAll(); });
    thumbList.appendChild(card);

    if (appState.viewMode === 'grid') {
      const gridItem = document.createElement('div');
      gridItem.className = 'grid-cut-item';
      gridItem.innerHTML = `
        <div class="grid-cut-top">
          <span>${cut.isCover ? '📕 표지 페이지' : `${hasCover ? idx : idx + 1}번째 컷`}</span>
          <button class="btn btn-outline-sm btn-edit-this">편집하기</button>
        </div>
        <img src="${dataUrl}" class="grid-cut-img" alt="${titleLabel}">
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

// 캔버스 마우스 이벤트: 말풍선/스티커뿐만 아니라 지원단 로고(-2)도 자유롭게 드래그 & 리사이즈 지원
function bindCanvasMouseEvents() {
  mainCanvas.addEventListener('mousedown', (e) => {
    stopAllPreviewMedia();
    const pos = getCanvasMousePos(e);
    const cut = appState.cuts[appState.currentCutIndex];
    if (!cut) return;

    // 1. 현재 선택된 객체가 로고(-2)이거나 일반 아이템(>=0)이면 리사이즈 핸들 먼저 체크
    if (appState.selectedLayerIndex === -2 && cut.showBottomLogo) {
      const logoBox = ensureCutLogoBox(cut);
      const handleMode = hitTestHandle(pos, logoBox);
      if (handleMode) {
        saveHistorySnapshot();
        dragState = {
          isDragging: true,
          mode: handleMode,
          targetType: 'logo',
          startX: pos.x,
          startY: pos.y,
          initialBox: { x: logoBox.x, y: logoBox.y, width: logoBox.width, height: logoBox.height }
        };
        return;
      }
    } else if (!cut.isCover && appState.selectedLayerIndex >= 0 && cut.items[appState.selectedLayerIndex]) {
      const selItem = cut.items[appState.selectedLayerIndex];
      const handleMode = hitTestHandle(pos, selItem);
      if (handleMode) {
        saveHistorySnapshot();
        dragState = {
          isDragging: true,
          mode: handleMode,
          targetType: 'item',
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

    // 2. 본문 아이템 클릭 히트 테스트
    if (!cut.isCover) {
      let foundIdx = -1;
      for (let i = cut.items.length - 1; i >= 0; i--) {
        const it = cut.items[i];
        if (pos.x >= it.x && pos.x <= it.x + it.width && pos.y >= it.y && pos.y <= it.y + it.height) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx >= 0) {
        appState.selectedLayerIndex = foundIdx;
        saveHistorySnapshot();
        const selItem = cut.items[foundIdx];
        dragState = {
          isDragging: true,
          mode: 'move',
          targetType: 'item',
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
        renderAll();
        return;
      }
    }

    // 3. 지원단 로고 박스 클릭 히트 테스트 (표지 및 로고 표시된 컷 모두 가능)
    if (cut.showBottomLogo) {
      const logoBox = ensureCutLogoBox(cut);
      if (pos.x >= logoBox.x && pos.x <= logoBox.x + logoBox.width && pos.y >= logoBox.y && pos.y <= logoBox.y + logoBox.height) {
        appState.selectedLayerIndex = -2;
        saveHistorySnapshot();
        dragState = {
          isDragging: true,
          mode: 'move',
          targetType: 'logo',
          startX: pos.x,
          startY: pos.y,
          initialBox: { x: logoBox.x, y: logoBox.y, width: logoBox.width, height: logoBox.height }
        };
        renderAll();
        return;
      }
    }

    appState.selectedLayerIndex = -1;
    renderAll();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragState.isDragging) return;
    const cut = appState.cuts[appState.currentCutIndex];
    if (!cut) return;

    const targetBox = dragState.targetType === 'logo'
      ? ensureCutLogoBox(cut)
      : cut.items?.[appState.selectedLayerIndex];
    if (!targetBox) return;

    const pos = getCanvasMousePos(e);
    const dx = pos.x - dragState.startX;
    const dy = pos.y - dragState.startY;
    const b = dragState.initialBox;
    const minW = dragState.targetType === 'logo' ? 180 : 80;
    const minH = dragState.targetType === 'logo' ? 48 : 80;

    if (dragState.mode === 'tail' && dragState.targetType === 'item') {
      targetBox.tailX = Math.round(pos.x);
      targetBox.tailY = Math.round(pos.y);
      targetBox.tailDir = 'custom';
      document.getElementById('bubbleTailSelect').value = 'custom';
    } else if (dragState.mode === 'move') {
      targetBox.x = Math.round(b.x + dx);
      targetBox.y = Math.round(b.y + dy);
      if (dragState.targetType === 'item' && typeof b.tailX === 'number') {
        targetBox.tailX = Math.round(b.tailX + dx);
        targetBox.tailY = Math.round(b.tailY + dy);
      }
    } else if (dragState.mode === 'resize-se') {
      targetBox.width = Math.max(minW, Math.round(b.width + dx));
      targetBox.height = Math.max(minH, Math.round(b.height + dy));
    } else if (dragState.mode === 'resize-sw') {
      const newW = Math.max(minW, Math.round(b.width - dx));
      targetBox.x = Math.round(b.x + (b.width - newW));
      targetBox.width = newW;
      targetBox.height = Math.max(minH, Math.round(b.height + dy));
    } else if (dragState.mode === 'resize-ne') {
      const newH = Math.max(minH, Math.round(b.height - dy));
      targetBox.y = Math.round(b.y + (b.height - newH));
      targetBox.width = Math.max(minW, Math.round(b.width + dx));
      targetBox.height = newH;
    } else if (dragState.mode === 'resize-nw') {
      const newW = Math.max(minW, Math.round(b.width - dx));
      const newH = Math.max(minH, Math.round(b.height - dy));
      targetBox.x = Math.round(b.x + (b.width - newW));
      targetBox.y = Math.round(b.y + (b.height - newH));
      targetBox.width = newW;
      targetBox.height = newH;
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
  document.getElementById('captionSizeInput').value = cut.captionSize || (cut.isCover ? 68 : 46);

  const headerLabel = document.getElementById('headerLabelText');
  const footerLabel = document.getElementById('footerLabelText');
  if (headerLabel) headerLabel.textContent = cut.isCover ? '📕 표지 대제목 (중앙 배치)' : '상단 사연 자막 (흰 글씨 + 검은 외곽선)';
  if (footerLabel) footerLabel.textContent = cut.isCover ? '📕 표지 부제목 (중앙 하단 배치)' : '하단 사연 자막 (흰 글씨 + 검은 외곽선)';

  const coverBadgeGroup = document.getElementById('coverBadgeSelectGroup');
  const coverBadgeSelect = document.getElementById('coverBadgeModeSelect');
  if (coverBadgeGroup && coverBadgeSelect) {
    coverBadgeGroup.classList.toggle('hidden', !cut.isCover);
    coverBadgeSelect.value = cut.coverBadgeMode || 'none';
  }

  document.getElementById('btnToggleBlur').style.borderColor = cut.blurBg ? '#3b82f6' : '';
  document.getElementById('btnToggleDark').style.borderColor = cut.darkMood ? '#3b82f6' : '';
  document.getElementById('btnToggleSpeed').style.borderColor = cut.speedLines ? '#3b82f6' : '';
  const bottomLogoBtn = document.getElementById('btnToggleBottomLogo');
  if (bottomLogoBtn) {
    bottomLogoBtn.style.backgroundColor = cut.showBottomLogo ? 'rgba(56, 189, 248, 0.25)' : '';
  }

  const noSelMsg = document.getElementById('noSelectionMsg');
  const commonCtrl = document.getElementById('commonLayerControls');
  const bubbleInsp = document.getElementById('bubbleInspector');
  const stickerInsp = document.getElementById('stickerInspector');
  const badge = document.getElementById('selectedTypeBadge');

  bubbleInsp.classList.add('hidden');
  stickerInsp.classList.add('hidden');

  if (appState.selectedLayerIndex === -2 && cut.showBottomLogo) {
    noSelMsg.classList.remove('hidden');
    noSelMsg.innerHTML = '🏛️ <strong>지원단 로고</strong>가 선택되었습니다.<br>캔버스에서 로고를 드래그해 위치를 옮기거나 모서리 핸들로 크기를 조절하세요!';
    commonCtrl.classList.add('hidden');
    badge.textContent = '🏛️ 지원단 로고 조절 중';
    return;
  }

  const item = cut.items[appState.selectedLayerIndex];
  if (!item) {
    noSelMsg.classList.remove('hidden');
    noSelMsg.innerHTML = '캔버스에서 <strong>말풍선</strong>이나 <strong>지원단 로고</strong>를 클릭하면 위치 이동과 크기 조절이 가능합니다.';
    commonCtrl.classList.add('hidden');
    badge.textContent = cut.isCover ? '📕 표지 페이지' : '선택 없음';
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
    document.getElementById('fontSizeInput').value = item.fontSize || 36;
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

  document.getElementById('orgLogoInput').addEventListener('change', handleOrgLogoUpload);
  document.getElementById('batchSceneInput').addEventListener('change', handleBatchSceneUpload);
  document.getElementById('localAssetInput').addEventListener('change', handleLocalAssetUpload);

  document.getElementById('episodeTitleInput').addEventListener('input', (e) => {
    appState.episodeTitle = e.target.value;
    if (appState.cuts[0]?.isCover) {
      appState.cuts[0].headerText = formatEpisodeDisplayTitle(e.target.value);
      renderAll();
    }
  });

  document.getElementById('btnAddCoverCut').addEventListener('click', () => {
    if (appState.cuts[0]?.isCover) {
      appState.currentCutIndex = 0;
      renderAll();
      return alert('이미 맨 앞에 표지 페이지가 있습니다!');
    }
    saveHistorySnapshot();
    const firstBg = appState.cuts[0]?.background || 'bg_empty.png';
    const firstHeader = appState.cuts[0]?.headerText || '';
    appState.cuts.unshift(createCoverCutObject(appState.episodeTitle, firstBg, firstHeader));
    appState.currentCutIndex = 0;
    appState.selectedLayerIndex = -1;
    renderAll();
  });

  document.getElementById('btnToggleBottomLogo').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) {
      saveHistorySnapshot();
      cut.showBottomLogo = !cut.showBottomLogo;
      if (cut.showBottomLogo) {
        ensureCutLogoBox(cut);
        appState.selectedLayerIndex = -2;
      } else if (appState.selectedLayerIndex === -2) {
        appState.selectedLayerIndex = -1;
      }
      renderAll();
    }
  });

  document.getElementById('btnClearWorkspace').addEventListener('click', () => {
    if (!confirm('현재 작업 중인 자막, 말풍선, 이미지를 모두 비우고 초기 상태로 되돌릴까요? (등록한 지원단 로고는 유지됩니다)')) return;
    saveHistorySnapshot();
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
    saveHistorySnapshot();
    appState.cuts.push({
      isCover: false,
      background: 'bg_empty.png',
      scenePrompt: '',
      blurBg: false,
      darkMood: false,
      speedLines: false,
      showBottomLogo: true,
      logoBox: getDefaultLogoBox(false),
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
    saveHistorySnapshot();
    const clone = JSON.parse(JSON.stringify(cur));
    clone.isCover = false;
    appState.cuts.splice(appState.currentCutIndex + 1, 0, clone);
    appState.currentCutIndex++;
    renderAll();
  });

  document.getElementById('btnDeleteCut').addEventListener('click', () => {
    if (appState.cuts.length <= 1) return alert('최소 1개의 컷은 유지해야 합니다.');
    saveHistorySnapshot();
    appState.cuts.splice(appState.currentCutIndex, 1);
    appState.currentCutIndex = Math.max(0, appState.currentCutIndex - 1);
    appState.selectedLayerIndex = -1;
    renderAll();
  });

  document.getElementById('bgSelect').addEventListener('change', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { saveHistorySnapshot(); cut.background = e.target.value; renderAll(); }
  });

  document.getElementById('btnToggleBlur').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { saveHistorySnapshot(); cut.blurBg = !cut.blurBg; renderAll(); }
  });

  document.getElementById('btnToggleDark').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { saveHistorySnapshot(); cut.darkMood = !cut.darkMood; renderAll(); }
  });

  document.getElementById('btnToggleSpeed').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { saveHistorySnapshot(); cut.speedLines = !cut.speedLines; renderAll(); }
  });

  document.getElementById('cutHeaderInput').addEventListener('focus', saveHistorySnapshot);
  document.getElementById('cutHeaderInput').addEventListener('input', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) {
      cut.headerText = e.target.value;
      if (!cut.isCover) {
        const headerLines = cut.headerText ? cut.headerText.split('\n').length : 1;
        const safeY = headerLines >= 2 ? 280 : 220;
        (cut.items || []).forEach(item => {
          if ((item.type || '').toLowerCase() === 'bubble') {
            item.y = safeY;
          }
        });
      }
      renderAll();
    }
  });

  document.getElementById('cutFooterInput').addEventListener('focus', saveHistorySnapshot);
  document.getElementById('cutFooterInput').addEventListener('input', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.footerText = e.target.value; renderAll(); }
  });

  document.getElementById('captionStyleSelect').addEventListener('change', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { saveHistorySnapshot(); cut.captionStyle = e.target.value; renderAll(); }
  });

  document.getElementById('captionSizeInput').addEventListener('focus', saveHistorySnapshot);
  document.getElementById('captionSizeInput').addEventListener('input', (e) => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut) { cut.captionSize = Number(e.target.value) || 46; renderAll(); }
  });

  document.getElementById('btnAddBubble').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut.isCover) return alert('표지 페이지에는 말풍선을 추가할 수 없습니다. 다음 컷으로 이동해 주세요.');
    saveHistorySnapshot();
    const headerLines = cut.headerText ? cut.headerText.split('\n').length : 1;
    const safeY = headerLines >= 2 ? 280 : 220;

    const newBubble = {
      type: 'bubble',
      bubbleStyle: 'round',
      tailDir: 'custom',
      speaker: '',
      text: '새로운 대사를 입력하세요',
      fontSize: 36,
      textColor: '#111827',
      bgColor: '#ffffff',
      x: 90, y: safeY, width: 900, height: 210,
      tailX: 540, tailY: 480
    };
    cut.items.push(newBubble);
    appState.selectedLayerIndex = cut.items.length - 1;
    renderAll();
  });

  document.getElementById('btnAddSticker').addEventListener('click', () => {
    const cut = appState.cuts[appState.currentCutIndex];
    if (cut.isCover) return alert('표지 페이지에는 스티커를 추가할 수 없습니다.');
    saveHistorySnapshot();
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
    saveHistorySnapshot();
    cut.items = [];
    appState.selectedLayerIndex = -1;
    renderAll();
  });

  document.getElementById('btnFlipX').addEventListener('click', () => {
    const item = getSelectedItem();
    if (item) { saveHistorySnapshot(); item.flipX = !item.flipX; renderAll(); }
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
          saveHistorySnapshot();
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
      saveHistorySnapshot();
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
      saveHistorySnapshot();
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
      saveHistorySnapshot();
      cut.items.splice(idx, 1);
      appState.selectedLayerIndex = -1;
      renderAll();
    }
  });

  document.getElementById('speakerInput').addEventListener('focus', saveHistorySnapshot);
  document.getElementById('speakerInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.speaker = e.target.value; renderAll(); }
  });

  document.getElementById('dialogueTextarea').addEventListener('focus', saveHistorySnapshot);
  document.getElementById('dialogueTextarea').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) {
      item.text = e.target.value;
      const lineCount = item.text.split('\n').length;
      item.height = Math.max(210, lineCount * (item.fontSize * 1.5) + 75);
      renderAll();
    }
  });

  document.getElementById('bubbleStyleSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { saveHistorySnapshot(); item.bubbleStyle = e.target.value; renderAll(); }
  });
  document.getElementById('bubbleTailSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) {
      saveHistorySnapshot();
      item.tailDir = e.target.value;
      if (e.target.value === 'left' || e.target.value === 'right' || e.target.value === 'bottom') {
        const pt = getDefaultTailPoint(item);
        item.tailX = pt.tailX;
        item.tailY = pt.tailY;
      }
      renderAll();
    }
  });

  document.getElementById('fontSizeInput').addEventListener('focus', saveHistorySnapshot);
  document.getElementById('fontSizeInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) {
      item.fontSize = Number(e.target.value) || 36;
      const lineCount = (item.text || '').split('\n').length;
      item.height = Math.max(210, lineCount * (item.fontSize * 1.5) + 75);
      renderAll();
    }
  });

  document.getElementById('textColorInput').addEventListener('focus', saveHistorySnapshot);
  document.getElementById('textColorInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.textColor = e.target.value; renderAll(); }
  });

  document.getElementById('bubbleBgColorInput').addEventListener('focus', saveHistorySnapshot);
  document.getElementById('bubbleBgColorInput').addEventListener('input', (e) => {
    const item = getSelectedItem();
    if (item) { item.bgColor = e.target.value; renderAll(); }
  });

  document.getElementById('stickerSelect').addEventListener('change', (e) => {
    const item = getSelectedItem();
    if (item) { saveHistorySnapshot(); item.stickerId = e.target.value; renderAll(); }
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
  if (!cut || appState.selectedLayerIndex < 0) return null;
  return cut.items[appState.selectedLayerIndex] || null;
}

function getSanitizedEpisodeName() {
  const raw = document.getElementById('episodeTitleInput').value.trim();
  return raw.replace(/[\\/:*?"<>|]/g, '_') || '웹툰';
}

function downloadCurrentCutPng() {
  const epName = getSanitizedEpisodeName();
  const isCover = appState.cuts[appState.currentCutIndex]?.isCover;
  const numStr = isCover ? '00_표지' : String(appState.currentCutIndex).padStart(2, '0');
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
      const suffix = appState.cuts[i].isCover ? '_표지' : '';
      const imgFileName = `${epName}_${numStr}${suffix}.png`;
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
  stopAllPreviewMedia();
  const epName = getSanitizedEpisodeName();
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  overlay.classList.remove('hidden');

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = CANVAS_W;
  exportCanvas.height = CANVAS_H;
  const exportCtx = exportCanvas.getContext('2d');
  const fps = 30;

  const hasAudio = appState.audioOptions.enableBgm || appState.audioOptions.enablePopSfx;

  try {
    if (hasAudio) {
      await recordVideoWithAudio(exportCanvas, exportCtx, fps, epName, loadingText);
      return;
    }

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
        const prevSnapshot = document.createElement('canvas');
        prevSnapshot.width = CANVAS_W;
        prevSnapshot.height = CANVAS_H;

        for (let i = 0; i < appState.cuts.length; i++) {
          const cut = appState.cuts[i];
          const spec = getCutAnimationSpec(cut);
          const totalCutFrames = Math.round(spec.totalDuration * fps);

          for (let f = 0; f < totalCutFrames; f++) {
            if (f % 10 === 0) {
              loadingText.textContent = `🎬 릴스 MP4 렌더링 중... (${i + 1} / ${appState.cuts.length}장)`;
              await new Promise(r => setTimeout(r, 0));
            }
            const elapsedSec = f / fps;
            renderAnimatedCutFrame(exportCtx, i, elapsedSec, spec, null, null, i > 0 ? prevSnapshot : null, true);

            const timestampUs = Math.round((globalFrameIndex / fps) * 1_000_000);
            const durationUs = Math.round((1 / fps) * 1_000_000);
            const frame = new VideoFrame(exportCanvas, { timestamp: timestampUs, duration: durationUs });
            encoder.encode(frame, { keyFrame: f === 0 });
            frame.close();
            globalFrameIndex++;
          }

          prevSnapshot.getContext('2d').drawImage(exportCanvas, 0, 0);
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

    await recordVideoWithAudio(exportCanvas, exportCtx, fps, epName, loadingText, true);
  } catch (err) {
    alert('동영상 생성 중 오류가 발생했습니다: ' + err.message);
  } finally {
    overlay.classList.add('hidden');
  }
}

async function recordVideoWithAudio(exportCanvas, exportCtx, fps, epName, loadingText, forceMute = false) {
  const videoStream = exportCanvas.captureStream(fps);
  const combinedTracks = [...videoStream.getVideoTracks()];

  let audioEngine = null;
  if (!forceMute && (appState.audioOptions.enableBgm || appState.audioOptions.enablePopSfx)) {
    audioEngine = new WebtoonAudioEngine(appState.cuts, appState.episodeTitle);
    if (appState.audioOptions.enableBgm) {
      audioEngine.startScenarioBgm();
    }
    const audioTracks = audioEngine.getAudioStream().getAudioTracks();
    combinedTracks.push(...audioTracks);
  }

  const finalStream = new MediaStream(combinedTracks);
  const mimeTypes = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=h264,opus',
    'video/webm'
  ];
  const selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
  const recorder = new MediaRecorder(finalStream, selectedMime ? { mimeType: selectedMime, videoBitsPerSecond: 5_000_000 } : {});
  const chunks = [];

  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const stopPromise = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.start();

  const prevSnapshot = document.createElement('canvas');
  prevSnapshot.width = CANVAS_W;
  prevSnapshot.height = CANVAS_H;

  try {
    for (let i = 0; i < appState.cuts.length; i++) {
      const cut = appState.cuts[i];
      if (audioEngine) {
        audioEngine.updateCutMood(cut, i, appState.cuts.length);
      }
      const spec = getCutAnimationSpec(cut);
      const startMs = performance.now();
      const triggeredSet = new Set();

      while (true) {
        const elapsedSec = (performance.now() - startMs) / 1000;
        if (elapsedSec > spec.totalDuration) break;

        loadingText.textContent = `🎬 표지·모션·맞춤BGM·팝업음 합성 중... (${i + 1} / ${appState.cuts.length}장)`;
        renderAnimatedCutFrame(
          exportCtx,
          i,
          elapsedSec,
          spec,
          (item) => {
            if (audioEngine && appState.audioOptions.enablePopSfx && (item.type || '').toLowerCase() === 'bubble') {
              audioEngine.playBubblePopSound(item.bubbleStyle);
            }
          },
          triggeredSet,
          i > 0 ? prevSnapshot : null,
          true
        );

        await new Promise(r => requestAnimationFrame(r));
      }

      prevSnapshot.getContext('2d').drawImage(exportCanvas, 0, 0);
    }
  } finally {
    recorder.stop();
    await stopPromise;
    if (audioEngine) audioEngine.stop();
  }

  const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: selectedMime || 'video/mp4' });
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
아래 지침 중 **단 1가지 핵심 주제**만 집중적으로 다루는 10컷 스토리툰 시나리오를 순수 JSON 형식으로 작성해 줘. (표지는 프로그램이 자동 생성하므로 본문 10컷만 작성하면 돼!)

[스토리 전개 원칙]
- 1~2컷: 일상 도입 / 3~4컷: 실수·위기 / 5~6컷: 연구원 박사 등장 및 원리 설명 / 7~9컷: 올바른 실천 / 10컷: 여운 및 다음 편 예고.
- 등장인물 설정: ${preset.desc}

[JSON 작성 규칙]
1. 반드시 순수 JSON 코드만 출력해.
2. "episodeTitle"에는 표지 제목 겸 파일 저장용 이름(예: "진드기_1탄_옷차림편")을 넣어 줘.
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
        { "type": "bubble", "bubbleStyle": "round", "tailDir": "left", "speaker": "", "text": "대사 내용", "fontSize": 36, "textColor": "#111827", "bgColor": "#ffffff", "x": 90, "width": 900, "tailX": 300, "tailY": 480 }
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
아래 본문 1번부터 10번까지 한 컷씩 그려줘:
=========================================\n\n`;

  const bodyCuts = appState.cuts.filter(c => !c.isCover);
  const scenes = bodyCuts.map((cut, idx) => {
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
