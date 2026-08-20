import { login, loginAsDemo, isLoggedIn } from '../services/auth.js';
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
const btnDemoLogin = qs('#btn-demo-login');

if (btnDemoLogin) {
  btnDemoLogin.addEventListener('click', async () => {
    btnDemoLogin.disabled = true;
    btnDemoLogin.innerHTML = '<span class="spinner"></span>';
    toast.info('Launching Demo Workspace...');
    const res = await loginAsDemo();
    if (res.success) {
      toast.success('Logged in as Demo Researcher.');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 400);
    } else {
      toast.error('Failed to launch demo session.');
      btnDemoLogin.disabled = false;
      btnDemoLogin.textContent = '⚡ Launch Demo Workspace';
    }
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
    email: emailInput.value,
    password: passwordInput.value,
  };

  const validation = validateForm(formData, validationRules);
  if (!validation.valid) {
    showFieldErrors(validation.errors);
    return;
  }

  // Disable button while processing
  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="spinner spinner-light"></span>';

  try {
    const result = await login(formData.email, formData.password);
    if (result.success) {
      toast.success('Welcome back to DataForge.');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 500);
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
