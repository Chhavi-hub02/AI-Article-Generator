/**
 * AI 500-Word Article Generator
 * Client-side Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Constants & Config ---
  const API_ENDPOINT = 'https://chhavi2004.app.n8n.cloud/webhook/generate-article';

  // --- DOM Elements ---
  const articleForm = document.getElementById('article-form');
  const topicInput = document.getElementById('topic-input');
  const clearInputBtn = document.getElementById('clear-input-btn');
  const generateBtn = document.getElementById('generate-btn');
  const suggestionChips = document.querySelectorAll('.chip');

  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');
  const retryBtn = document.getElementById('retry-btn');

  const readingCard = document.getElementById('reading-card');
  const displayTopic = document.getElementById('display-topic');
  const wordCounter = document.getElementById('word-counter');
  const readingTime = document.getElementById('reading-time');
  const charCounter = document.getElementById('footer-char-count');
  const articleContent = document.getElementById('article-content');
  const copyBtn = document.getElementById('copy-btn');
  const copyBtnText = copyBtn.querySelector('.copy-btn-text');
  const copyIcon = copyBtn.querySelector('.copy-icon');
  const checkIcon = copyBtn.querySelector('.check-icon');
  const regenerateBtn = document.getElementById('regenerate-btn');

  // --- State Variables ---
  let currentArticleRawText = '';
  let currentTopic = '';
  let isGenerating = false;

  // --- Utility Functions ---

  /**
   * Calculates the exact word count of a given string.
   * @param {string} text
   * @returns {number}
   */
  function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const matches = text.trim().match(/[\w'-]+/g);
    return matches ? matches.length : 0;
  }

  /**
   * Estimates reading time based on standard 200 words per minute.
   * @param {number} wordCount
   * @returns {string}
   */
  function calculateReadingTime(wordCount) {
    if (wordCount === 0) return '0 min read';
    const minutes = Math.ceil(wordCount / 200);
    return `~${minutes} min read`;
  }

  /**
   * Escapes HTML special characters to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Formats raw markdown or plain text into clean, readable HTML.
   * Handles headers, bold/italics, quotes, bullet points, and paragraphs.
   * @param {string} rawText
   * @returns {string}
   */
  function formatArticleHtml(rawText) {
    if (!rawText) return '';

    // Split into paragraphs by two or more newlines
    const blocks = rawText.split(/\n\s*\n/);
    const htmlBlocks = [];

    for (let block of blocks) {
      block = block.trim();
      if (!block) continue;

      // Check for headings (# H1, ## H2, ### H3)
      if (/^###\s+(.+)$/m.test(block)) {
        htmlBlocks.push(`<h3>${inlineFormat(block.replace(/^###\s+/, ''))}</h3>`);
      } else if (/^##\s+(.+)$/m.test(block)) {
        htmlBlocks.push(`<h2>${inlineFormat(block.replace(/^##\s+/, ''))}</h2>`);
      } else if (/^#\s+(.+)$/m.test(block)) {
        htmlBlocks.push(`<h1>${inlineFormat(block.replace(/^#\s+/, ''))}</h1>`);
      }
      // Check for blockquote
      else if (/^>\s+(.+)$/s.test(block)) {
        htmlBlocks.push(`<blockquote>${inlineFormat(block.replace(/^>\s+/, ''))}</blockquote>`);
      }
      // Check for bullet lists (lines starting with - or * )
      else if (/^(\*|-)\s+/m.test(block)) {
        const items = block.split(/\n/).map(line => line.replace(/^(\*|-)\s+/, '').trim()).filter(Boolean);
        const listHtml = items.map(item => `<li>${inlineFormat(item)}</li>`).join('');
        htmlBlocks.push(`<ul>${listHtml}</ul>`);
      }
      // Check for numbered lists (lines starting with 1. 2. )
      else if (/^\d+\.\s+/m.test(block)) {
        const items = block.split(/\n/).map(line => line.replace(/^\d+\.\s+/, '').trim()).filter(Boolean);
        const listHtml = items.map(item => `<li>${inlineFormat(item)}</li>`).join('');
        htmlBlocks.push(`<ol>${listHtml}</ol>`);
      }
      // Regular paragraph
      else {
        // Replace single newlines inside paragraph with a break
        const formattedPara = inlineFormat(block).replace(/\n/g, '<br>');
        htmlBlocks.push(`<p>${formattedPara}</p>`);
      }
    }

    return htmlBlocks.join('\n');
  }

  /**
   * Helper to format inline markdown (bold, italics, code).
   * @param {string} text
   * @returns {string}
   */
  function inlineFormat(text) {
    let sanitized = escapeHtml(text);
    // Bold: **text** or __text__
    sanitized = sanitized.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    sanitized = sanitized.replace(/__(.*?)__/g, '<strong>$1</strong>');
    // Italics: *text* or _text_
    sanitized = sanitized.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    sanitized = sanitized.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Inline code: `text`
    sanitized = sanitized.replace(/`([^`]+)`/g, '<code>$1</code>');
    return sanitized;
  }

  /**
   * Extracts the article string from the server response payload.
   * Supports standard { "article": "..." }, arrays, or nested objects.
   * @param {any} data
   * @returns {string}
   */
  function extractArticleContent(data) {
    if (!data) return '';

    // If data is already a string
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return extractArticleContent(parsed);
      } catch {
        return data;
      }
    }

    // If data is an array (e.g. n8n default return item list)
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      return extractArticleContent(data[0]);
    }

    // If data is an object
    if (typeof data === 'object') {
      if (typeof data.article === 'string' && data.article.trim()) {
        return data.article;
      }
      if (data.data && typeof data.data.article === 'string') {
        return data.data.article;
      }
      if (typeof data.content === 'string') {
        return data.content;
      }
      if (typeof data.text === 'string') {
        return data.text;
      }
      if (typeof data.message === 'string') {
        return data.message;
      }
      // Fallback: search for any key with long text
      for (const key of Object.keys(data)) {
        if (typeof data[key] === 'string' && data[key].length > 100) {
          return data[key];
        }
      }
    }

    return JSON.stringify(data, null, 2);
  }

  // --- UI State Management ---

  function setLoading(loading) {
    isGenerating = loading;
    generateBtn.disabled = loading;
    topicInput.disabled = loading;

    if (loading) {
      errorState.hidden = true;
      readingCard.hidden = true;
      loadingState.hidden = false;
      loadingState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      loadingState.hidden = true;
    }
  }

  function showError(title, message) {
    loadingState.hidden = true;
    readingCard.hidden = true;
    errorTitle.textContent = title || 'Error Occurred';
    errorMessage.textContent = message || 'An unexpected error occurred while generating the article.';
    errorState.hidden = false;
    errorState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function displayArticle(topic, rawArticle) {
    currentTopic = topic;
    currentArticleRawText = rawArticle;

    // Calculate word & character metrics
    const words = countWords(rawArticle);
    const chars = rawArticle.length;
    const estTime = calculateReadingTime(words);

    // Update UI elements
    displayTopic.textContent = topic;
    wordCounter.textContent = `${words.toLocaleString()} words`;
    readingTime.textContent = estTime;
    charCounter.textContent = `${chars.toLocaleString()} characters`;

    // Render formatted HTML
    articleContent.innerHTML = formatArticleHtml(rawArticle);

    // Show reading card & hide errors/loading
    errorState.hidden = true;
    loadingState.hidden = true;
    readingCard.hidden = false;

    // Scroll smoothly to result
    setTimeout(() => {
      readingCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // --- API Execution ---

  async function handleGenerateArticle(topic) {
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      topicInput.focus();
      return;
    }

    setLoading(true);

    try {
      // Send POST request with { "topic": "<user_input>" }
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic: cleanTopic })
      });

      if (!response.ok) {
        let errDetail = `Server responded with status ${response.status} (${response.statusText})`;
        try {
          const errJson = await response.json();
          if (errJson && (errJson.message || errJson.error)) {
            errDetail += `: ${errJson.message || errJson.error}`;
          }
        } catch {
          // Response body was not JSON
        }
        throw new Error(errDetail);
      }

      // Parse JSON response
      const data = await response.json();
      const extractedArticle = extractArticleContent(data);

      if (!extractedArticle || extractedArticle.trim() === '') {
        throw new Error('Received an empty article response from the generator webhook.');
      }

      displayArticle(cleanTopic, extractedArticle);
    } catch (err) {
      console.error('Article generation error:', err);

      let userFriendlyMessage = err.message || 'Failed to connect to the generation service.';
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        userFriendlyMessage = 'Network or CORS connection error. Please verify your internet connection or webhook CORS settings.';
      }

      showError('Generation Failed', userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  }

  // --- Event Listeners ---

  // Form submission
  articleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isGenerating) return;
    const topic = topicInput.value;
    handleGenerateArticle(topic);
  });

  // Clear input button
  topicInput.addEventListener('input', () => {
    if (topicInput.value.length > 0) {
      clearInputBtn.classList.add('visible');
    } else {
      clearInputBtn.classList.remove('visible');
    }
  });

  clearInputBtn.addEventListener('click', () => {
    topicInput.value = '';
    clearInputBtn.classList.remove('visible');
    topicInput.focus();
  });

  // Suggestion chips
  suggestionChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const topic = chip.getAttribute('data-topic');
      if (topic) {
        topicInput.value = topic;
        clearInputBtn.classList.add('visible');
        topicInput.focus();
        // Optional quick trigger or ready for user click
      }
    });
  });

  // Copy Article button
  copyBtn.addEventListener('click', async () => {
    if (!currentArticleRawText) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(currentArticleRawText);
      } else {
        // Fallback for non-https or older environments
        const textArea = document.createElement('textarea');
        textArea.value = currentArticleRawText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      // Visual feedback
      copyBtn.classList.add('copied');
      copyBtnText.textContent = 'Copied!';
      copyIcon.hidden = true;
      checkIcon.hidden = false;

      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtnText.textContent = 'Copy Article';
        copyIcon.hidden = false;
        checkIcon.hidden = true;
      }, 2500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      copyBtnText.textContent = 'Failed to copy';
      setTimeout(() => {
        copyBtnText.textContent = 'Copy Article';
      }, 2000);
    }
  });

  // Retry & Regenerate buttons
  retryBtn.addEventListener('click', () => {
    const topic = topicInput.value.trim() || currentTopic;
    if (topic) {
      handleGenerateArticle(topic);
    } else {
      errorState.hidden = true;
      topicInput.focus();
    }
  });

  regenerateBtn.addEventListener('click', () => {
    if (currentTopic) {
      topicInput.value = currentTopic;
      clearInputBtn.classList.add('visible');
      handleGenerateArticle(currentTopic);
    }
  });
});
