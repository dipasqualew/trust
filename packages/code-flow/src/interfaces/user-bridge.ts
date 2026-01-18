/**
 * Represents a question to be asked to the user
 */
export interface Question {
    /** The question text */
    question: string;
}

/**
 * Represents an answer from the user
 */
export interface Answer {
    /** The answer text */
    answer: string;
}

/**
 * Configuration for a UserBridge implementation
 */
export interface UserBridgeConfig {
    [key: string]: unknown;
}

/**
 * UserBridge facilitates communication with users during the planning/coding process
 */
export interface UserBridge {
    /**
     * Asks a question to the user
     * @param question The question to ask
     * @returns Promise resolving when the question has been posted
     */
    ask(question: Question, config: UserBridgeConfig): Promise<void>;

    /**
     * Waits for and retrieves the user's answer to a previously asked question
     * @returns Promise resolving to the user's answer
     */
    waitForAnswer(config: UserBridgeConfig): Promise<Answer>;
}
