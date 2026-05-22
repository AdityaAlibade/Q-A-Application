/**
 * OmniQA - Front-end Application Logic
 * Implements chat bubbles, state tracking, markdown parsing, XSS protection, and API proxy queries.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  let chatHistory = [];
  let isSubmitting = false;

  // ==========================================================================
  // DOM ELEMENT CACHE
  // ==========================================================================
  const htmlElement = document.documentElement;
  const themeToggleBtn = document.getElementById('theme-toggle');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const charCounter = document.getElementById('char-counter');
  const sendBtn = document.getElementById('send-btn');
  const chatMessages = document.getElementById('chat-messages');
  const emptyState = document.getElementById('chat-empty-state');
  const clearChatBtn = document.getElementById('clear-chat');
  const systemStatus = document.getElementById('system-status');
  const toastContainer = document.getElementById('toast-container');
  
  // Mobile drawer elements
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileMenuClose = document.getElementById('mobile-menu-close');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerLinks = document.querySelectorAll('.drawer-link');
  const navLinks = document.querySelectorAll('.nav-link');

  // ==========================================================================
  // THEME MANAGEMENT (LIGHT / DARK)
  // ==========================================================================
  const savedTheme = localStorage.getItem('theme') || 'dark';
  htmlElement.setAttribute('data-theme', savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'success');
  });

  // ==========================================================================
  // MOBILE NAVIGATION DRAWER
  // ==========================================================================
  const toggleDrawer = (open) => {
    if (open) {
      mobileDrawer.classList.add('open');
      drawerOverlay.classList.add('open');
      document.body.style.overflow = 'hidden'; // Stop page scrolling under menu
    } else {
      mobileDrawer.classList.remove('open');
      drawerOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  mobileMenuToggle.addEventListener('click', () => toggleDrawer(true));
  mobileMenuClose.addEventListener('click', () => toggleDrawer(false));
  drawerOverlay.addEventListener('click', () => toggleDrawer(false));

  // Close drawer and navigate smoothly on link click
  drawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      toggleDrawer(false);
    });
  });

  // Smooth scroll active nav link tracking
  window.addEventListener('scroll', () => {
    let currentSection = 'hero';
    const sections = ['hero', 'chat-section', 'features'];
    const scrollPos = window.scrollY + 200;

    sections.forEach(secId => {
      const el = document.getElementById(secId);
      if (el && scrollPos >= el.offsetTop) {
        currentSection = secId;
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentSection}`) {
        link.classList.add('active');
      }
    });
  });

  // ==========================================================================
  // TOAST NOTIFICATIONS ENGINE
  // ==========================================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Choose icon based on toast level
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-triangle-exclamation';
    if (type === 'warning') iconClass = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span class="toast-message"></span>
      <i class="fa-solid fa-xmark toast-close"></i>
    `;
    
    // XSS mitigation for arbitrary messages
    toast.querySelector('.toast-message').textContent = message;

    // Toast event listeners
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    });

    toastContainer.appendChild(toast);

    // Auto dismiss after 4.5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, 4500);
  }

  // ==========================================================================
  // TEXTAREA AUTO-RESIZE & COUNTER
  // ==========================================================================
  chatInput.addEventListener('input', () => {
    // Dynamic Height calculation
    chatInput.style.height = 'auto';
    chatInput.style.height = `${chatInput.scrollHeight}px`;

    // Character limit tracking
    const textLength = chatInput.value.length;
    charCounter.textContent = `${textLength} / 4000`;
  });

  // Submit on enter (Shift+Enter for newline)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // ==========================================================================
  // CHAT INTERACTIONS & SECURITY SANITATION
  // ==========================================================================
  
  // Safe Markdown Formatter (immunizes script execution by escaping HTML tags)
  function formatMarkdown(text) {
    // 1. Escape HTML completely to prevent XSS
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Extract code blocks: ```lang ... ```
    const codeBlocks = [];
    escaped = escaped.replace(/```([\s\S]*?)```/g, (match, code) => {
      const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
      codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
      return placeholder;
    });

    // 3. Extract inline code: `code`
    const inlineCodes = [];
    escaped = escaped.replace(/`([^`]+)`/g, (match, code) => {
      const placeholder = `__INLINE_CODE_PLACEHOLDER_${inlineCodes.length}__`;
      inlineCodes.push(`<code>${code}</code>`);
      return placeholder;
    });

    // 4. Parse bold (**text**)
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 5. Parse italic (*text*)
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 6. Split by line to format lists and paragraphs
    const lines = escaped.split('\n');
    let insideList = false;
    let formattedHTML = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!insideList) {
          formattedHTML += '<ul>';
          insideList = true;
        }
        formattedHTML += `<li>${line.substring(2)}</li>`;
      } else {
        if (insideList) {
          formattedHTML += '</ul>';
          insideList = false;
        }

        if (line === '') {
          formattedHTML += '<div class="spacer" style="height: 8px;"></div>';
        } else if (line.startsWith('__CODE_BLOCK_PLACEHOLDER_')) {
          formattedHTML += line; // Append raw block placeholder directly
        } else {
          formattedHTML += `<p>${line}</p>`;
        }
      }
    }
    if (insideList) {
      formattedHTML += '</ul>';
    }

    // 7. Reinsert inline code components
    inlineCodes.forEach((codeHTML, index) => {
      formattedHTML = formattedHTML.replace(`__INLINE_CODE_PLACEHOLDER_${index}__`, codeHTML);
    });

    // 8. Reinsert code blocks
    codeBlocks.forEach((blockHTML, index) => {
      formattedHTML = formattedHTML.replace(`__CODE_BLOCK_PLACEHOLDER_${index}__`, blockHTML);
    });

    return formattedHTML;
  }

  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // Inject standard chat bubbles (XSS safe)
  function appendMessageBubble(content, sender) {
    // Hide empty state welcome panel
    if (emptyState.style.display !== 'none') {
      emptyState.style.display = 'none';
    }

    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (sender === 'user') {
      // Direct textContent assignment for absolute XSS security on user inputs
      bubble.textContent = content;
    } else {
      // Safe markdown parsing (escapes HTML strings before injection)
      bubble.innerHTML = formatMarkdown(content);
    }

    messageRow.appendChild(bubble);
    chatMessages.appendChild(messageRow);
    scrollToBottom();
  }

  // Display bouncing dot animation bubble during generation
  function appendTypingIndicator() {
    const messageRow = document.createElement('div');
    messageRow.className = 'message-row assistant typing-row';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    `;

    bubble.appendChild(indicator);
    messageRow.appendChild(bubble);
    chatMessages.appendChild(messageRow);
    scrollToBottom();
  }

  // Remove typing animation element
  function removeTypingIndicator() {
    const typingRow = chatMessages.querySelector('.typing-row');
    if (typingRow) {
      typingRow.remove();
    }
  }

  // Clear session storage & reset UI
  clearChatBtn.addEventListener('click', () => {
    if (chatHistory.length === 0) {
      showToast('Chat history is already empty.', 'warning');
      return;
    }
    chatHistory = [];
    
    // Remove all message rows
    const rows = chatMessages.querySelectorAll('.message-row');
    rows.forEach(row => row.remove());
    
    // Restore welcome panel
    emptyState.style.display = 'flex';
    systemStatus.textContent = 'Assistant Online';
    systemStatus.parentNode.querySelector('.status-dot').className = 'status-dot pulsing';
    
    showToast('Conversation cleared successfully', 'success');
  });

  // Suggested prompt click integration
  const suggestedCards = document.querySelectorAll('.suggested-card');
  suggestedCards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      chatInput.value = prompt;
      // Trigger character count/textarea resize manually
      chatInput.dispatchEvent(new Event('input'));
      chatInput.focus();
    });
  });

  // ==========================================================================
  // SERVER API SUBMISSION
  // ==========================================================================
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    const queryText = chatInput.value.trim();

    // Empty input validation
    if (!queryText) {
      showToast('Please type a question before sending.', 'warning');
      return;
    }

    try {
      isSubmitting = true;
      sendBtn.classList.add('submitting');
      chatInput.disabled = true;

      // Update Header status
      systemStatus.textContent = 'Thinking...';
      const statusDot = systemStatus.parentNode.querySelector('.status-dot');
      statusDot.className = 'status-dot thinking';

      // 1. Show user message bubble
      appendMessageBubble(queryText, 'user');

      // Reset Form fields
      chatInput.value = '';
      chatInput.style.height = 'auto';
      charCounter.textContent = '0 / 4000';

      // 2. Add typing indicator bubble
      appendTypingIndicator();

      // 3. Post prompt to API server
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: queryText,
          history: chatHistory
        })
      });

      // 4. Remove typing bubble
      removeTypingIndicator();

      const data = await response.json();

      if (!response.ok) {
        // Handle server/limiter level errors
        const errMsg = data.error || 'Server returned an invalid response.';
        showToast(errMsg, 'error');
        appendMessageBubble(`⚠️ Failed to generate response. Error: ${errMsg}`, 'assistant');
        
        systemStatus.textContent = 'Offline (Error)';
        statusDot.className = 'status-dot offline';
        return;
      }

      // 5. Append generated AI response
      const aiReply = data.reply;
      appendMessageBubble(aiReply, 'assistant');

      // 6. Record conversation logs in history
      chatHistory.push({ role: 'user', content: queryText });
      chatHistory.push({ role: 'assistant', content: aiReply });

      // Restore system indicators
      systemStatus.textContent = 'Assistant Online';
      statusDot.className = 'status-dot pulsing';

    } catch (err) {
      console.error('Fetch request error:', err);
      removeTypingIndicator();
      showToast('Could not reach the server. Make sure the Node backend is active.', 'error');
      appendMessageBubble('⚠️ Connection Error: Failed to contact the backend server. Please verify execution status.', 'assistant');
      
      systemStatus.textContent = 'Offline (Error)';
      systemStatus.parentNode.querySelector('.status-dot').className = 'status-dot offline';
    } finally {
      isSubmitting = false;
      sendBtn.classList.remove('submitting');
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

});
