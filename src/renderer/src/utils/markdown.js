import katex from 'katex';

/**
 * Simple markdown to HTML converter with support for common markdown syntax and LaTeX
 * Used to render quiz explanations, flashcard content, and summaries
 */

export function markdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown;

  // Store LaTeX expressions to protect them from markdown processing
  const latexPlaceholders = {};
  let placeholderIndex = 0;

  // Extract display math ($$...$$) - must be before other replacements
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    const placeholder = `LATEXDISPLAYPLACEHOLDER${placeholderIndex}END`;
    try {
      latexPlaceholders[placeholder] = katex.renderToString(latex, { displayMode: true });
    } catch (e) {
      // If KaTeX fails, show the raw LaTeX in a code block
      latexPlaceholders[placeholder] = `<pre><code class="language-latex">${latex}</code></pre>`;
    }
    placeholderIndex++;
    return placeholder;
  });

  // Extract inline math ($...$) - simpler pattern that works better
  html = html.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
    // Skip if it looks like markdown emphasis (single $ on each side of emphasis)
    // This is a simple heuristic that works for most cases
    const placeholder = `LATEXINLINEPLACEHOLDER${placeholderIndex}END`;
    try {
      latexPlaceholders[placeholder] = katex.renderToString(latex, { displayMode: false });
    } catch (e) {
      // If KaTeX fails, show the raw LaTeX in inline code
      latexPlaceholders[placeholder] = `<code class="language-latex">${latex}</code>`;
    }
    placeholderIndex++;
    return placeholder;
  });

  // Escape HTML entities first to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Unescape special markdown characters
  html = html
    .replace(/&amp;#/g, '&#')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Headers
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__( .*?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Code blocks (```language ... ```)
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    '<pre><code class="language-$1">$2</code></pre>'
  );

  // Inline code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Lists - Ordered
  html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/s, '<ol>$1</ol>');

  // Lists - Unordered
  html = html.replace(/^[-*] (.*?)$/gm, '<li>$1</li>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap paragraph content
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p><(h[1-3]|pre)/g, '<$1');
  html = html.replace(/<\/(h[1-3]|pre)><\/p>/g, '</$1>');
  html = html.replace(/<p><(ol|ul)/g, '<$1');
  html = html.replace(/<\/(ol|ul)><\/p>/g, '</$1>');

  // Restore LaTeX expressions - do this last to preserve the rendered HTML
  Object.entries(latexPlaceholders).forEach(([placeholder, latex]) => {
    html = html.split(placeholder).join(latex);
  });

  return html;
}

/**
 * Sanitize HTML to remove script tags and event handlers
 */
export function sanitizeHtml(html) {
  if (!html) return '';

  // Remove script tags
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  return html;
}

/**
 * Convert markdown to safe HTML for display
 */
export function renderMarkdown(text) {
  const html = markdownToHtml(text);
  return sanitizeHtml(html);
}
