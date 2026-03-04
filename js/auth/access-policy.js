import { isDevMode } from "../config/dev-config.js";

const RESTRICTED_TABS = new Set(["subject-tab", "year-tab"]);

const TAB_MESSAGES = {
  "subject-tab": "과목별 목차 기능은 로그인 후 이용할 수 있습니다.",
  "year-tab": "연도별 목차 기능은 로그인 후 이용할 수 있습니다."
};

export function resolveAuthState() {
  if (isDevMode()) return true;

  try {
    const userProfile = document.getElementById("user-profile-container");
    if (userProfile && userProfile.style.display !== "none") {
      return true;
    }

    if (typeof window.isUserLoggedIn === "function" && window.isUserLoggedIn()) {
      return true;
    }

    if (window.auth && window.auth.currentUser) {
      localStorage.setItem("userLoggedIn", "true");
      return true;
    }

    if (window.__lastAuthState === true) {
      return true;
    }

    return localStorage.getItem("userLoggedIn") === "true";
  } catch (error) {
    console.warn("인증 상태 확인 중 오류:", error);
    return false;
  }
}

export function isRestrictedTab(tabId) {
  return RESTRICTED_TABS.has(tabId);
}

export function getTabRestrictionMessage(tabId) {
  return TAB_MESSAGES[tabId] || "이 기능은 로그인 후 이용할 수 있습니다.";
}

