import * as path from 'path';

type ExecutorType = 'claude' | 'codex' | 'deep-seek' | 'gemini';

interface StateInstance {
  folder: string | null;
  claudiomiroFolder: string | null;
  executorType: ExecutorType;
  setFolder(folderPath: string): void;
  setExecutorType(type: ExecutorType): void;
}

class State implements StateInstance {
  private static _instance: State | null = null;

  private _folder: string | null = null;
  private _claudiomiroFolder: string | null = null;
  private _executorType: ExecutorType = 'claude';

  private constructor() {}

  static getInstance(): State {
    if (!State._instance) {
      State._instance = new State();
    }
    return State._instance;
  }

  setFolder(folderPath: string): void {
    this._folder = path.resolve(folderPath);
    this._claudiomiroFolder = path.join(this._folder, '.claudiomiro');
  }

  get folder(): string | null {
    return this._folder;
  }

  get claudiomiroFolder(): string | null {
    return this._claudiomiroFolder;
  }

  setExecutorType(type: ExecutorType): void {
    const allowed: ExecutorType[] = ['claude', 'codex', 'deep-seek', 'gemini'];
    if (!allowed.includes(type)) {
      throw new Error(`Invalid executor type: ${type}`);
    }
    this._executorType = type;
  }

  get executorType(): ExecutorType {
    return this._executorType;
  }
}

export { State };
export default State.getInstance();