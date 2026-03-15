// dev-mode-toggle.js - 개발 모드 토글 기능
import { isDevMode, toggleDevMode, DEV_KEY_HASH, validateAndStoreDevKey } from './config/dev-config.js';

function notifyDevModeChanged() {
  window.dispatchEvent(new CustomEvent('devModeChanged', {
    detail: { enabled: isDevMode() }
  }));

  if (typeof window.updateRestrictedContent === 'function') {
    window.updateRestrictedContent();
  }
  if (typeof window.updateLoginOverlays === 'function') {
    window.updateLoginOverlays();
  }
}

function showDevKeyInput() {
  return new Promise((resolve) => {
    const existing = document.getElementById('dev-mode-key-popover');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'dev-mode-key-popover';
    wrapper.style.cssText = `
      position: fixed;
      top: 54px;
      right: 12px;
      z-index: 12000;
      min-width: 260px;
      background: rgba(15, 23, 42, 0.96);
      border: 1px solid rgba(255,255,255,0.24);
      border-radius: 10px;
      padding: 12px;
      color: #fff;
      box-shadow: 0 10px 28px rgba(0,0,0,0.3);
    `;
    wrapper.innerHTML = `
      <div style="font-size:12px; margin-bottom:8px;">개발 모드 키 입력</div>
      <input id="dev-key-input" type="password" autocomplete="off"
        style="width:100%; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff;"
        placeholder="개발 키" />
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px;">
        <button id="dev-key-cancel" type="button" style="padding:6px 10px; border-radius:6px; border:none; cursor:pointer;">취소</button>
        <button id="dev-key-save" type="button" style="padding:6px 10px; border-radius:6px; border:none; cursor:pointer; background:#22c55e; color:#052e16;">저장</button>
      </div>
    `;
    document.body.appendChild(wrapper);

    const input = wrapper.querySelector('#dev-key-input');
    const cancelBtn = wrapper.querySelector('#dev-key-cancel');
    const saveBtn = wrapper.querySelector('#dev-key-save');

    const close = (result) => {
      wrapper.remove();
      resolve(result);
    };

    cancelBtn?.addEventListener('click', () => close(false));
    saveBtn?.addEventListener('click', async () => {
      const value = (input?.value || '').trim();
      const valid = await validateAndStoreDevKey(value);
      if (!valid) {
        if (input) {
          input.value = '';
          input.placeholder = '키가 올바르지 않습니다';
          input.focus();
        }
        return;
      }
      close(true);
    });

    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        saveBtn?.click();
      } else if (event.key === 'Escape') {
        close(false);
      }
    });

    setTimeout(() => input?.focus(), 0);
  });
}

function updateDevModeUI() {
  const devModeBtn = document.getElementById('dev-mode-btn');
  if (!devModeBtn) return;

  const devKey = (localStorage.getItem('dev-mode-key') || '').trim();
  const hasValidKey = devKey === DEV_KEY_HASH;
  const enabled = isDevMode() && hasValidKey;

  if (enabled) {
    devModeBtn.classList.add('active');
    devModeBtn.setAttribute('aria-pressed', 'true');
    devModeBtn.title = '개발 모드 활성화됨 - 로그인 없이 모든 기능 사용 가능';
    return;
  }

  devModeBtn.classList.remove('active');
  devModeBtn.setAttribute('aria-pressed', 'false');
  devModeBtn.title = hasValidKey
    ? '개발 모드 비활성화됨 - 로그인 필요'
    : '개발 모드 키 입력이 필요합니다';
}

export function initDevModeToggle() {
  const devModeToggle = document.getElementById('dev-mode-toggle');
  const devModeBtn = document.getElementById('dev-mode-btn');

  if (!devModeToggle || !devModeBtn) {
    return;
  }

  const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0' ||
    window.location.hostname === '::1';

  if (!isLocalhost) {
    devModeToggle.style.display = 'none';
    devModeToggle.remove();
    return;
  }

  devModeToggle.style.display = 'block';
  devModeToggle.style.pointerEvents = 'auto';
  devModeToggle.style.position = 'relative';
  devModeToggle.style.zIndex = '1101';
  devModeBtn.style.pointerEvents = 'auto';
  devModeBtn.style.position = 'relative';
  devModeBtn.style.zIndex = '1102';
  devModeBtn.style.touchAction = 'manipulation';
  devModeBtn.type = 'button';

  updateDevModeUI();

  if (devModeBtn.dataset.devToggleBound === 'true') {
    return;
  }
  devModeBtn.dataset.devToggleBound = 'true';

  devModeBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const devKey = (localStorage.getItem('dev-mode-key') || '').trim();
    if (!devKey) {
      const keySaved = await showDevKeyInput();
      if (!keySaved) return;
      updateDevModeUI();
      notifyDevModeChanged();
      return;
    }

    const nowEnabled = toggleDevMode();
    updateDevModeUI();
    notifyDevModeChanged();

    // 개발 모드 끌 때: mock 로그인 상태 정리 + 페이지 새로고침
    if (!nowEnabled) {
      localStorage.removeItem('userLoggedIn');
      localStorage.removeItem('userName');
      window.location.reload();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDevModeToggle);
} else {
  initDevModeToggle();
}
