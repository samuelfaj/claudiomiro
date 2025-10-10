"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("../../logger"));
const state_1 = __importDefault(require("../config/state"));
class FileManager {
    /**
     * Cleans up previous files and optionally creates a fresh folder
     * @param createFolder Whether to create a new folder after cleanup
     * @returns FileOperationResult indicating success or failure
     */
    static startFresh(createFolder = false) {
        try {
            logger_1.default.task('Cleaning up previous files...');
            logger_1.default.indent();
            if (fs_1.default.existsSync(state_1.default.claudiomiroFolder)) {
                fs_1.default.rmSync(state_1.default.claudiomiroFolder, { recursive: true });
                logger_1.default.success(`${state_1.default.claudiomiroFolder} removed\n`);
            }
            if (createFolder) {
                fs_1.default.mkdirSync(state_1.default.claudiomiroFolder);
            }
            logger_1.default.outdent();
            return {
                success: true,
                message: 'File cleanup completed successfully'
            };
        }
        catch (error) {
            logger_1.default.error('Failed to clean up files');
            return {
                success: false,
                error: error,
                message: 'File cleanup failed'
            };
        }
    }
}
exports.FileManager = FileManager;
exports.default = FileManager;
//# sourceMappingURL=file-manager.js.map