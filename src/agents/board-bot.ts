/**
 * STUDEX Board Bot - Local LLM Agent for Board Meetings
 * Runs on MacBook using Ollama (mistral/llama2)
 * Participates in Zoom/Teams/Meet with real-time responses
 */

import axios from 'axios';

interface BoardMember {
  name: string;
  role: string;
  expertise: string[];
}

interface BoardContext {
  boardMembers: BoardMember[];
  companyFinancials: {
    revenue: string;
    growthRate: string;
    runway: string;
    stage: string;
  };
  strategicGoals: string[];
  recentDecisions: string[];
}

export class BoardBot {
  private ollamaUrl: string = 'http://localhost:11434';
  private boardContext: BoardContext;
  private meetingTranscript: string = '';
  private decisions: string[] = [];
  private primaryModel: string = 'mistral';
  private reasoningModel: string = 'llama2';

  constructor(context: BoardContext) {
    this.boardContext = context;
  }

  /**
   * Process board meeting input (from transcription or text)
   */
  async processBoardInput(input: string, isQuestion: boolean = false): Promise<string> {
    try {
      // Check if we should respond
      if (!isQuestion && !this.isDirectedAtUs(input)) {
        return '';
      }

      console.log(`🎤 Board input: ${input}`);

      // For quick responses, use Mistral (fast)
      // For complex reasoning, use Llama2
      const model = input.length > 100 ? this.reasoningModel : this.primaryModel;

      const systemPrompt = this.buildSystemPrompt();
      const response = await this.generateResponse(input, systemPrompt, model);

      console.log(`🤖 Response: ${response}`);

      // Extract any decisions from the response
      this.extractDecisions(response);

      return response;
    } catch (error) {
      console.error('Error processing board input:', error);
      return 'Let me analyze that.';
    }
  }

  /**
   * Call local Ollama model
   */
  private async generateResponse(
    prompt: string,
    systemPrompt: string,
    model: string
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model,
          prompt: `${systemPrompt}\n\nBoard discussion:\n${prompt}\n\nResponse:`,
          stream: false,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
        },
        { timeout: 30000 }
      );

      return response.data.response.trim();
    } catch (error) {
      console.error('Ollama API error:', error);
      throw error;
    }
  }

  /**
   * Build system prompt with STUDEX board context
   */
  private buildSystemPrompt(): string {
    const boardInfo = this.boardContext.boardMembers
      .map(m => `- ${m.name} (${m.role}): ${m.expertise.join(', ')}`)
      .join('\n');

    return `You are Orgo.ai, the Chief of Staff AI for STUDEX Group's board of directors.

BOARD MEMBERS:
${boardInfo}

COMPANY STATUS:
- Revenue: ${this.boardContext.companyFinancials.revenue}
- Growth: ${this.boardContext.companyFinancials.growthRate}
- Runway: ${this.boardContext.companyFinancials.runway}
- Stage: ${this.boardContext.companyFinancials.stage}

STRATEGIC GOALS:
${this.boardContext.strategicGoals.map(g => `- ${g}`).join('\n')}

RECENT DECISIONS:
${this.boardContext.recentDecisions.slice(-3).map(d => `- ${d}`).join('\n')}

BEHAVIOR:
1. Provide data-driven insights
2. Ask clarifying questions when needed
3. Suggest action items
4. Play devil's advocate constructively
5. Keep responses concise (2-3 sentences max)
6. Speak in a professional but direct manner
7. Track decisions and extract action items
8. Consider impact on STUDEX's mission in Africa

You are pragmatic, analytical, and always focused on business outcomes.`;
  }

  /**
   * Check if input is directed at the AI
   */
  private isDirectedAtUs(text: string): boolean {
    const triggers = [
      'orgo',
      'chief of staff',
      'ai',
      'what do you think',
      'your thoughts',
      'agent',
      'opinion',
    ];

    return triggers.some(t => text.toLowerCase().includes(t));
  }

  /**
   * Extract decisions from text
   */
  private extractDecisions(text: string): void {
    const patterns = [
      /we will (.*?)[.!]/gi,
      /we decided (.*?)[.!]/gi,
      /action item: (.*?)[.!]/gi,
      /approve[d]? (.*?)[.!]/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const decision = match[1].trim();
        if (decision.length > 5 && !this.decisions.includes(decision)) {
          this.decisions.push(decision);
          console.log(`✓ Decision captured: ${decision}`);
        }
      }
    }
  }

  /**
   * Get all captured decisions
   */
  getDecisions(): string[] {
    return this.decisions;
  }

  /**
   * Clear decisions (new meeting)
   */
  clearDecisions(): void {
    this.decisions = [];
  }

  /**
   * Get meeting summary
   */
  async getMeetingSummary(): Promise<string> {
    if (!this.meetingTranscript) {
      return 'No meeting transcript available';
    }

    try {
      const response = await this.generateResponse(
        `Summarize the key points and decisions from this board meeting:\n\n${this.meetingTranscript}`,
        'Provide a concise board meeting summary with key decisions and action items.',
        this.reasoningModel
      );

      return response;
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Summary generation failed';
    }
  }

  /**
   * Health check - verify Ollama is running
   */
  async healthCheck(): Promise<{ status: string; models: string[] }> {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: 5000,
      });

      const models = response.data.models.map((m: any) => m.name);

      return {
        status: 'healthy',
        models,
      };
    } catch (error) {
      return {
        status: 'unhealthy - Ollama not running',
        models: [],
      };
    }
  }
}

// Export singleton
export const boardBot = new BoardBot({
  boardMembers: [
    {
      name: 'Tumelo Ramaphosa',
      role: 'CEO & Founder',
      expertise: ['strategy', 'business development', 'Africa market'],
    },
    {
      name: 'Orgo.ai',
      role: 'Chief of Staff',
      expertise: ['decision analysis', 'workflow optimization', 'data synthesis'],
    },
  ],
  companyFinancials: {
    revenue: '$2.5M Q3',
    growthRate: '45% YoY',
    runway: '18 months',
    stage: 'Growth',
  },
  strategicGoals: [
    'Reach $5M ARR by Q2 2025',
    'Expand to 5 African countries',
    'Build 250-agent AI team',
    'Achieve profitability by 2025',
  ],
  recentDecisions: [
    'Approved Rwanda market expansion',
    'Increased marketing budget by 30%',
    'Hired VP of Operations',
  ],
});
