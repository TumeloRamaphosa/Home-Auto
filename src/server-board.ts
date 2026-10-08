/**
 * STUDEX Board Bot API Server
 * Runs on MacBook: http://localhost:3007
 * Handles board meeting requests + Ollama integration
 */

import express, { Request, Response } from 'express';
import { boardBot } from './agents/board-bot';

const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());

// ======================== HEALTH CHECK ========================

app.get('/health', async (req: Request, res: Response) => {
  const health = await boardBot.healthCheck();

  if (health.status === 'healthy') {
    res.status(200).json({
      status: 'ok',
      message: 'STUDEX Board Bot running',
      ollama: health,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'error',
      message: 'Ollama not running on MacBook',
      instructions: '1. Open /Applications/Ollama.app\n2. Wait for server to start\n3. Retry this endpoint',
    });
  }
});

// ======================== BOARD MEETING ========================

/**
 * Process board input (transcription from Zoom/Teams)
 * POST /api/board/process
 * Body: { input: "What should we do in Rwanda?", isQuestion: true }
 */
app.post('/api/board/process', async (req: Request, res: Response) => {
  try {
    const { input, isQuestion = false } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'input required' });
    }

    const response = await boardBot.processBoardInput(input, isQuestion);

    res.json({
      input,
      response,
      timestamp: new Date().toISOString(),
      decisionsCount: boardBot.getDecisions().length,
    });
  } catch (error) {
    console.error('Error processing board input:', error);
    res.status(500).json({
      error: 'Failed to process input',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get current decisions from the meeting
 * GET /api/board/decisions
 */
app.get('/api/board/decisions', (req: Request, res: Response) => {
  res.json({
    decisions: boardBot.getDecisions(),
    count: boardBot.getDecisions().length,
  });
});

/**
 * Clear decisions (start new meeting)
 * POST /api/board/clear
 */
app.post('/api/board/clear', (req: Request, res: Response) => {
  boardBot.clearDecisions();
  res.json({ message: 'Decisions cleared', timestamp: new Date().toISOString() });
});

/**
 * Get meeting summary
 * GET /api/board/summary
 */
app.get('/api/board/summary', async (req: Request, res: Response) => {
  try {
    const summary = await boardBot.getMeetingSummary();
    res.json({ summary, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ======================== MODELS ========================

/**
 * Get available Ollama models
 * GET /api/models
 */
app.get('/api/models', async (req: Request, res: Response) => {
  try {
    const health = await boardBot.healthCheck();
    res.json({
      status: health.status,
      models: health.models,
      recommended: ['mistral (fast)', 'llama2 (reasoning)', 'neural-chat (conversation)'],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// ======================== TEST ENDPOINTS ========================

/**
 * Test the board bot
 * POST /api/test
 */
app.post('/api/test', async (req: Request, res: Response) => {
  try {
    const testPrompts = [
      'What should STUDEX do in Rwanda?',
      'Should we approve the $500K investment?',
      'What are the risks we should consider?',
    ];

    const randomPrompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
    const response = await boardBot.processBoardInput(randomPrompt, true);

    res.json({
      test: 'success',
      prompt: randomPrompt,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      test: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      instructions:
        '1. Ensure Ollama is running: open /Applications/Ollama.app\n2. Pull models: ollama pull mistral\n3. Retry this request',
    });
  }
});

// ======================== SERVER ========================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   🤖 STUDEX Board Bot Server Running                   ║
║                                                        ║
║   🎯 Local URL: http://localhost:${PORT}                   ║
║   🔧 Ollama: http://localhost:11434                    ║
║                                                        ║
║   📍 ENDPOINTS:                                        ║
║   • POST /api/board/process    (process input)         ║
║   • GET  /api/board/decisions  (get decisions)         ║
║   • GET  /api/board/summary    (meeting summary)       ║
║   • POST /api/board/clear      (clear decisions)       ║
║   • POST /api/test             (test board bot)        ║
║   • GET  /health               (health check)          ║
║                                                        ║
║   🚀 TEST IT:                                          ║
║   curl http://localhost:${PORT}/health                     ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

export default app;
