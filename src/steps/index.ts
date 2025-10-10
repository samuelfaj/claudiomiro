import { Step0 } from './step0';
import { Step1 } from './step1';
import { Step2 } from './step2';
import { Step3 } from './step3';
import { Step4 } from './step4';
import { Step5 } from './step5';

// Create wrapper functions to maintain API compatibility
export const step0 = Step0.execute;
export const step1 = Step1.execute;
export const step2 = Step2.execute;
export const step3 = (task: string) => Step3.execute(task);
export const step4 = (task: string) => Step4.execute(task);
export const step5 = (tasks: string[], shouldPush: boolean = true) => Step5.execute(tasks, shouldPush);

export {
    Step0,
    Step1,
    Step2,
    Step3,
    Step4,
    Step5
};