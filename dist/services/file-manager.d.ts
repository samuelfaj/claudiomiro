export interface FileOperationResult {
    success: boolean;
    message?: string;
    error?: Error;
}
export interface FileManagerInterface {
    startFresh(createFolder?: boolean): FileOperationResult;
}
export declare class FileManager {
    /**
     * Cleans up previous files and optionally creates a fresh folder
     * @param createFolder Whether to create a new folder after cleanup
     * @returns FileOperationResult indicating success or failure
     */
    static startFresh(createFolder?: boolean): FileOperationResult;
}
export default FileManager;
//# sourceMappingURL=file-manager.d.ts.map