import { generateFiles, joinPathFragments, names, type Tree } from '@nx/devkit';
import { getRelativePathToRootTsConfig, getRootTsConfigFileName } from '@nx/js';
import {
  createNxCloudOnboardingURLForWelcomeApp,
  getNxCloudAppOnBoardingUrl,
} from 'nx/src/nx-cloud/utilities/onboarding';
import { UnitTestRunner } from '../../../utils/test-runners';
import {
  getComponentType,
  getModuleTypeSeparator,
} from '../../utils/artifact-types';
import { validateHtmlSelector } from '../../utils/selector';
import { updateProjectRootTsConfig } from '../../utils/update-project-root-tsconfig';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export async function createFiles(
  tree: Tree,
  options: NormalizedSchema,
  rootOffset: string
) {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

  const rootSelector = `${options.prefix}-root`;
  validateHtmlSelector(rootSelector);
  const nxWelcomeSelector = `${options.prefix}-nx-welcome`;
  validateHtmlSelector(nxWelcomeSelector);

  const onBoardingStatus = await createNxCloudOnboardingURLForWelcomeApp(
    tree,
    options.nxCloudToken
  );

  const connectCloudUrl =
    onBoardingStatus === 'unclaimed' &&
    (await getNxCloudAppOnBoardingUrl(options.nxCloudToken));

  const componentType = getComponentType(tree);
  const componentFileSuffix = componentType ? `.${componentType}` : '';
  const moduleTypeSeparator = getModuleTypeSeparator(tree);

  const substitutions = {
    rootSelector,
    appName: options.name,
    inlineStyle: options.inlineStyle,
    inlineTemplate: options.inlineTemplate,
    style: options.style,
    viewEncapsulation: options.viewEncapsulation,
    unitTesting: options.unitTestRunner !== UnitTestRunner.None,
    routing: options.routing,
    minimal: options.minimal,
    nxWelcomeSelector,
    rootTsConfig: joinPathFragments(rootOffset, getRootTsConfigFileName(tree)),
    angularMajorVersion,
    rootOffset,
    // Angular v19 or higher defaults to true, while lower versions default to false
    setStandaloneFalse: angularMajorVersion >= 19,
    setStandaloneTrue: angularMajorVersion < 19,
    provideGlobalErrorListener: angularMajorVersion >= 20,
    usePlatformBrowserDynamic: angularMajorVersion < 20,
    componentType: componentType ? names(componentType).className : '',
    componentFileSuffix,
    moduleTypeSeparator,
    connectCloudUrl,
    tutorialUrl: options.standalone
      ? 'https://nx.dev/getting-started/tutorials/angular-standalone-tutorial?utm_source=nx-project'
      : 'https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx-project',
    tpl: '',
  };

  const angularAppType = options.standalone ? 'standalone' : 'ng-module';

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/base'),
    options.appProjectRoot,
    substitutions
  );

  if (angularMajorVersion >= 20) {
    tree.delete(
      joinPathFragments(options.appProjectRoot, 'tsconfig.editor.json')
    );
  }

  if (options.standalone) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/standalone-components'),
      options.appProjectRoot,
      substitutions
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/ng-module'),
      options.appProjectRoot,
      substitutions
    );
  }

  generateFiles(
    tree,
    joinPathFragments(
      __dirname,
      '../files/nx-welcome',
      onBoardingStatus,
      angularAppType
    ),
    options.appProjectRoot,
    substitutions
  );

  updateProjectRootTsConfig(
    tree,
    options.appProjectRoot,
    getRelativePathToRootTsConfig(tree, options.appProjectRoot),
    options.rootProject
  );

  if (!options.routing) {
    tree.delete(
      joinPathFragments(options.appProjectRoot, '/src/app/app.routes.ts')
    );
  }

  if (options.skipTests || options.unitTestRunner === UnitTestRunner.None) {
    tree.delete(
      joinPathFragments(
        options.appProjectRoot,
        `src/app/app${componentFileSuffix}.spec.ts`
      )
    );
  }

  if (options.inlineTemplate) {
    tree.delete(
      joinPathFragments(
        options.appProjectRoot,
        `src/app/app${componentFileSuffix}.html`
      )
    );
  }

  if (options.inlineStyle) {
    tree.delete(
      joinPathFragments(
        options.appProjectRoot,
        `src/app/app${componentFileSuffix}.${options.style}`
      )
    );
  }

  if (options.minimal) {
    tree.delete(
      joinPathFragments(
        options.appProjectRoot,
        `src/app/nx-welcome${componentFileSuffix}.ts`
      )
    );
  }
}
