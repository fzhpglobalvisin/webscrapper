// services/voiceClickEngine.ts — Universal Voice Click Engine & Intent Mapper
// Listens for voice commands to click, navigate, or trigger ANY element across the main application AND inside the web link / iFrame view.

export interface VoiceClickTarget {
  selector?: string;
  textMatch?: string;
  elementDescription?: string;
  target?: 'app' | 'iframe' | 'any';
  actionType?: 'click' | 'focus' | 'hover' | 'scroll_to';
}

export interface VoiceClickResult {
  success: boolean;
  target: 'app' | 'iframe' | 'none';
  matchedTag?: string;
  matchedText?: string;
  message: string;
}

export interface VoiceInputTarget {
  selectorOrPlaceholder: string;
  text: string;
  target?: 'app' | 'iframe' | 'any';
  submit?: boolean;
}

// ─── Visual Confirmation Pulse on Triggered Elements ──────────────────
export function highlightTriggeredElement(el: HTMLElement, isIframe = false) {
  try {
    const originalOutline = el.style.outline;
    const originalTransition = el.style.transition;
    const originalBoxShadow = el.style.boxShadow;

    el.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    el.style.outline = '3px solid #6366f1';
    el.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.6)';

    // Add temporary voice badge indicator
    const badge = document.createElement('span');
    badge.className = 'voice-action-badge';
    badge.textContent = isIframe ? '🎙️ Voice Clicked (iFrame)' : '🎙️ Voice Triggered';
    badge.style.position = 'absolute';
    badge.style.top = '-24px';
    badge.style.left = '0';
    badge.style.backgroundColor = '#4f46e5';
    badge.style.color = '#ffffff';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = 'bold';
    badge.style.padding = '2px 8px';
    badge.style.borderRadius = '9999px';
    badge.style.zIndex = '99999';
    badge.style.pointerEvents = 'none';
    badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

    const parent = el.offsetParent || el.parentElement || document.body;
    if (getComputedStyle(parent).position === 'static') {
      (parent as HTMLElement).style.position = 'relative';
    }
    el.parentElement?.appendChild(badge);

    setTimeout(() => {
      el.style.outline = originalOutline;
      el.style.boxShadow = originalBoxShadow;
      el.style.transition = originalTransition;
      badge.remove();
    }, 2200);
  } catch (err) {
    // Non-blocking visual aid
  }
}

// ─── Helper: Search DOM for Best Interactive Element Match ───────────
function findInteractiveElement(
  doc: Document,
  params: { selector?: string; textMatch?: string; elementDescription?: string }
): HTMLElement | null {
  const { selector, textMatch, elementDescription } = params;

  // 1. If explicit valid selector provided, try querySelector directly
  if (selector) {
    try {
      const el = doc.querySelector(selector);
      if (el instanceof HTMLElement) return el;
    } catch {
      // invalid selector syntax, proceed to semantic search
    }
  }

  const queryTerms: string[] = [];
  if (textMatch) queryTerms.push(textMatch.trim().toLowerCase());
  if (elementDescription) queryTerms.push(elementDescription.trim().toLowerCase());

  if (queryTerms.length === 0) return null;

  // Candidate interactive tags
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      'button, a, input, select, textarea, [role="button"], [role="tab"], summary, [data-action], [data-voice-target], [data-faq-id], [data-tab-id], .interactive-card, [id]'
    )
  );

  // Score candidates
  let bestMatch: HTMLElement | null = null;
  let highestScore = 0;

  for (const el of candidates) {
    // Check if element is visible
    const rect = el.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;
    if (!isVisible) continue;

    const text = (el.innerText || el.textContent || '').trim().toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const name = (el.getAttribute('name') || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const dataAction = (el.getAttribute('data-action') || '').toLowerCase();
    const dataTarget = (el.getAttribute('data-voice-target') || '').toLowerCase();

    for (const term of queryTerms) {
      // Exact match gets highest score
      if (text === term || ariaLabel === term || id === term || dataAction === term || dataTarget === term) {
        return el;
      }

      // Strong partial match
      let score = 0;
      if (text.includes(term)) score += 50;
      if (ariaLabel.includes(term)) score += 40;
      if (dataAction.includes(term) || dataTarget.includes(term)) score += 45;
      if (placeholder.includes(term)) score += 35;
      if (id.includes(term)) score += 30;
      if (title.includes(term)) score += 20;
      if (name.includes(term)) score += 20;

      // Word boundary match
      const words = term.split(/\s+/).filter(w => w.length > 2);
      for (const w of words) {
        if (text.includes(w)) score += 15;
        if (ariaLabel.includes(w)) score += 10;
        if (id.includes(w)) score += 10;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = el;
      }
    }
  }

  // If score is reasonable (> 25), accept match
  if (highestScore >= 25 && bestMatch) {
    return bestMatch;
  }

  // Broad fallback: any clickable element containing the term
  for (const term of queryTerms) {
    const allElements = Array.from(doc.querySelectorAll<HTMLElement>('*'));
    for (const el of allElements) {
      if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'HEAD'].includes(el.tagName)) continue;
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (t.length < 120 && t.includes(term)) {
        // Prefer childmost element
        if (el.children.length === 0 || el.tagName === 'BUTTON' || el.tagName === 'A') {
          return el;
        }
      }
    }
  }

  return null;
}

// ─── Execute Click Across Main App and Embedded iFrame ────────────────
export function executeVoiceClick(target: VoiceClickTarget): VoiceClickResult {
  const {
    selector,
    textMatch,
    elementDescription,
    target: targetScope = 'any',
    actionType = 'click'
  } = target;

  const searchParams = { selector, textMatch, elementDescription };

  // 1. Try Main App DOM (if target is 'app' or 'any')
  if (targetScope === 'app' || targetScope === 'any') {
    const appElement = findInteractiveElement(document, searchParams);
    if (appElement) {
      appElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightTriggeredElement(appElement, false);

      if (actionType === 'focus') {
        appElement.focus();
      } else {
        // Dispatch full synthetic click sequence
        appElement.focus();
        appElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        appElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        appElement.click();
      }

      const desc = (appElement.innerText || appElement.getAttribute('aria-label') || appElement.id || 'element').slice(0, 40);
      return {
        success: true,
        target: 'app',
        matchedTag: appElement.tagName,
        matchedText: desc,
        message: `Successfully triggered "${desc}" in application.`
      };
    }
  }

  // 2. Try Embedded iFrame DOM (if target is 'iframe' or 'any')
  if (targetScope === 'iframe' || targetScope === 'any') {
    // Find candidate iframes (e.g. #real-estate-web-iframe or any iframe in web navigator)
    const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeElement = findInteractiveElement(iframeDoc, searchParams);
          if (iframeElement) {
            iframeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlightTriggeredElement(iframeElement, true);

            if (actionType === 'focus') {
              iframeElement.focus();
            } else {
              iframeElement.focus();
              iframeElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              iframeElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
              iframeElement.click();
            }

            const desc = (iframeElement.innerText || iframeElement.getAttribute('aria-label') || iframeElement.id || 'web element').slice(0, 40);
            return {
              success: true,
              target: 'iframe',
              matchedTag: iframeElement.tagName,
              matchedText: desc,
              message: `Successfully clicked "${desc}" inside embedded web view.`
            };
          }
        }
      } catch (err) {
        // Cross-origin restriction if external without proxy, attempt postMessage
        try {
          iframe.contentWindow?.postMessage({
            type: 'VOICE_CLICK_COMMAND',
            selector,
            textMatch: textMatch || elementDescription
          }, '*');
        } catch {}
      }
    }
  }

  return {
    success: false,
    target: 'none',
    message: `Could not locate interactive element matching "${textMatch || elementDescription || selector}".`
  };
}

// ─── Execute Text Input Across Main App and Embedded iFrame ────────────
export function executeVoiceInput(target: VoiceInputTarget): VoiceClickResult {
  const { selectorOrPlaceholder, text, target: targetScope = 'any', submit = false } = target;

  const findInput = (doc: Document): HTMLInputElement | HTMLTextAreaElement | null => {
    // Try selector
    try {
      const el = doc.querySelector(selectorOrPlaceholder);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el;
    } catch {}

    // Try placeholder, aria-label, name, or id
    const lower = selectorOrPlaceholder.toLowerCase();
    const inputs = Array.from(doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'));
    for (const input of inputs) {
      const p = (input.placeholder || '').toLowerCase();
      const a = (input.getAttribute('aria-label') || '').toLowerCase();
      const n = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      if (p.includes(lower) || a.includes(lower) || n.includes(lower) || id.includes(lower)) {
        return input;
      }
    }

    // Fallback: activeElement or first visible text input
    for (const input of inputs) {
      if (['text', 'search', 'url', 'email', ''].includes(input.type)) {
        return input;
      }
    }
    return null;
  };

  // 1. App
  if (targetScope === 'app' || targetScope === 'any') {
    const inputEl = findInput(document);
    if (inputEl) {
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightTriggeredElement(inputEl, false);
      inputEl.focus();
      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));

      if (submit) {
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        const form = inputEl.form;
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }

      return {
        success: true,
        target: 'app',
        matchedTag: inputEl.tagName,
        matchedText: text,
        message: `Entered "${text}" into input field.`
      };
    }
  }

  // 2. iFrame
  if (targetScope === 'iframe' || targetScope === 'any') {
    const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const inputEl = findInput(iframeDoc);
          if (inputEl) {
            inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlightTriggeredElement(inputEl, true);
            inputEl.focus();
            inputEl.value = text;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));

            if (submit) {
              inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
              const form = inputEl.form;
              if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              }
            }

            return {
              success: true,
              target: 'iframe',
              matchedTag: inputEl.tagName,
              matchedText: text,
              message: `Entered "${text}" into embedded web view input field.`
            };
          }
        }
      } catch {}
    }
  }

  return {
    success: false,
    target: 'none',
    message: `Could not locate input field matching "${selectorOrPlaceholder}".`
  };
}

// ─── Universal Scroll Voice Controller ────────────────────────────────
export function executeVoiceScroll(direction: 'up' | 'down' | 'top' | 'bottom', targetScope: 'app' | 'iframe' | 'any' = 'any') {
  const scrollAmt = 500;

  if (targetScope === 'app' || targetScope === 'any') {
    if (direction === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (direction === 'bottom') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else if (direction === 'up') {
      window.scrollBy({ top: -scrollAmt, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: scrollAmt, behavior: 'smooth' });
    }
  }

  if (targetScope === 'iframe' || targetScope === 'any') {
    const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
    for (const iframe of iframes) {
      try {
        const iframeWin = iframe.contentWindow;
        if (iframeWin) {
          if (direction === 'top') {
            iframeWin.scrollTo({ top: 0, behavior: 'smooth' });
          } else if (direction === 'bottom') {
            iframeWin.scrollTo({ top: iframeWin.document.body.scrollHeight, behavior: 'smooth' });
          } else if (direction === 'up') {
            iframeWin.scrollBy({ top: -scrollAmt, behavior: 'smooth' });
          } else {
            iframeWin.scrollBy({ top: scrollAmt, behavior: 'smooth' });
          }
        }
      } catch {}
    }
  }
}
