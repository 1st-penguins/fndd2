/**
 * 🍞 Toast Notification Utility
 * Replaces native alerts with a premium notification system.
 */

class ToastSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        if (document.querySelector('.toast-container')) {
            this.container = document.querySelector('.toast-container');
        } else {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 100000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            this._injectStyles();
            document.body.appendChild(this.container);
        }
    }

    _injectStyles() {
        if (document.getElementById('toast-styles')) return;
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 16px 20px;
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
                font-size: 14px;
                pointer-events: auto;
                opacity: 0;
                transform: translateY(-12px) scale(0.97);
                transition: opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1);
                max-width: 380px;
                border: 1px solid rgba(0,0,0,0.06);
            }
            .toast.show { opacity: 1; transform: translateY(0) scale(1); }
            .toast.hiding { opacity: 0; transform: translateY(-12px) scale(0.97); }
            .toast-success { border-color: rgba(40,167,69,0.2); }
            .toast-error { border-color: rgba(220,53,69,0.2); }
            .toast-info { border-color: rgba(23,162,184,0.2); }
            .toast-warning { border-color: rgba(255,193,7,0.2); }
            .toast-icon { font-size: 20px; flex-shrink: 0; }
            .toast-content { flex: 1; }
            .toast-title { font-weight: 600; margin-bottom: 3px; color: #1D2F4E; font-size: 14px; }
            .toast-message { color: #6b7280; line-height: 1.5; font-size: 13px; }
            .toast-close {
                cursor: pointer;
                color: #9ca3af;
                font-size: 15px;
                flex-shrink: 0;
                padding: 2px 4px;
                border-radius: 8px;
                transition: background 0.2s, color 0.2s;
            }
            .toast-close:hover { background: rgba(0,0,0,0.05); color: #374151; }
            @media (max-width: 480px) {
                .toast-container {
                    top: 12px !important;
                    right: 12px !important;
                    left: 12px !important;
                }
                .toast { max-width: 100%; border-radius: 14px; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show a toast message
     * @param {string} type - 'success', 'error', 'info', 'warning'
     * @param {string} message - The message body
     * @param {string} [title] - Optional title
     * @param {number} [duration=3000] - Auto-close duration in ms
     */
    show(type, message, title = '', duration = 3000) {
        if (!this.container) this.init();

        // Default titles
        if (!title) {
            const titles = {
                success: '성공',
                error: '오류',
                info: '알림',
                warning: '주의'
            };
            title = titles[type] || '알림';
        }

        // Icons
        const icons = {
            success: '✅',
            error: '⚠️',
            info: 'ℹ️',
            warning: '🔔'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <div class="toast-close" onclick="this.parentElement.remove()">✕</div>
    `;

        this.container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(toast);
            }, duration);
        }

        return toast;
    }

    dismiss(toast) {
        toast.classList.remove('show');
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300); // Match CSS transition
    }

    success(message, title, duration) {
        return this.show('success', message, title, duration);
    }

    error(message, title, duration) {
        return this.show('error', message, title, duration);
    }

    info(message, title, duration) {
        return this.show('info', message, title, duration);
    }

    warning(message, title, duration) {
        return this.show('warning', message, title, duration);
    }
}

// Export singleton
export const Toast = new ToastSystem();

// Optional: Overlay native alert for debugging or quick migration (use with caution)
// window.alert = (msg) => Toast.info(msg);
