// Linear Design System - Homepage Integration
// 기존 기능들을 새로운 Linear 디자인 시스템과 통합

class LinearHomePage {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupTabHandlers();
    this.setupRestrictedContent();
    this.setupLoginIntegration();
  }

  setupEventListeners() {
    // Hero section actions
    document.querySelector('[data-action="start-learning"]')?.addEventListener('click', () => {
      this.switchToTab('quiz-tab');
    });

    document.querySelector('[data-action="learn-more"]')?.addEventListener('click', () => {
      this.scrollToSection('main-content');
    });

    // Navigation links
    document.querySelectorAll('.linear-navigation__link').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href?.startsWith('#')) {
          e.preventDefault();
          this.handleNavigationClick(href);
        }
      });
    });

    // Restricted links
    document.querySelectorAll('.restricted-link').forEach(link => {
      link.addEventListener('click', (e) => {
        if (!this.isUserLoggedIn()) {
          e.preventDefault();
          this.showLoginRequired();
        }
      });
    });
  }

  setupTabHandlers() {
    // Main tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        if (tabId) {
          this.switchTab(tabId);
        }
      });
    });

    // Sub tab navigation
    document.querySelectorAll('.sub-tab-button').forEach(button => {
      button.addEventListener('click', () => {
        const subtabId = button.getAttribute('data-subtab');
        if (subtabId) {
          this.switchSubTab(subtabId);
        }
      });
    });
  }

  setupRestrictedContent() {
    // Show/hide login overlay based on authentication status
    this.updateRestrictedContentVisibility();
    
    // Listen for auth state changes
    if (typeof window.authStateChanged === 'function') {
      window.authStateChanged = this.updateRestrictedContentVisibility.bind(this);
    }
  }

  setupLoginIntegration() {
    // Integrate with existing login system
    if (typeof window.showLoginModal === 'function') {
      // Make showLoginModal globally available
      window.showLoginModal = window.showLoginModal;
    }

    // Update UI based on login status
    this.updateAuthUI();
  }

  // Tab Management
  switchTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });

    // Show selected tab content
    const targetContent = document.getElementById(tabId);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    // Add active class to clicked button
    const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }

    // Update URL hash
    window.history.pushState(null, null, `#${tabId}`);
  }

  switchSubTab(subtabId) {
    // Hide all sub tab contents
    document.querySelectorAll('.sub-tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // Remove active class from all sub tab buttons
    document.querySelectorAll('.sub-tab-button').forEach(button => {
      button.classList.remove('active');
    });

    // Show selected sub tab content
    const targetContent = document.getElementById(subtabId);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    // Add active class to clicked button
    const activeButton = document.querySelector(`[data-subtab="${subtabId}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
  }

  // Navigation
  handleNavigationClick(href) {
    switch (href) {
      case '#home':
        this.scrollToSection('hero-section');
        break;
      case '#quiz':
        this.switchToTab('quiz-tab');
        break;
      case '#lecture':
        this.switchToTab('lecture-tab');
        break;
      case '#analytics':
        if (typeof window.goToAnalytics === 'function') {
          window.goToAnalytics();
        }
        break;
      default:
        console.log('Navigation to:', href);
    }
  }

  switchToTab(tabId) {
    // First switch to quiz tab if needed
    if (tabId.includes('quiz')) {
      this.switchTab('quiz-tab');
      
      // Then switch to specific sub-tab if provided
      const subtabId = tabId.replace('quiz-', '').replace('-tab', '-view');
      if (subtabId !== 'tab') {
        setTimeout(() => this.switchSubTab(subtabId), 100);
      }
    } else {
      this.switchTab(tabId);
    }

    // Scroll to main content
    this.scrollToSection('main-content');
  }

  scrollToSection(sectionId) {
    const section = document.querySelector(`.${sectionId}`) || document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  // Authentication Integration
  isUserLoggedIn() {
    // Integrate with existing auth system
    if (typeof window.getCurrentUser === 'function') {
      return window.getCurrentUser() !== null;
    }
    
    // Fallback: check if user profile is visible
    const userProfile = document.getElementById('user-profile-container');
    return userProfile && userProfile.style.display !== 'none';
  }

  updateRestrictedContentVisibility() {
    const isLoggedIn = this.isUserLoggedIn();
    const restrictedContents = document.querySelectorAll('.restricted-content');
    const loginOverlays = document.querySelectorAll('.login-required-overlay');

    restrictedContents.forEach(content => {
      if (isLoggedIn) {
        content.classList.remove('restricted-content');
      } else {
        content.classList.add('restricted-content');
      }
    });

    loginOverlays.forEach(overlay => {
      overlay.style.display = isLoggedIn ? 'none' : 'block';
    });
  }

  updateAuthUI() {
    const isLoggedIn = this.isUserLoggedIn();
    const loginButton = document.getElementById('login-button-container');
    const userProfile = document.getElementById('user-profile-container');

    if (loginButton) {
      loginButton.style.display = isLoggedIn ? 'none' : 'block';
    }

    if (userProfile) {
      userProfile.style.display = isLoggedIn ? 'block' : 'none';
    }
  }

  showLoginRequired() {
    // Show login modal or scroll to login section
    if (typeof window.showLoginModal === 'function') {
      window.showLoginModal();
    } else {
      // Fallback: scroll to login button
      const loginButton = document.querySelector('[data-action="show-login"]');
      if (loginButton) {
        loginButton.scrollIntoView({ behavior: 'smooth' });
        loginButton.focus();
      }
    }
  }

  // Preview Content (for non-logged-in users)
  showPreviewContent() {
    // Create preview modal or show sample content
    this.createPreviewModal();
  }

  createPreviewModal() {
    // Create a simple preview modal
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
      <div class="preview-modal-content">
        <h3 class="linear-typography linear-typography--h3">미리보기</h3>
        <p class="linear-typography linear-typography--body linear-typography--secondary">
          실제 문제를 풀어보려면 로그인이 필요합니다.
        </p>
        <div class="preview-actions">
          <button class="linear-button linear-button--primary" onclick="window.showLoginModal()">
            로그인 / 회원가입
          </button>
          <button class="linear-button linear-button--outline" onclick="this.closest('.preview-modal').remove()">
            닫기
          </button>
        </div>
      </div>
    `;

    // Add modal styles
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.querySelector('.preview-modal-content').style.cssText = `
      background: var(--color-bg-level-1);
      padding: 32px;
      border-radius: 16px;
      border: 1px solid var(--color-border-primary);
      max-width: 400px;
      width: 90%;
      text-align: center;
    `;

    modal.querySelector('.preview-actions').style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 24px;
    `;

    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // URL Hash Handling
  handleInitialHash() {
    const hash = window.location.hash;
    if (hash) {
      const tabId = hash.replace('#', '');
      if (tabId) {
        this.switchToTab(tabId);
      }
    }
  }

  // Initialize on page load
  static init() {
    const homePage = new LinearHomePage();
    
    // Handle initial URL hash
    homePage.handleInitialHash();
    
    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      homePage.handleInitialHash();
    });

    // Make instance available globally
    window.linearHomePage = homePage;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  LinearHomePage.init();
});

// Make functions available globally for backward compatibility
window.showPreviewContent = () => {
  if (window.linearHomePage) {
    window.linearHomePage.showPreviewContent();
  }
};

window.switchToTab = (tabId) => {
  if (window.linearHomePage) {
    window.linearHomePage.switchToTab(tabId);
  }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LinearHomePage;
}
