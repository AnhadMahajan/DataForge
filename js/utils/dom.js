/**
 * DataForge — DOM Utilities
 * Element creation, templating, event helpers
 */

/**
 * Create an element with optional classes, attributes, and children.
 * Usage: el('div', { className: 'card', id: 'main' }, [child1, child2])
 *        el('p', { textContent: 'Hello' })
 *        el('button', { className: 'btn', onClick: handler }, 'Click me')
 */
export function el(tag, props = {}, children = null) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      for (const [dKey, dVal] of Object.entries(value)) {
        element.dataset[dKey] = dVal;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      element.addEventListener(event, value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key === 'innerHTML') {
      element.innerHTML = value;
    } else if (key === 'textContent') {
      element.textContent = value;
    } else {
      element.setAttribute(key, value);
    }
  }

  if (children !== null) {
    if (typeof children === 'string') {
      element.textContent = children;
    } else if (children instanceof Node) {
      element.appendChild(children);
    } else if (Array.isArray(children)) {
      for (const child of children) {
        if (child === null || child === undefined) continue;
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          element.appendChild(child);
        }
      }
    }
  }

  return element;
}

/**
 * Shorthand for querySelector.
 */
export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Shorthand for querySelectorAll, returns array.
 */
export function qsa(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

/**
 * Delegate event handling to a parent element.
 * Listens on parent, fires handler only when target matches selector.
 */
export function delegate(parent, event, selector, handler) {
  parent.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) {
      handler(e, target);
    }
  });
}

/**
 * Remove all children from an element.
 */
export function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Append multiple children to a parent.
 */
export function appendChildren(parent, children) {
  const fragment = document.createDocumentFragment();
  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string') {
      fragment.appendChild(document.createTextNode(child));
    } else {
      fragment.appendChild(child);
    }
  }
  parent.appendChild(fragment);
}

/**
 * Show an element (remove the 'hidden' class).
 */
export function show(element) {
  element.classList.remove('hidden');
}

/**
 * Hide an element (add the 'hidden' class).
 */
export function hide(element) {
  element.classList.add('hidden');
}

/**
 * Toggle visibility of an element.
 */
export function toggle(element, force) {
  element.classList.toggle('hidden', force !== undefined ? !force : undefined);
}

/**
 * Wait for DOM content to be loaded.
 */
export function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

/**
 * Create an SVG icon element from a path string.
 * Icons use a 24x24 viewBox with stroke-based rendering.
 */
export function icon(pathData, size = 20, strokeWidth = 1.5) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (Array.isArray(pathData)) {
    for (const d of pathData) {
      if (typeof d === 'string') {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
      } else if (typeof d === 'object' && d !== null) {
        const elem = document.createElementNS('http://www.w3.org/2000/svg', d.tag || 'path');
        for (const [attr, val] of Object.entries(d)) {
          if (attr !== 'tag') elem.setAttribute(attr, val);
        }
        svg.appendChild(elem);
      }
    }
  } else if (typeof pathData === 'object' && pathData !== null) {
    const elem = document.createElementNS('http://www.w3.org/2000/svg', pathData.tag || 'path');
    for (const [attr, val] of Object.entries(pathData)) {
      if (attr !== 'tag') elem.setAttribute(attr, val);
    }
    svg.appendChild(elem);
  } else if (typeof pathData === 'string') {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
  }

  return svg;
}

/**
 * Debounce a function call.
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function call.
 */
export function throttle(fn, limit = 100) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}
