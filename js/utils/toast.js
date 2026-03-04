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
            document.body.appendChild(this.container);
        }
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
