import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as childProcess from 'node:child_process';
import { MacosUserBridge } from '../bridges/macos-user-bridge.js';

// Mock child_process module
vi.mock('node:child_process');

describe('MacosUserBridge', () => {
    let bridge: MacosUserBridge;
    let execSyncMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        bridge = new MacosUserBridge();
        execSyncMock = vi.fn();
        vi.spyOn(childProcess, 'execSync').mockImplementation(execSyncMock);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('ask', () => {
        it('should store the question for later use', async () => {
            const question = { question: 'What is your name?' };

            await bridge.ask(question, {});

            // Verify no osascript is called during ask
            expect(execSyncMock).not.toHaveBeenCalled();
        });
    });

    describe('waitForAnswer', () => {
        it('should throw error if no question has been asked', async () => {
            await expect(bridge.waitForAnswer({})).rejects.toThrow(
                'No question has been asked yet. Call ask() first.',
            );
        });

        it('should execute osascript with properly formatted command', async () => {
            const question = { question: 'What is your name?' };
            execSyncMock.mockReturnValue('button returned:OK, text returned:John Doe');

            await bridge.ask(question, {});
            await bridge.waitForAnswer({});

            expect(execSyncMock).toHaveBeenCalledWith(
                expect.stringContaining('osascript -e'),
                expect.objectContaining({ encoding: 'utf-8' }),
            );

            const command = execSyncMock.mock.calls[0][0] as string;
            expect(command).toContain('display dialog');
            expect(command).toContain('What is your name?');
            expect(command).toContain('default answer ""');
            expect(command).toContain('buttons {"Cancel", "OK"}');
        });

        it('should parse and return the user answer correctly', async () => {
            const question = { question: 'What is your favorite color?' };
            execSyncMock.mockReturnValue('button returned:OK, text returned:Blue');

            await bridge.ask(question, {});
            const result = await bridge.waitForAnswer({});

            expect(result).toEqual({ answer: 'Blue' });
        });

        it('should handle empty answers', async () => {
            const question = { question: 'Optional field?' };
            execSyncMock.mockReturnValue('button returned:OK, text returned:');

            await bridge.ask(question, {});
            const result = await bridge.waitForAnswer({});

            expect(result).toEqual({ answer: '' });
        });

        it('should escape special characters in questions', async () => {
            const question = { question: 'Enter "quoted" text with\\backslash' };
            execSyncMock.mockReturnValue('button returned:OK, text returned:answer');

            await bridge.ask(question, {});
            await bridge.waitForAnswer({});

            const command = execSyncMock.mock.calls[0][0] as string;
            expect(command).toContain('\\"quoted\\"');
            expect(command).toContain('\\\\backslash');
        });

        it('should handle newlines in questions', async () => {
            const question = { question: 'Line 1\nLine 2' };
            execSyncMock.mockReturnValue('button returned:OK, text returned:answer');

            await bridge.ask(question, {});
            await bridge.waitForAnswer({});

            const command = execSyncMock.mock.calls[0][0] as string;
            expect(command).toContain('\\n');
        });

        it('should throw error when user cancels dialog', async () => {
            const question = { question: 'Do you want to continue?' };
            const error = new Error('execution error User canceled');
            execSyncMock.mockImplementation(() => {
                throw error;
            });

            await bridge.ask(question, {});
            await expect(bridge.waitForAnswer({})).rejects.toThrow('User canceled the dialog');
        });

        it('should throw error when osascript is not available', async () => {
            const question = { question: 'Test question' };
            const error = new Error('osascript: command not found');
            execSyncMock.mockImplementation(() => {
                throw error;
            });

            await bridge.ask(question, {});
            await expect(bridge.waitForAnswer({})).rejects.toThrow(
                'osascript is not available. MacosUserBridge only works on macOS.',
            );
        });

        it('should throw error when result parsing fails', async () => {
            const question = { question: 'Test question' };
            execSyncMock.mockReturnValue('invalid response format');

            await bridge.ask(question, {});
            await expect(bridge.waitForAnswer({})).rejects.toThrow('Failed to parse AppleScript result');
        });

        it('should clear current question after successful answer', async () => {
            const question = { question: 'First question?' };
            execSyncMock.mockReturnValue('button returned:OK, text returned:Answer 1');

            await bridge.ask(question, {});
            await bridge.waitForAnswer({});

            // Trying to wait again without asking should throw
            await expect(bridge.waitForAnswer({})).rejects.toThrow(
                'No question has been asked yet. Call ask() first.',
            );
        });

        it('should support multiple sequential questions', async () => {
            execSyncMock
                .mockReturnValueOnce('button returned:OK, text returned:Answer 1')
                .mockReturnValueOnce('button returned:OK, text returned:Answer 2');

            await bridge.ask({ question: 'Question 1?' }, {});
            const answer1 = await bridge.waitForAnswer({});
            expect(answer1).toEqual({ answer: 'Answer 1' });

            await bridge.ask({ question: 'Question 2?' }, {});
            const answer2 = await bridge.waitForAnswer({});
            expect(answer2).toEqual({ answer: 'Answer 2' });
        });
    });
});
