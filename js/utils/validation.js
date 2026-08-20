/**
 * DataForge — Validation Utilities
 * Input validation with structured error reporting
 */

/**
 * Validate an email address format.
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Check password strength.
 * Returns { valid, score (0-4), feedback[] }
 */
export function checkPasswordStrength(password) {
  const feedback = [];
  let score = 0;

  if (password.length >= 8) {
    score++;
  } else {
    feedback.push('At least 8 characters required');
  }

  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('Add a lowercase letter');
  }

  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('Add an uppercase letter');
  }

  if (/[0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('Add a number');
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score++;
  }

  return {
    valid: score >= 3 && password.length >= 8,
    score: Math.min(score, 4),
    feedback,
    label: ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][Math.min(score, 4)],
  };
}

/**
 * Validate a form data object against a set of rules.
 * 
 * Rules format:
 * {
 *   fieldName: [
 *     { type: 'required', message: '...' },
 *     { type: 'email', message: '...' },
 *     { type: 'minLength', value: 8, message: '...' },
 *     { type: 'maxLength', value: 100, message: '...' },
 *     { type: 'match', field: 'otherField', message: '...' },
 *     { type: 'pattern', value: /regex/, message: '...' },
 *     { type: 'custom', validate: (value, data) => boolean, message: '...' },
 *   ]
 * }
 * 
 * Returns { valid: boolean, errors: { fieldName: string[] } }
 */
export function validateForm(data, rules) {
  const errors = {};
  let valid = true;

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];
    const fieldErrors = [];

    for (const rule of fieldRules) {
      switch (rule.type) {
        case 'required':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            fieldErrors.push(rule.message || `${field} is required`);
          }
          break;

        case 'email':
          if (value && !isValidEmail(value)) {
            fieldErrors.push(rule.message || 'Enter a valid email address');
          }
          break;

        case 'minLength':
          if (value && value.length < rule.value) {
            fieldErrors.push(rule.message || `Must be at least ${rule.value} characters`);
          }
          break;

        case 'maxLength':
          if (value && value.length > rule.value) {
            fieldErrors.push(rule.message || `Must be no more than ${rule.value} characters`);
          }
          break;

        case 'match':
          if (value !== data[rule.field]) {
            fieldErrors.push(rule.message || `Must match ${rule.field}`);
          }
          break;

        case 'pattern':
          if (value && !rule.value.test(value)) {
            fieldErrors.push(rule.message || 'Invalid format');
          }
          break;

        case 'custom':
          if (!rule.validate(value, data)) {
            fieldErrors.push(rule.message || 'Invalid value');
          }
          break;
      }
    }

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
      valid = false;
    }
  }

  return { valid, errors };
}

/**
 * Validate that a file is an acceptable CSV.
 */
export function validateCSVFile(file) {
  const errors = [];

  if (!file) {
    return { valid: false, errors: ['No file selected'] };
  }

  const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const validExtensions = ['.csv', '.txt'];
  const maxSizeMB = 5;

  const extension = '.' + file.name.split('.').pop().toLowerCase();
  if (!validExtensions.includes(extension)) {
    errors.push('File must be a .csv file');
  }

  if (file.size === 0) {
    errors.push('File is empty');
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    errors.push(`File size exceeds ${maxSizeMB}MB limit`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate numeric input is within a range.
 */
export function validateNumericRange(value, min, max, label = 'Value') {
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, error: `${label} must be a number` };
  }
  if (num < min || num > max) {
    return { valid: false, error: `${label} must be between ${min} and ${max}` };
  }
  return { valid: true, error: null };
}
