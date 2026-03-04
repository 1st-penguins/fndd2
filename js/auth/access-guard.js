import { resolveAuthState, isRestrictedTab, getTabRestrictionMessage } from "./access-policy.js";

function openLoginEntry() {
  if (typeof window.lazyAuthAndShowLoginModal === "function") {
    window.lazyAuthAndShowLoginModal();
    return;
  }

  if (typeof window.showLoginModal === "function") {
    window.showLoginModal();
    return;
  }

  if (!window.location.pathname.includes("login.html")) {
    window.location.href = "login.html";
  }
}

export function canAccessRestrictedContent() {
  return resolveAuthState();
}

export function requestLogin(reasonMessage = "") {
  if (reasonMessage) {
    console.info(reasonMessage);
  }
  openLoginEntry();
}

export function guardTabAccess(tabId) {
  if (!isRestrictedTab(tabId)) return true;
  if (canAccessRestrictedContent()) return true;

  requestLogin(getTabRestrictionMessage(tabId));
  return false;
}

export function syncLoginOverlays(root = document) {
  const isLoggedIn = canAccessRestrictedContent();
  const overlays = root.querySelectorAll(".login-required-overlay");

  root.body?.classList.toggle("logged-in", isLoggedIn);

  overlays.forEach((overlay) => {
    overlay.style.display = isLoggedIn ? "none" : "flex";
    overlay.style.visibility = isLoggedIn ? "hidden" : "visible";
    overlay.style.opacity = isLoggedIn ? "0" : "1";
    overlay.style.pointerEvents = isLoggedIn ? "none" : "auto";
  });
}

export function setupRestrictedLinkDelegation(root = document) {
  if (root.body?.dataset.restrictedLinkBound === "true") return;
  if (!root.body) return;

  root.body.dataset.restrictedLinkBound = "true";

  root.body.addEventListener("click", (event) => {
    const target = event.target.closest(".restricted-link");
    if (!target) return;

    if (!canAccessRestrictedContent()) {
      event.preventDefault();
      event.stopPropagation();
      requestLogin("로그인 후 이용할 수 있는 콘텐츠입니다.");
      return;
    }

    const href = target.getAttribute("data-href");
    const isAnchor = target.tagName.toLowerCase() === "a";
    if (href && !isAnchor) {
      event.preventDefault();
      window.location.href = href;
    }
  }, true);
}

export function navigateWithAccessGuard(url) {
  if (canAccessRestrictedContent()) {
    window.location.href = url;
    return true;
  }

  requestLogin("로그인 후 이동할 수 있습니다.");
  return false;
}

