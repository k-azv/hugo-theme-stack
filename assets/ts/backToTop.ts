// Back to top button functionality

// Inspired from https://gomakethings.com/debouncing-your-javascript-events/
function debounced(func: Function) {
    let timeout: number;
    return () => {
        if (timeout) {
            window.cancelAnimationFrame(timeout);
        }

        timeout = window.requestAnimationFrame(() => func());
    }
}

class BackToTop {
    private button: HTMLElement;
    private threshold = 500;
    private scrollingToTop = false;

    constructor(buttonEl: HTMLElement) {
        if (!buttonEl) return;

        this.button = buttonEl;
        this.bindEvents();
    }

    private bindEvents() {
        window.addEventListener('scroll', debounced(() => this.toggleVisibility()));
        this.button.addEventListener('click', () => this.scrollToTop());
    }

    private toggleVisibility() {
        const scrolled = window.scrollY > this.threshold;
        this.button.classList.toggle('visible', scrolled);
    }

    private scrollToTop() {
        this.scrollingToTop = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Monitor scroll position during smooth scroll
        const checkScroll = () => {
            if (!this.scrollingToTop) return;

            if (window.scrollY <= this.threshold) {
                this.button.classList.remove('visible');
                this.scrollingToTop = false;
            } else {
                requestAnimationFrame(checkScroll);
            }
        };

        requestAnimationFrame(checkScroll);
    }
}

export default BackToTop;
