import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly storage = inject(StorageService);

  /** Signal indicating if an AI operation is currently in progress. */
  readonly isGenerating = signal(false);

  /** Signal indicating if a Gemini API key is configured. */
  readonly hasApiKey = signal(!!this.storage.loadApiKey());

  /** Refreshes the hasApiKey status from storage. */
  updateApiKeyStatus(): void {
    this.hasApiKey.set(!!this.storage.loadApiKey());
  }

  async generateCode(prompt: string): Promise<string> {
    const apiKey = this.storage.loadApiKey();
    if (!apiKey) {
      throw new Error('API key not set. Please go to AI Settings and enter your Gemini API key.');
    }

    this.isGenerating.set(true);

    const systemPrompt = `You are an expert Python developer for MicroPython. 
Generate readable, efficient Python code for a MicroPython interpreter.
Follow PEP 8 style guidelines. Use 4 spaces for indentation.
ONLY return the Python code itself, no explanations, no markdown code blocks, no preamble.
If you cannot fulfill the request, return an error message starting with # ERROR:`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt + '\n\nUser request: ' + prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to call Gemini API');
      }

      const data = await response.json();
      let code = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean up common AI responses (markdown blocks)
      code = code.replace(/^```python\n/, '').replace(/\n```$/, '');
      code = code.trim();

      return code;
    } catch (err) {
      console.error('Gemini API Error:', err);
      throw err instanceof Error ? err : new Error('An unknown error occurred while calling the Gemini API');
    } finally {
      this.isGenerating.set(false);
    }
  }
}
