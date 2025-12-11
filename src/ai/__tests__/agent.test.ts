import {respondToPrompt} from '../agent.js';

/**
 * Unit tests for the respondToPrompt function
 */
describe('respondToPrompt', () => {
  describe('Time-related queries', () => {
    it('should respond to "what time is it"', () => {
      const response = respondToPrompt('what time is it');
      expect(response).toContain('Central Time');
      expect(response).not.toContain("Sorry, I don't understand");
    });

    it('should respond to "what is the time"', () => {
      const response = respondToPrompt('what is the time');
      expect(response).toContain('Central Time');
      expect(response).not.toContain("Sorry, I don't understand");
    });

    it('should respond to "current time"', () => {
      const response = respondToPrompt('current time');
      expect(response).toContain('Central Time');
      expect(response).not.toContain("Sorry, I don't understand");
    });

    it('should respond to "time right now"', () => {
      const response = respondToPrompt('time right now');
      expect(response).toContain('Central Time');
      expect(response).not.toContain("Sorry, I don't understand");
    });

    it('should be case-insensitive', () => {
      const response = respondToPrompt('WHAT TIME IS IT?');
      expect(response).toContain('Central Time');
      expect(response).not.toContain("Sorry, I don't understand");
    });

    it('should handle extra whitespace', () => {
      const response = respondToPrompt('  what time is it  ');
      expect(response).toContain('Central Time');
      expect(response).not.toContain("Sorry, I don't understand");
    });

    it('should work with time query in a sentence', () => {
      const response = respondToPrompt('Can you tell me what time is it?');
      expect(response).toContain('Central Time');
      expect(response).not.toContain("Sorry, I don't understand");
    });
  });

  describe('Non-time queries', () => {
    it('should return default message for unrecognized prompt', () => {
      const response = respondToPrompt('hello');
      expect(response).toBe("Sorry, I don't understand your prompt.");
    });

    it('should return default message for unrelated question', () => {
      const response = respondToPrompt('what is the weather?');
      expect(response).toBe("Sorry, I don't understand your prompt.");
    });
  });
});
