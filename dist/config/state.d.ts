type ExecutorType = 'claude' | 'codex' | 'deep-seek' | 'gemini';
interface StateInstance {
    folder: string | null;
    claudiomiroFolder: string | null;
    executorType: ExecutorType;
    setFolder(folderPath: string): void;
    setExecutorType(type: ExecutorType): void;
}
declare class State implements StateInstance {
    private static _instance;
    private _folder;
    private _claudiomiroFolder;
    private _executorType;
    private constructor();
    static getInstance(): State;
    setFolder(folderPath: string): void;
    get folder(): string | null;
    get claudiomiroFolder(): string | null;
    setExecutorType(type: ExecutorType): void;
    get executorType(): ExecutorType;
}
export { State };
declare const _default: State;
export default _default;
//# sourceMappingURL=state.d.ts.map