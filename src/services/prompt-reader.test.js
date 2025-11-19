const readline = require('readline');
const chalk = require('chalk');
const logger = require('../utils/logger');

// Mock dependencies first
jest.mock('readline');
jest.mock('../utils/logger');

// Import the actual module for testing
const promptReader = require('./prompt-reader');

// Mock chalk comprehensively
jest.mock('chalk', () => ({
  bold: {
    cyan: jest.fn((text) => `cyan-bold: ${text}`),
    yellow: jest.fn((text) => `yellow-bold: ${text}`),
    white: jest.fn((text) => `white-bold: ${text}`),
    green: jest.fn((text) => `green-bold: ${text}`)
  },
  cyan: jest.fn((text) => `cyan: ${text}`),
  white: jest.fn((text) => `white: ${text}`),
  gray: jest.fn((text) => `gray: ${text}`),
  yellow: jest.fn((text) => `yellow: ${text}`),
  green: jest.fn((text) => `green: ${text}`),
  blue: jest.fn((text) => `blue: ${text}`),
  red: jest.fn((text) => `red: ${text}`),
  magenta: jest.fn((text) => `magenta: ${text}`),
  reset: jest.fn((text) => text)
}));


describe('prompt-reader', () => {
  let mockReadlineInterface;
  let mockConsoleLog;
  let mockProcessStdoutWrite;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup console mocks
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockProcessStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation();

    // Setup mock readline interface
    mockReadlineInterface = {
      on: jest.fn(),
      question: jest.fn(),
      close: jest.fn()
    };

    readline.createInterface.mockReturnValue(mockReadlineInterface);
  });

  afterEach(() => {
    // Restore console mocks
    mockConsoleLog.mockRestore();
    mockProcessStdoutWrite.mockRestore();
  });

  describe('getMultilineInput', () => {
    test('should create readline interface with correct options', () => {
      // Setup a basic mock that resolves immediately
      mockReadlineInterface.on.mockImplementation((event, callback) => {
        if (event === 'line') {
          // Immediately trigger the double-enter condition
          setTimeout(() => callback(''), 5);
          setTimeout(() => callback(''), 10);
        }
      });

      const promise = promptReader.getMultilineInput();

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        terminal: true
      });
      expect(mockReadlineInterface.on).toHaveBeenCalledWith('line', expect.any(Function));

      return promise;
    });

    test('should handle SIGINT cancellation', async () => {
      const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation();

      mockReadlineInterface.on.mockImplementation((event, callback) => {
        if (event === 'SIGINT') {
          setTimeout(callback, 5);
        }
      });

      // This test should not resolve, so we'll set a timeout
      const promise = promptReader.getMultilineInput();

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockReadlineInterface.close).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Operation cancelled');
      expect(mockProcessExit).toHaveBeenCalledWith(0);

      mockProcessExit.mockRestore();
    });

    test('should display formatted output', async () => {
      mockReadlineInterface.on.mockImplementation((event, callback) => {
        if (event === 'line') {
          setTimeout(() => callback(''), 5);
          setTimeout(() => callback(''), 10);
        }
      });

      await promptReader.getMultilineInput();

      // Verify console output formatting was called
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessStdoutWrite).toHaveBeenCalled();
    });
  });

  describe('getSimpleInput', () => {
    let originalGetSimpleInput;

    beforeEach(() => {
      // Store the original function
      originalGetSimpleInput = promptReader.getSimpleInput;
    });

    test('should create readline interface and handle question', () => {
      const mockAnswer = 'test answer';

      mockReadlineInterface.question.mockImplementation((question, callback) => {
        setTimeout(() => callback(mockAnswer), 5);
      });

      const promise = originalGetSimpleInput('Test question?');

      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        terminal: true
      });
      expect(mockReadlineInterface.question).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function)
      );

      return promise.then(result => {
        expect(result).toBe(mockAnswer);
      });
    });

    test('should handle SIGINT cancellation', async () => {
      const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation();

      mockReadlineInterface.on.mockImplementation((event, callback) => {
        if (event === 'SIGINT') {
          setTimeout(callback, 5);
        }
      });

      const promise = originalGetSimpleInput('Test?');

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockReadlineInterface.close).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Operation cancelled');
      expect(mockProcessExit).toHaveBeenCalledWith(0);

      mockProcessExit.mockRestore();
    });

    test('should trim whitespace from answer', () => {
      const mockAnswer = '  trimmed answer  ';

      mockReadlineInterface.question.mockImplementation((question, callback) => {
        setTimeout(() => callback(mockAnswer), 5);
      });

      return originalGetSimpleInput('Test?').then(result => {
        expect(result).toBe('trimmed answer');
      });
    });
  });

  describe('askClarificationQuestions', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Setup console mocks
      mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
      mockProcessStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation();

      // Setup enhanced mock readline interface for askClarificationQuestions
      mockReadlineInterface = {
        on: jest.fn(),
        question: jest.fn(),
        close: jest.fn()
      };

      // Enhanced readline mock to handle all internal calls
      readline.createInterface.mockReturnValue(mockReadlineInterface);

      // Mock getSimpleInput to return mocked responses instantly
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        // Immediately call callback with a test answer
        setTimeout(() => callback('Mocked answer'), 1);
      });
    });

    test('should process JSON string questions and collect answers', async () => {
      const questionsJson = JSON.stringify([
        {
          id: 1,
          title: 'Test Question 1',
          question: 'What is your preference?',
          category: 'General'
        }
      ]);

      // The question mock is already set up in beforeEach, but override for this specific test
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        setTimeout(() => callback('Test answer'), 1);
      });

      const result = await promptReader.askClarificationQuestions(questionsJson);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.timestamp).toBeDefined();
      expect(parsedResult.answers).toHaveLength(1);
      expect(parsedResult.answers[0]).toEqual({
        questionId: 1,
        question: 'Test Question 1',
        category: 'General',
        answer: 'Test answer'
      });
      expect(mockReadlineInterface.question).toHaveBeenCalledWith('cyan: Your answer: ', expect.any(Function));
    });

    test('should process object questions and collect answers', async () => {
      const questionsObject = [
        {
          title: 'Object Question',
          question: 'What should we do?'
        }
      ];

      // Override the question mock for this specific test
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        setTimeout(() => callback('Object Answer'), 1);
      });

      const result = await promptReader.askClarificationQuestions(questionsObject);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.answers).toHaveLength(1);
      expect(parsedResult.answers[0].questionId).toBe(1);
      expect(parsedResult.answers[0].answer).toBe('Object Answer');
    });

    test('should handle multiple questions', async () => {
      const questions = [
        { title: 'Question 1', question: 'First?' },
        { title: 'Question 2', question: 'Second?' }
      ];

      // Track call count for multiple questions
      let callCount = 0;
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        callCount++;
        const answer = callCount === 1 ? 'Answer 1' : 'Answer 2';
        setTimeout(() => callback(answer), 1);
      });

      const result = await promptReader.askClarificationQuestions(questions);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.answers).toHaveLength(2);
      expect(parsedResult.answers[0].answer).toBe('Answer 1');
      expect(parsedResult.answers[1].answer).toBe('Answer 2');
      expect(mockReadlineInterface.question).toHaveBeenCalledTimes(2);
    });

    test('should throw error for malformed JSON string', async () => {
      const malformedJson = '{ invalid json }';

      await expect(promptReader.askClarificationQuestions(malformedJson)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse CLARIFICATION_QUESTIONS.json')
      );
    });

    test('should throw error when questions is not an array', async () => {
      const notAnArray = { question: 'Not an array' };

      await expect(promptReader.askClarificationQuestions(notAnArray)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse CLARIFICATION_QUESTIONS.json')
      );
    });

    test('should handle empty questions array', async () => {
      const emptyQuestions = [];

      const result = await promptReader.askClarificationQuestions(emptyQuestions);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.answers).toHaveLength(0);
      expect(parsedResult.timestamp).toBeDefined();
    });

    test('should handle questions with options', async () => {
      const questionsWithOption = [
        {
          title: 'Choice Question',
          question: 'Choose an option:',
          options: [
            { key: 'a', label: 'Option A', description: 'Description A' }
          ]
        }
      ];

      // Override the question mock for this specific test
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        setTimeout(() => callback('a'), 1);
      });

      const result = await promptReader.askClarificationQuestions(questionsWithOption);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.answers[0].answer).toBe('a');
      expect(mockConsoleLog).toHaveBeenCalled(); // Should display options
    });

    test('should handle questions with currentPatterns', async () => {
      const questionsWithPatterns = [
        {
          title: 'Pattern Question',
          question: 'Which pattern to use?',
          currentPatterns: 'Existing pattern in codebase'
        }
      ];

      // Override the question mock for this specific test
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        setTimeout(() => callback('New pattern'), 1);
      });

      const result = await promptReader.askClarificationQuestions(questionsWithPatterns);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.answers[0].answer).toBe('New pattern');
      expect(mockConsoleLog).toHaveBeenCalled(); // Should display current patterns
    });

    test('should handle Unicode content in questions and answers', async () => {
      const unicodeQuestions = [
        {
          title: 'Question avec émojis 🎉',
          question: 'Réponse avec caractères spéciaux?',
          category: 'Catégorie spéciale'
        }
      ];

      // Override the question mock for this specific test
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        setTimeout(() => callback('Réponse avec émojis ✨'), 1);
      });

      const result = await promptReader.askClarificationQuestions(unicodeQuestions);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.answers[0].answer).toBe('Réponse avec émojis ✨');
      expect(parsedResult.answers[0].question).toBe('Question avec émojis 🎉');
      expect(parsedResult.answers[0].category).toBe('Catégorie spéciale');
    });

    test('should verify timestamp format in response', async () => {
      const questions = [{ title: 'Time Question', question: 'What time is it?' }];

      // Override the question mock for this specific test
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        setTimeout(() => callback('Now'), 1);
      });

      const result = await promptReader.askClarificationQuestions(questions);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.timestamp).toBeDefined();
      expect(new Date(parsedResult.timestamp)).toBeInstanceOf(Date);
    });

    test('should handle questions with missing required fields', async () => {
      const questionsWithMissingFields = [
        {
          // Missing title
          question: 'Question without title'
        },
        {
          title: 'Title without question'
          // Missing question
        }
      ];

      // Track call count for multiple questions
      let callCount = 0;
      mockReadlineInterface.question.mockImplementation((question, callback) => {
        callCount++;
        const answer = callCount === 1 ? 'Answer 1' : 'Answer 2';
        setTimeout(() => callback(answer), 1);
      });

      const result = await promptReader.askClarificationQuestions(questionsWithMissingFields);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.answers).toHaveLength(2);
    });
  });
});