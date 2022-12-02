import defaultConfig from './hardhat.config';
import { subtask } from 'hardhat/config';
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from 'hardhat/builtin-tasks/task-names';

/**
 * We don't want to compile and statically analyse test contracts
 * Solution to ignoring certain source paths was mentioned in
 * https://github.com/NomicFoundation/hardhat/issues/2306#issuecomment-1039452928
 */
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths: string[] = await runSuper();

  // Exclude Mock and TestHelper contracts
  return paths.filter(p => !p.includes('Mock') && !p.includes('TestHelper'));
});

export default defaultConfig;
