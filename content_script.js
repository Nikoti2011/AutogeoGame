console.log('[autoplay] content script loaded');

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
document.documentElement.appendChild(script);
script.remove();