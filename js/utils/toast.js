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
                gap: 12px;
                padding: 14px 18px;
                border-radius: 10px;
                background: #fff;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                font-size: 14px;
                pointer-events: auto;
                opacity: 0;
                transform: translateX(40px);
                transition: opacity 0.3s, transform 0.3s;
                max-width: 380px;
                border-left: 4px solid #ccc;
            }
            .toast.show { opacity: 1; transform: translateX(0); }
            .toast.hiding { opacity: 0; transform: translateX(40px); }
            .toast-success { border-left-color: #28a745; }
            .toast-error { border-left-color: #dc3545; }
            .toast-info { border-left-color: #17a2b8; }
            .toast-warning { border-left-color: #ffc107; }
            .toast-icon { font-size: 20px; flex-shrink: 0; }
            .toast-content { flex: 1; }
            .toast-title { font-weight: 600; margin-bottom: 2px; }
            .toast-message { color: #555; line-height: 1.4; }
            .toast-close {
                cursor: pointer;
                color: #999;
                font-size: 16px;
                flex-shrink: 0;
                padding: 0 4px;
            }
            .toast-close:hover { color: #333; }
            @media (max-width: 480px) {
                .toast-container {
                    top: 10px !important;
                    right: 10px !important;
                    left: 10px !important;
                }
                .toast { max-width: 100%; }
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
