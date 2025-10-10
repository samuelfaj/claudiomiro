"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step5 = exports.Step4 = exports.Step3 = exports.Step2 = exports.Step1 = exports.Step0 = exports.step5 = exports.step4 = exports.step3 = exports.step2 = exports.step1 = exports.step0 = void 0;
const step0_1 = require("./step0");
Object.defineProperty(exports, "Step0", { enumerable: true, get: function () { return step0_1.Step0; } });
const step1_1 = require("./step1");
Object.defineProperty(exports, "Step1", { enumerable: true, get: function () { return step1_1.Step1; } });
const step2_1 = require("./step2");
Object.defineProperty(exports, "Step2", { enumerable: true, get: function () { return step2_1.Step2; } });
const step3_1 = require("./step3");
Object.defineProperty(exports, "Step3", { enumerable: true, get: function () { return step3_1.Step3; } });
const step4_1 = require("./step4");
Object.defineProperty(exports, "Step4", { enumerable: true, get: function () { return step4_1.Step4; } });
const step5_1 = require("./step5");
Object.defineProperty(exports, "Step5", { enumerable: true, get: function () { return step5_1.Step5; } });
// Create wrapper functions to maintain API compatibility
exports.step0 = step0_1.Step0.execute;
exports.step1 = step1_1.Step1.execute;
exports.step2 = step2_1.Step2.execute;
const step3 = (task) => step3_1.Step3.execute(task);
exports.step3 = step3;
const step4 = (task) => step4_1.Step4.execute(task);
exports.step4 = step4;
const step5 = (tasks, shouldPush = true) => step5_1.Step5.execute(tasks, shouldPush);
exports.step5 = step5;
//# sourceMappingURL=index.js.map