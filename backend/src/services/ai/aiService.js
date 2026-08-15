
// ── AI Service ───────────────────────────────────────────────
// Swap AI_PROVIDER in .env:
//   mock     = realistic fake responses (development)
//   claude   = Anthropic Claude API (production)

const PROVIDER = process.env.AI_PROVIDER || 'mock';

// ── Mock response engine ─────────────────────────────────────
const mockResponses = {
  greet: (name) =>
    `Hello${name ? ' ' + name : ''}! I'm your KampusLearn AI tutor. I'm here to help you understand your courses, practice exam questions, and prepare for your exams. What would you like to study today?`,

  explain: (topic, course) =>
    `Great question about **${topic}**!

Here's a clear explanation:

` +
    `**Definition:** ${topic} is a fundamental concept in ${course || 'this course'} that you need to understand well for your exams.

` +
    `**Key Points to Remember:**
` +
    `1. Start with the basic definition and make sure you can state it in your own words
` +
    `2. Understand how ${topic} connects to other topics in the course
` +
    `3. Practice applying this concept to past exam questions
` +
    `4. Look for patterns in how lecturers have tested this in previous years

` +
    `**Exam Tip:** This topic frequently appears in semester exams. Focus on both theoretical definitions and practical applications.

` +
    `Would you like me to generate some practice questions on ${topic}?`,

  quiz: (course) =>
    `Here are 3 practice questions for ${course || 'your course'}:

` +
    `**Q1.** Which of the following best describes the main concept?
` +
    `A) The first option  B) The correct answer  C) A distractor  D) Another distractor
` +
    `*Answer: B — because it directly addresses the core definition.*

` +
    `**Q2.** In what scenario would you apply this concept?
` +
    `A) Scenario one  B) Scenario two  C) The right scenario  D) Scenario four
` +
    `*Answer: C — this is the most common exam application.*

` +
    `**Q3.** What is the key difference between concept A and concept B?
` +
    `*Answer: Focus on the distinguishing characteristic — this is a popular examiner favourite.*

` +
    `Want more questions? Tell me a specific topic and I'll generate targeted practice questions.`,

  summary: (topic) =>
    `**Quick Revision Summary: ${topic}**

` +
    `📌 **Core Definition:** The essential meaning of ${topic} in one sentence.

` +
    `📌 **Why It Matters:** Understanding ${topic} is crucial because it forms the foundation for more advanced topics in this course.

` +
    `📌 **Key Formula/Rule** (if applicable): Remember the key relationship or rule associated with this concept.

` +
    `📌 **Common Exam Mistakes:** Students often confuse ${topic} with related concepts — make sure you understand the distinction.

` +
    `📌 **Memory Tip:** Create a simple acronym or mental image to remember the key points.

` +
    `This summary covers the essentials. Want a deeper explanation of any part?`,

  examPlan: (course, days) =>
    `**${days || 7}-Day Exam Crash Plan for ${course || 'Your Course'}**

` +
    `📅 **Day 1-2:** Cover all core definitions and fundamental concepts. Read your lecture notes and highlight key terms.

` +
    `📅 **Day 3:** Focus on past questions from the last 3 years. Identify which topics appear most frequently.

` +
    `📅 **Day 4:** Work through calculations or practical problems (if applicable). Don't just read — practice.

` +
    `📅 **Day 5:** Review your weak areas identified from Day 3 practice. Ask me to explain anything you're stuck on.

` +
    `📅 **Day 6:** Do a full timed mock exam. Simulate real exam conditions — no notes, time yourself.

` +
    `📅 **Day 7:** Light review only. Go over your summary notes, get good sleep, eat well before the exam.

` +
    `**Pro Tip:** The exam is testing whether you understand concepts, not just whether you memorised them. Focus on *why* things work, not just *what* they are.`,

  weak: (topics) =>
    `Based on your recent practice sessions, here are your **weak areas** to focus on:

` +
    (topics && topics.length
      ? topics.map((t, i) => `${i+1}. **${t}** — needs more practice`).join('\n')
      : `1. **Core Fundamentals** — review your basic definitions\n2. **Applied Concepts** — practice more past questions\n3. **Calculations** — work through more numerical problems`
    ) + `

I recommend spending extra time on these areas before your exam. Want me to create a targeted quiz on any of these?`,

  default: (message) =>
    `I understand you're asking about: *"${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"*

` +
    `As your AI academic tutor, I can help you with:
` +
    `• **Explaining concepts** — just describe what you're struggling with
` +
    `• **Generating quiz questions** — say "quiz me on [topic]"
` +
    `• **Summarizing topics** — say "summarize [topic]"
` +
    `• **Creating exam plans** — say "exam plan for [course]"
` +
    `• **Identifying weak areas** — say "what are my weak topics"

` +
    `What specific topic or course are you studying right now?`
};

// ── Detect intent from message ────────────────────────────────
function detectIntent(message) {
  const m = message.toLowerCase();
  if (m.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) return 'greet';
  if (m.match(/explain|what is|what are|define|meaning of|tell me about/)) return 'explain';
  if (m.match(/quiz|practice question|test me|sample question|give me question/)) return 'quiz';
  if (m.match(/summar|revision|revise|summarize|key point|overview/)) return 'summary';
  if (m.match(/exam plan|study plan|crash course|prepare for|ready for exam/)) return 'examPlan';
  if (m.match(/weak|struggling|difficult|hard topic|not understanding/)) return 'weak';
  return 'default';
}

// ── Extract topic from message ────────────────────────────────
function extractTopic(message) {
  const patterns = [
    /explain (.+)/i,
    /what is (.+)/i,
    /what are (.+)/i,
    /define (.+)/i,
    /about (.+)/i,
    /summarize (.+)/i,
    /summary of (.+)/i,
    /quiz me on (.+)/i,
    /questions on (.+)/i
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1].replace(/[?.!]$/, '').trim();
  }
  return null;
}

// ── Main AI function ──────────────────────────────────────────
async function getAIResponse(messages, courseContext, userContext) {
  const lastMessage = messages[messages.length - 1];
  const userMessage = typeof lastMessage === 'string'
    ? lastMessage
    : lastMessage?.content || '';

  const courseName  = courseContext?.title || courseContext?.code || 'your course';
  const intent      = detectIntent(userMessage);
  const topic       = extractTopic(userMessage) || courseName;
  const studentName = userContext?.full_name?.split(' ')[0] || '';

  // Simulate network delay (200-600ms) for realistic feel
  await new Promise(r => setTimeout(r, 200 + Math.random() * 400));

  let responseText;
  switch (intent) {
    case 'greet':     responseText = mockResponses.greet(studentName); break;
    case 'explain':   responseText = mockResponses.explain(topic, courseName); break;
    case 'quiz':      responseText = mockResponses.quiz(courseName); break;
    case 'summary':   responseText = mockResponses.summary(topic); break;
    case 'examPlan':  responseText = mockResponses.examPlan(courseName, 7); break;
    case 'weak':      responseText = mockResponses.weak(userContext?.weakTopics); break;
    default:          responseText = mockResponses.default(userMessage);
  }

  return {
    content:     responseText,
    tokens_used: Math.floor(responseText.length / 4), // rough token estimate
    provider:    'mock'
  };
}

module.exports = { getAIResponse };
