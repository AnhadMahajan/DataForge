/**
 * DataForge — Landing Page Controller
 */

import { isLoggedIn } from '../services/auth.js';
import { qs } from '../utils/dom.js';

// If user is already logged in, update CTA buttons to "Open Dashboard"
if (isLoggedIn()) {
  const ctaBtn = qs('#nav-cta-btn');
  const loginLink = qs('#nav-login-link');
  if (ctaBtn) {
    ctaBtn.textContent = 'Dashboard';
    ctaBtn.href = 'dashboard.html';
  }
  if (loginLink) {
    loginLink.textContent = 'Dashboard';
    loginLink.href = 'dashboard.html';
  }
}

// Sticky nav backdrop blur on scroll
const nav = qs('#main-nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });
