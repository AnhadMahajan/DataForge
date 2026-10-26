import { login, isLoggedIn } from '../services/auth.js';
import { validateForm } from '../utils/validation.js';
import { toast } from '../components/toast.js';
import { qs, show, hide } from '../utils/dom.js';

// Redirect if already logged in
if (isLoggedIn()) {
  window.location.href = 'dashboard.html';
}

const form = qs('#login-form');
const emailInput = qs('#email');
const passwordInput = qs('#password');
const emailError = qs('#email-error');
const passwordError = qs('#password-error');
const submitBtn = qs('#submit-btn');
const togglePasswordBtn = qs('#toggle-password');

// Password Visibility Toggle
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePasswordBtn.innerHTML = isPassword
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>`;
  });
}

const validationRules = {
  email: [
    { type: 'required', message: 'Email is required' },
    { type: 'email', message: 'Please enter a valid email address' },
  ],
  password: [
    { type: 'required', message: 'Password is required' },
  ],
};

function clearErrors() {
  hide(emailError);
  hide(passwordError);
  emailInput.classList.remove('input-error');
  passwordInput.classList.remove('input-error');
  emailError.textContent = '';
  passwordError.textContent = '';
}

function showFieldErrors(errors) {
  if (errors.email && errors.email.length > 0) {
    emailError.textContent = errors.email[0];
    show(emailError);
    emailInput.classList.add('input-error');
  }
  if (errors.password && errors.password.length > 0) {
    passwordError.textContent = errors.password[0];
    show(passwordError);
    passwordInput.classList.add('input-error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const formData = {
    email: emailInput.value.trim(),
    password: passwordInput.value,
  };

  const validation = validateForm(formData, validationRules);
  if (!validation.valid) {
    showFieldErrors(validation.errors);
    return;
  }

  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="spinner spinner-light"></span> <span>Authenticating...</span>';

  try {
    const result = await login(formData.email, formData.password);
    if (result.success) {
      toast.success('Welcome back to DataForge.');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 400);
    } else {
      toast.error(result.error.message || 'Login failed. Please check credentials.');
      passwordInput.classList.add('input-error');
      passwordError.textContent = result.error.message;
      show(passwordError);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  } catch (err) {
    toast.error('An unexpected error occurred during login.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});
