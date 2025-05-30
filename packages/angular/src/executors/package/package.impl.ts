import type { ExecutorContext } from '@nx/devkit';
import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
  type DependentBuildableProjectNode,
} from '@nx/js/src/utils/buildable-libs-utils';
import type { NgPackagr } from 'ng-packagr';
import { join, resolve } from 'path';
import { from } from 'rxjs';
import { mapTo, switchMap } from 'rxjs/operators';
import { parseRemappedTsConfigAndMergeDefaults } from '../utilities/typescript';
import { getNgPackagrInstance } from './ng-packagr-adjustments/ng-packagr';
import type { BuildAngularLibraryExecutorOptions } from './schema';

async function initializeNgPackagr(
  options: BuildAngularLibraryExecutorOptions,
  context: ExecutorContext,
  projectDependencies: DependentBuildableProjectNode[]
): Promise<NgPackagr> {
  const ngPackagr = await getNgPackagrInstance();
  ngPackagr.forProject(resolve(context.root, options.project));

  if (options.tsConfig) {
    const remappedTsConfigFilePath = createTmpTsConfig(
      join(context.root, options.tsConfig),
      context.root,
      context.projectsConfigurations.projects[context.projectName].root,
      projectDependencies
    );
    const tsConfig = await parseRemappedTsConfigAndMergeDefaults(
      context.root,
      options.tsConfig,
      remappedTsConfigFilePath
    );
    ngPackagr.withTsConfig(tsConfig);
  }

  return ngPackagr;
}

/**
 * Creates an executor function that executes the library build of an Angular
 * package using ng-packagr.
 * @param initializeNgPackagr function that returns an ngPackagr instance to use for the build.
 */
export function createLibraryExecutor(
  initializeNgPackagr: (
    options: BuildAngularLibraryExecutorOptions,
    context: ExecutorContext,
    projectDependencies: DependentBuildableProjectNode[]
  ) => Promise<NgPackagr>
) {
  return async function* (
    options: BuildAngularLibraryExecutorOptions,
    context: ExecutorContext
  ) {
    options.project ??= join(
      context.projectsConfigurations.projects[context.projectName].root,
      'ng-package.json'
    );

    const { dependencies } = calculateProjectBuildableDependencies(
      context.taskGraph,
      context.projectGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );

    if (options.watch) {
      return yield* eachValueFrom(
        from(initializeNgPackagr(options, context, dependencies)).pipe(
          switchMap((packagr) => packagr.watch()),
          mapTo({ success: true })
        )
      );
    }

    return from(initializeNgPackagr(options, context, dependencies))
      .pipe(
        switchMap((packagr) => packagr.build()),
        mapTo({ success: true })
      )
      .toPromise();
  };
}

export const packageExecutor = createLibraryExecutor(initializeNgPackagr);

export default packageExecutor;
