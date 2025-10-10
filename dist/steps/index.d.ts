import { Step0 } from './step0';
import { Step1 } from './step1';
import { Step2 } from './step2';
import { Step3 } from './step3';
import { Step4 } from './step4';
import { Step5 } from './step5';
export declare const step0: typeof Step0.execute;
export declare const step1: typeof Step1.execute;
export declare const step2: typeof Step2.execute;
export declare const step3: (task: string) => Promise<void>;
export declare const step4: (task: string) => Promise<void>;
export declare const step5: (tasks: string[], shouldPush?: boolean) => Promise<void>;
export { Step0, Step1, Step2, Step3, Step4, Step5 };
//# sourceMappingURL=index.d.ts.map