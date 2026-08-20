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

// Live password strength indicator
passwordInput.addEventListener('input', () => {
  const val = passwordInput.value;
  if (!val) {
    strengthBar.dataset.score = '0';
    strengthLabel.textContent = 'Password strength';
    return;
  }
  const res = checkPasswordStrength(val);
  strengthBar.dataset.score = String(res.score);
  strengthLabel.textContent = `${res.label}${res.feedback.length > 0 ? ' — ' + res.feedback[0] : ''}`;
});

function clearErrors() {
  [nameError, emailError, passwordError, confirmError].forEach(el => {
    hide(el);
    el.textContent = '';
  });
  [nameInput, emailInput, passwordInput, confirmPasswordInput].forEach(el => {
    el.classList.remove('input-error');
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
    name: nameInput.value,
    email: emailInput.value,
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
  submitBtn.innerHTML = '<span class="spinner spinner-light"></span>';

  try {
    const result = await signup(formData.name, formData.email, formData.password);
    if (result.success) {
      toast.success('Account created successfully.');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 500);
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
