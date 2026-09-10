'use strict';
const { prepare, generate } = require('./gemini');
// Provider boundary. No automatic mock fallback when Gemini fails.
async function getAIResponse(messages, courseContext, userContext, sources = [], prepared = null) {
  return generate(prepared || await prepare(messages, courseContext, userContext, sources));
}
module.exports = { getAIResponse };
