/**
 * DataForge — Signup Page Controller
 */

import { signup, isLoggedIn } from '../services/auth.js';
import { validateForm, checkPasswordStrength } from '../utils/validation.js';
import { toast } from '../components/toast.js';
import { qs, show, hide } from '../utils/dom.js';

// Redirect if already logged in
if (isLoggedIn()) {
  window.location.href = 'dashboard.html';
}

const form = qs('#signup-form');
const nameInput = qs('#name');
const emailInput = qs('#email');
const passwordInput = qs('#password');
const confirmPasswordInput = qs('#confirmPassword');

const nameError = qs('#name-error');
const emailError = qs('#email-error');
const passwordError = qs('#password-error');
const confirmError = qs('#confirm-error');

const strengthBar = qs('#password-strength');
const strengthLabel = qs('#strength-label');
const submitBtn = qs('#submit-btn');

const togglePasswordBtn = qs('#toggle-password');
const toggleConfirmBtn = qs('#toggle-confirm');

const critLength = qs('#crit-length');
const critLower = qs('#crit-lower');
const critUpper = qs('#crit-upper');
const critNumber = qs('#crit-number');

// Password Visibility Toggles
function setupPasswordToggle(button, input) {
  if (!button || !input) return;
  button.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    button.innerHTML = isPassword
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

setupPasswordToggle(togglePasswordBtn, passwordInput);
setupPasswordToggle(toggleConfirmBtn, confirmPasswordInput);

// Live password strength & criteria indicator
passwordInput.addEventListener('input', () => {
  const val = passwordInput.value;
  if (!val) {
    strengthBar.dataset.score = '0';
    strengthLabel.textContent = 'Password strength';
    if (critLength) critLength.classList.remove('met');
    if (critLower) critLower.classList.remove('met');
    if (critUpper) critUpper.classList.remove('met');
    if (critNumber) critNumber.classList.remove('met');
    return;
  }

  // Update criteria checklist
  if (critLength) critLength.classList.toggle('met', val.length >= 8);
  if (critLower) critLower.classList.toggle('met', /[a-z]/.test(val));
  if (critUpper) critUpper.classList.toggle('met', /[A-Z]/.test(val));
  if (critNumber) critNumber.classList.toggle('met', /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(val));

  const res = checkPasswordStrength(val);
  strengthBar.dataset.score = String(res.score);
  strengthLabel.textContent = `${res.label}${res.feedback.length > 0 ? ' — ' + res.feedback[0] : ''}`;
});

function clearErrors() {
  [nameError, emailError, passwordError, confirmError].forEach(el => {
    if (el) {
      hide(el);
      el.textContent = '';
    }
  });
  [nameInput, emailInput, passwordInput, confirmPasswordInput].forEach(el => {
    if (el) el.classList.remove('input-error');
  });
}

function showErrors(errors) {
  if (errors.name && errors.name.length > 0) {
    nameError.textContent = errors.name[0];
    show(nameError);
    nameInput.classList.add('input-error');
  }
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
  if (errors.confirmPassword && errors.confirmPassword.length > 0) {
    confirmError.textContent = errors.confirmPassword[0];
    show(confirmError);
    confirmPasswordInput.classList.add('input-error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const formData = {
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value,
    confirmPassword: confirmPasswordInput.value,
  };

  const validationRules = {
    name: [
      { type: 'required', message: 'Name is required' },
      { type: 'minLength', value: 2, message: 'Name must be at least 2 characters' },
    ],
    email: [
      { type: 'required', message: 'Email is required' },
      { type: 'email', message: 'Please enter a valid email address' },
    ],
    password: [
      { type: 'required', message: 'Password is required' },
      { type: 'minLength', value: 8, message: 'Password must be at least 8 characters' },
    ],
    confirmPassword: [
      { type: 'required', message: 'Please confirm your password' },
      { type: 'match', field: 'password', message: 'Passwords do not match' },
    ],
  };

  const validation = validateForm(formData, validationRules);
  if (!validation.valid) {
    showErrors(validation.errors);
    return;
  }

  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="spinner spinner-light"></span> <span>Creating account...</span>';

  try {
    const result = await signup(formData.name, formData.email, formData.password);
    if (result.success) {
      toast.success('Researcher account created successfully.');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 400);
    } else {
      toast.error(result.error.message || 'Registration failed.');
      if (result.error.code === 'EMAIL_EXISTS') {
        emailInput.classList.add('input-error');
        emailError.textContent = result.error.message;
        show(emailError);
      }
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  } catch (err) {
    toast.error('An unexpected error occurred during signup.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});
